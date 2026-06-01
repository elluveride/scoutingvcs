import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFTCRankings, type TeamRanking } from '@/hooks/useFTCRankings';
import { useFTCMatches } from '@/hooks/useFTCMatches';
import {
  Loader2, RefreshCw, Radio, Trophy, Clock, Activity, Target,
  Flame, ShieldCheck, Sparkles, Zap, ParkingSquare, Crosshair, Info, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { POINTS, predictTeam, type TeamPrediction, type MatchEntryLite } from '@/lib/prediction';
import { computeOPR } from '@/lib/opr';

/*──────────────── types ────────────────*/
interface NexusMatchTimes {
  estimatedQueueTime?: number;
  estimatedOnDeckTime?: number;
  estimatedOnFieldTime?: number;
  estimatedStartTime?: number;
  actualStartTime?: number;
}
interface NexusMatch {
  label: string;
  status: string;
  redTeams: string[];
  blueTeams: string[];
  times?: NexusMatchTimes;
  replayOf?: string | null;
}
interface NexusStatus {
  eventKey: string;
  dataAsOfTime: number;
  nowQueuing?: string | null;
  matches: NexusMatch[];
  announcements?: { id: string; postedTime: number; message: string }[];
}
interface NexusResponse {
  status: NexusStatus;
  pitAddresses: Record<string, string>;
  eventKey: string;
  error?: string;
}
interface PitRow {
  team_number: number;
  team_name: string;
  scores_motifs: boolean;
  scores_artifacts: boolean;
  has_autonomous: boolean;
  reliable_auto_leave: string;
  endgame_consistency: string;
  drive_type: string;
}

interface TeamConfidenceDebug {
  teamNumber: number;
  consistency: number;
  sampleCoverage: number;
  confidence: number;
  matchCount: number;
  sampleLabel: string;
  delta: number;
  deltaPct: number | null;
}

const STATUS_PRIORITY: Record<string, number> = {
  'On field': 0, 'In progress': 0,
  'On deck': 1,
  'Now queuing': 2,
  'Scheduled': 3,
  'Not started': 4,
};

const findByStatus = (matches: NexusMatch[], status: string) =>
  matches.find((m) => m.status === status);

const formatTime = (ms?: number) =>
  !ms ? '—' : new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const sampleSizeLabel = (avgMatches: number) =>
  avgMatches >= 4 ? 'Strong sample' :
  avgMatches >= 2 ? 'Moderate sample' :
  avgMatches > 0 ? 'Small sample' : 'No sample';

const confidenceToneClasses = (value: number) =>
  value >= 70 ? 'bg-success text-success-foreground' :
  value >= 40 ? 'bg-warning text-warning-foreground' :
  'bg-destructive text-destructive-foreground';

function computeTeamConfidenceDebug(prediction?: TeamPrediction, allianceTotal?: number): TeamConfidenceDebug | null {
  if (!prediction) return null;
  const sampleCoverage = Math.min(1, prediction.matchCount / 4);
  const confidence = Math.round(prediction.consistency * sampleCoverage);
  const deltaPct = allianceTotal && allianceTotal > 0
    ? (prediction.predictedTotal / allianceTotal) * 100
    : null;

  return {
    teamNumber: prediction.teamNumber,
    consistency: prediction.consistency,
    sampleCoverage,
    confidence,
    matchCount: prediction.matchCount,
    sampleLabel: sampleSizeLabel(prediction.matchCount),
    delta: prediction.predictedTotal,
    deltaPct,
  };
}

export default function PitDisplay() {
  const { user, profile } = useAuth();
  const { currentEvent } = useEvent();
  const { toast } = useToast();
  const { rankings, matchScores, refetch: refetchRankings } = useFTCRankings(true);
  const { matches: ftcMatches, refetch: refetchMatches } = useFTCMatches();

  const myTeam = profile?.teamNumber ? String(profile.teamNumber) : '';

  const [eventKey, setEventKey] = useState(currentEvent?.code || '');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NexusResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [scoutingEntries, setScoutingEntries] = useState<any[]>([]);
  const [pitEntries, setPitEntries] = useState<PitRow[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [manualBlueTeam1, setManualBlueTeam1] = useState('');
  const [manualBlueTeam2, setManualBlueTeam2] = useState('');
  const [manualRedTeam1, setManualRedTeam1] = useState('');
  const [manualRedTeam2, setManualRedTeam2] = useState('');

  /*──────────────── fetching ────────────────*/
  const fetchNexus = async (key: string, silent = false) => {
    if (!key) return;
    if (!silent) setLoading(true);
    const { data: resp, error } = await supabase.functions.invoke('nexus-pit-display', {
      body: { eventKey: key },
    });
    if (!silent) setLoading(false);
    if (error || resp?.error) {
      if (!silent) toast({
        title: 'Failed to load Nexus data',
        description: resp?.error || error?.message || 'Nexus API request failed',
        variant: 'destructive',
      });
      return;
    }
    setData(resp);
    setLastUpdated(Date.now());
  };

  const fetchScouting = async () => {
    if (!currentEvent?.code) return;
    const [m, p] = await Promise.all([
      supabase.from('match_entries').select('*').eq('event_code', currentEvent.code).order('match_number'),
      supabase.from('pit_entries').select('*').eq('event_code', currentEvent.code),
    ]);
    setScoutingEntries(m.data || []);
    setPitEntries((p.data as PitRow[]) || []);
  };

  useEffect(() => {
    if (currentEvent?.code) {
      setEventKey(currentEvent.code);
      fetchNexus(currentEvent.code);
      fetchScouting();
      refetchRankings();
      refetchMatches('Q');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.code]);

  useEffect(() => {
    if (!eventKey) return;
    const id = setInterval(() => {
      fetchNexus(eventKey, true);
      fetchScouting();
      refetchRankings();
      refetchMatches('Q');
    }, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey]);

  if (!user) return <Navigate to="/auth" replace />;

  /*──────────────── derived ────────────────*/
  // If Nexus has no usable data, synthesize from FTC API schedule + scores
  const fallback = useMemo<NexusStatus | null>(() => {
    if (data?.status?.matches?.length) return null;
    if (!ftcMatches.length) return null;
    const playedNums = new Set(matchScores.map((s) => s.matchNumber));
    const sorted = [...ftcMatches].sort((a, b) => a.matchNumber - b.matchNumber);
    const nextIdx = sorted.findIndex((m) => !playedNums.has(m.matchNumber));
    if (nextIdx === -1) return null;
    const toNexus = (mm: typeof sorted[number], status: string): NexusMatch => {
      const red = mm.positions.filter((p) => p.position.startsWith('R')).map((p) => String(p.teamNumber));
      const blue = mm.positions.filter((p) => p.position.startsWith('B')).map((p) => String(p.teamNumber));
      return { label: `Q-${mm.matchNumber}`, status, redTeams: red, blueTeams: blue, times: {} };
    };
    const synth: NexusMatch[] = [];
    if (sorted[nextIdx]) synth.push(toNexus(sorted[nextIdx], 'On field'));
    if (sorted[nextIdx + 1]) synth.push(toNexus(sorted[nextIdx + 1], 'On deck'));
    if (sorted[nextIdx + 2]) synth.push(toNexus(sorted[nextIdx + 2], 'Now queuing'));
    sorted.slice(nextIdx + 3, nextIdx + 12).forEach((m) => synth.push(toNexus(m, 'Scheduled')));
    return {
      eventKey: eventKey || '',
      dataAsOfTime: Date.now(),
      matches: synth,
    };
  }, [data, ftcMatches, matchScores, eventKey]);

  const usingFallback = !!fallback && !data?.status?.matches?.length;
  const status = usingFallback ? fallback : data?.status;
  const matches = status?.matches || [];

  // Sanity: on-field number must be one less than on-deck
  const extractNum = (label?: string) => {
    if (!label) return null;
    const m = label.match(/(\d+)/);
    return m ? parseInt(m[1]) : null;
  };
  let onField = findByStatus(matches, 'On field') || findByStatus(matches, 'In progress');
  let queuing = findByStatus(matches, 'Now queuing');
  let onDeck = findByStatus(matches, 'On deck');
  const fNum = extractNum(onField?.label);
  const dNum = extractNum(onDeck?.label);
  const qNum = extractNum(queuing?.label);
  // If on-deck != on-field + 1, prefer trusting on-deck (newest signal) and rebuild
  if (fNum !== null && dNum !== null && dNum !== fNum + 1) {
    const corrected = matches.find((m) => extractNum(m.label) === dNum - 1);
    if (corrected) onField = corrected;
  }
  // Queuing should be on-deck + 1 (or on-field + 2)
  if (dNum !== null && qNum !== null && qNum !== dNum + 1) {
    const corrected = matches.find((m) => extractNum(m.label) === dNum + 1);
    if (corrected) queuing = corrected;
  }

  const teamPredictions = useMemo(() => {
    const teamMap = new Map<number, MatchEntryLite[]>();
    scoutingEntries.forEach((e: any) => {
      const arr = teamMap.get(e.team_number) || [];
      arr.push(e);
      teamMap.set(e.team_number, arr);
    });
    const preds = new Map<number, TeamPrediction>();
    teamMap.forEach((entries, team) => preds.set(team, predictTeam(team, entries)));
    return preds;
  }, [scoutingEntries]);

  const pitMap = useMemo(() => {
    const m = new Map<number, PitRow>();
    pitEntries.forEach((p) => m.set(p.team_number, p));
    return m;
  }, [pitEntries]);

  const oprMap = useMemo(
    () => computeOPR(ftcMatches, matchScores),
    [ftcMatches, matchScores]
  );

  const upcoming = useMemo(() => {
    return matches
      .filter((m) => !['Completed', 'On field', 'In progress'].includes(m.status))
      .sort((a, b) => {
        const pa = STATUS_PRIORITY[a.status] ?? 99;
        const pb = STATUS_PRIORITY[b.status] ?? 99;
        if (pa !== pb) return pa - pb;
        return (a.times?.estimatedStartTime || 0) - (b.times?.estimatedStartTime || 0);
      })
      .slice(0, 8);
  }, [matches]);

  const myRanking: TeamRanking | undefined = useMemo(
    () => (myTeam ? rankings.find((r) => String(r.teamNumber) === myTeam) : undefined),
    [rankings, myTeam]
  );

  const myPitAddress = myTeam && data?.pitAddresses ? data.pitAddresses[myTeam] : undefined;
  const myPrediction = myTeam ? teamPredictions.get(parseInt(myTeam)) : undefined;
  const myOPR = myTeam ? oprMap.get(parseInt(myTeam)) : undefined;

  return (
    <AppLayout>
      <TooltipProvider delayDuration={150}>
      <div className="space-y-3">
        {/* PITSTOP-STYLE HEADER */}
        <header className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-stretch">
            <div className="flex-1 px-4 py-3 border-b md:border-b-0 md:border-r border-border bg-gradient-to-r from-primary/10 to-transparent">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-display">Pit Display</p>
              <h1 className="font-display text-2xl leading-tight">
                {currentEvent?.name || 'No event selected'}
              </h1>
              <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  Event code:
                </span>
                <Input
                  value={eventKey}
                  onChange={(e) => setEventKey(e.target.value)}
                  placeholder="Nexus key"
                  className="h-7 px-2 py-0 font-mono w-36 text-xs"
                />
                {lastUpdated && (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                    <Radio className="w-3 h-3 text-success animate-pulse" />
                    Live • {formatTime(lastUpdated)} • 15s
                  </span>
                )}
                {usingFallback && (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-warning inline-flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" />
                    Nexus unavailable — using FTC schedule fallback
                  </span>
                )}
              </div>
            </div>

            {/* My-team strip */}
            {myTeam && (
              <div className="px-4 py-3 flex flex-row md:flex-col gap-4 md:gap-1 items-center md:items-start md:min-w-[260px] bg-primary/5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-display">Your Team</p>
                  <p className="font-display text-2xl text-primary leading-tight">{myTeam}</p>
                </div>
                <div className="grid grid-cols-3 gap-1 flex-1 w-full text-center">
                  <HeaderStat label="Rank" value={myRanking ? `#${myRanking.rank}` : '—'} />
                  <HeaderStat label="OPR" value={myOPR !== undefined ? myOPR.toFixed(1) : '—'} />
                  <HeaderStat label="Pit" value={myPitAddress || '—'} mono />
                </div>
              </div>
            )}

            <div className="px-4 py-3 flex items-center">
              <Button
                onClick={() => { fetchNexus(eventKey); fetchScouting(); refetchRankings(); refetchMatches('Q'); }}
                disabled={!eventKey || loading}
                size="sm"
                variant="outline"
                className="h-9 gap-2"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Refresh
              </Button>
            </div>
          </div>
        </header>

        {/* MATCH STATUS TRIPLE */}
        <div className="grid grid-cols-3 gap-2">
          <StatusCard label="On Field" match={onField} myTeam={myTeam} variant="active"
            predictions={teamPredictions} />
          <StatusCard label="On Deck" match={onDeck} myTeam={myTeam} variant="info"
            predictions={teamPredictions} />
          <StatusCard label="Queuing" match={queuing} myTeam={myTeam} variant="warning"
            predictions={teamPredictions} />
        </div>

        {/* TABS */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid grid-cols-4 w-full h-10">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="teams">Teams &amp; OPR</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-3 mt-3">
            {onField ? (
              <MatchPredictionCard
                match={onField}
                predictions={teamPredictions}
                oprMap={oprMap}
                pitMap={pitMap}
                myTeam={myTeam}
              />
            ) : (
              <div className="data-card text-sm text-muted-foreground">Waiting for match on field…</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="data-card lg:col-span-2">
                <SectionTitle icon={Clock} label="Upcoming Matches" tone="accent" />
                <div className="space-y-1.5">
                  {upcoming.map((m) => (
                    <MatchRow
                      key={`${m.label}-${m.replayOf ?? ''}`}
                      match={m}
                      myTeam={myTeam}
                      predictions={teamPredictions}
                    />
                  ))}
                  {upcoming.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No upcoming matches</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {myPrediction && myPrediction.matchCount > 0 && (
                  <div className="data-card border-l-4 border-primary">
                    <SectionTitle icon={Activity} label={`Team ${myTeam} Snapshot`} tone="primary" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <MiniStat label="Pred Total" value={myPrediction.predictedTotal.toFixed(1)} highlight />
                      <MiniStat label="OPR" value={myOPR !== undefined ? myOPR.toFixed(1) : '—'} highlight />
                      <MiniStat label="Auto" value={myPrediction.predictedAuto.toFixed(1)} />
                      <MiniStat label="Teleop" value={myPrediction.predictedTeleop.toFixed(1)} />
                      <MiniStat label="Endgame" value={myPrediction.predictedEndgame.toFixed(1)} />
                      <MiniStat label="Consistency" value={`${myPrediction.consistency}%`} />
                      <MiniStat label="Leave %" value={`${myPrediction.leaveRate}%`} />
                      <MiniStat label="Full Park %" value={`${myPrediction.fullReturnRate}%`} />
                    </div>
                  </div>
                )}

                {status?.announcements && status.announcements.length > 0 && (
                  <div className="data-card">
                    <SectionTitle icon={Sparkles} label="Announcements" tone="secondary" />
                    <div className="space-y-1.5">
                      {status.announcements.slice(0, 3).map((a) => (
                        <div key={a.id} className="p-2 rounded-md bg-muted/40 border-l-2 border-secondary">
                          <p className="text-xs">{a.message}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5 font-mono uppercase">{formatTime(a.postedTime)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* MATCHES */}
          <TabsContent value="matches" className="space-y-3 mt-3">
            <div className="data-card">
              <SectionTitle icon={Clock} label="Match Schedule" tone="accent" />
              <div className="space-y-1.5">
                {matches.slice(0, 30).map((m) => (
                  <MatchRow
                    key={`${m.label}-${m.status}-${m.replayOf ?? ''}`}
                    match={m}
                    myTeam={myTeam}
                    predictions={teamPredictions}
                  />
                ))}
                {matches.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No match schedule available</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TEAMS / OPR */}
          <TabsContent value="teams" className="mt-3">
            <div className="data-card">
              <SectionTitle icon={Trophy} label="Rankings & OPR" tone="secondary" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] text-muted-foreground border-b border-border uppercase tracking-wider font-display">
                      <th className="py-1.5 px-2">#</th>
                      <th className="py-1.5 px-2">Team</th>
                      <th className="py-1.5 px-2 text-right">RP</th>
                      <th className="py-1.5 px-2 text-right">Rec</th>
                      <th className="py-1.5 px-2 text-right">Avg</th>
                      <th className="py-1.5 px-2 text-right">OPR</th>
                      <th className="py-1.5 px-2 text-right">Pred</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((r) => {
                      const isMe = String(r.teamNumber) === myTeam;
                      const opr = oprMap.get(r.teamNumber);
                      const pred = teamPredictions.get(r.teamNumber);
                      return (
                        <tr
                          key={r.teamNumber}
                          className={cn(
                            'border-b border-border/40 transition-colors hover:bg-muted/30',
                            isMe && 'bg-primary/15 font-bold'
                          )}
                        >
                          <td className="py-1.5 px-2 font-mono">{r.rank}</td>
                          <td className="py-1.5 px-2 font-mono">
                            {r.teamNumber}
                            {r.teamName && <span className="ml-2 text-muted-foreground font-sans text-xs">{r.teamName}</span>}
                          </td>
                          <td className="py-1.5 px-2 font-mono text-right">{r.rankingPoints?.toFixed(1) ?? '—'}</td>
                          <td className="py-1.5 px-2 font-mono text-right">{r.wins}-{r.losses}-{r.ties}</td>
                          <td className="py-1.5 px-2 font-mono text-right">{r.qualAverage?.toFixed(1) ?? '—'}</td>
                          <td className="py-1.5 px-2 font-mono text-right text-primary">
                            {opr !== undefined ? opr.toFixed(1) : '—'}
                          </td>
                          <td className="py-1.5 px-2 font-mono text-right">
                            {pred ? pred.predictedTotal.toFixed(0) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {rankings.length === 0 && (
                      <tr><td colSpan={7} className="py-4 text-center text-muted-foreground text-sm">No rankings published yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* INSIGHTS */}
          <TabsContent value="insights" className="space-y-3 mt-3">
            {onField ? (
              <TeamCapabilitiesPanel
                title={`On Field • ${onField.label}`}
                match={onField}
                predictions={teamPredictions}
                pitMap={pitMap}
                oprMap={oprMap}
                myTeam={myTeam}
              />
            ) : (
              <div className="data-card text-sm text-muted-foreground">No match on field</div>
            )}
            {queuing && (
              <TeamCapabilitiesPanel
                title={`Queuing • ${queuing.label}`}
                match={queuing}
                predictions={teamPredictions}
                pitMap={pitMap}
                oprMap={oprMap}
                myTeam={myTeam}
              />
            )}
            {onDeck && (
              <TeamCapabilitiesPanel
                title={`On Deck • ${onDeck.label}`}
                match={onDeck}
                predictions={teamPredictions}
                pitMap={pitMap}
                oprMap={oprMap}
                myTeam={myTeam}
              />
            )}
          </TabsContent>
        </Tabs>

        {loading && !data && <div className="data-card"><Skeleton className="w-full h-32" /></div>}
      </div>
      </TooltipProvider>
    </AppLayout>
  );
}

/*──────────────── subcomponents ────────────────*/

function SectionTitle({ icon: Icon, label, tone }: { icon: React.ElementType; label: string; tone: 'primary' | 'secondary' | 'accent' }) {
  const tones = { primary: 'text-primary', secondary: 'text-secondary', accent: 'text-accent' };
  return (
    <h2 className={cn('text-xs font-display uppercase tracking-[0.2em] mb-2 flex items-center gap-2', tones[tone])}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </h2>
  );
}

function HeaderStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-border bg-card/60 px-1.5 py-1 min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-display truncate">{label}</p>
      <p className={cn('text-sm font-display truncate', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-md border px-2.5 py-1.5',
      highlight ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/20'
    )}>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-display">{label}</p>
      <p className="font-display text-lg leading-tight">{value}</p>
    </div>
  );
}

function StatusCard({ label, match, myTeam, variant, predictions }: {
  label: string; match?: NexusMatch; myTeam: string;
  variant: 'active' | 'warning' | 'info';
  predictions: Map<number, TeamPrediction>;
}) {
  const styles = {
    active: 'border-l-primary bg-primary/10',
    warning: 'border-l-secondary bg-secondary/10',
    info: 'border-l-accent bg-accent/10',
  }[variant];

  const hasMyTeam = !!myTeam && !!match && [...match.redTeams, ...match.blueTeams].includes(myTeam);

  // My team's contribution / impact in this match
  let impact: { delta: number; allianceTotal: number; pct: number; isRed: boolean } | null = null;
  if (hasMyTeam && match) {
    const isRed = match.redTeams.includes(myTeam);
    const teams = isRed ? match.redTeams : match.blueTeams;
    const allianceTotal = teams.reduce((s, t) => s + (predictions.get(parseInt(t))?.predictedTotal ?? 0), 0);
    const mine = predictions.get(parseInt(myTeam))?.predictedTotal ?? 0;
    impact = { delta: mine, allianceTotal, pct: allianceTotal > 0 ? (mine / allianceTotal) * 100 : 0, isRed };
  }

  return (
    <div className={cn(
      'rounded-lg border-l-4 p-3 bg-card border border-border',
      styles,
      hasMyTeam && 'ring-2 ring-primary shadow-[0_0_18px_hsl(var(--primary)/0.35)]'
    )}>
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-display">{label}</p>
        {match?.times?.estimatedStartTime && (
          <span className="text-[10px] text-muted-foreground font-mono">{formatTime(match.times.estimatedStartTime)}</span>
        )}
      </div>
      {match ? (
        <>
          <p className="text-3xl font-display mt-0.5">{match.label}</p>
          <div className="mt-1.5 space-y-0.5 text-xs">
            <TeamLine teams={match.redTeams} myTeam={myTeam} color="red" />
            <TeamLine teams={match.blueTeams} myTeam={myTeam} color="blue" />
          </div>
          {impact && (
            <div className={cn(
              'mt-2 rounded border px-2 py-1 text-[10px] font-mono uppercase tracking-wider flex items-center justify-between gap-2',
              impact.isRed ? 'border-alliance-red/40 bg-alliance-red/10' : 'border-alliance-blue/40 bg-alliance-blue/10'
            )}>
              <span className="text-muted-foreground">Your impact</span>
              <span className="font-display text-foreground">
                +{impact.delta.toFixed(0)} <span className="text-muted-foreground">({impact.pct.toFixed(0)}%)</span>
              </span>
            </div>
          )}
        </>
      ) : (
        <p className="text-3xl font-display mt-0.5 text-muted-foreground">—</p>
      )}
    </div>
  );
}

function TeamLine({ teams, myTeam, color }: { teams: string[]; myTeam: string; color: 'red' | 'blue' }) {
  const dotClass = color === 'red' ? 'bg-alliance-red' : 'bg-alliance-blue';
  return (
    <div className="flex items-center gap-1.5 font-mono flex-wrap">
      <span className={cn('w-2 h-2 rounded-full', dotClass)} />
      {teams.map((t, i) => {
        const isMe = t === myTeam;
        return (
          <span
            key={`${t}-${i}`}
            className={cn(
              'px-1',
              isMe ? 'font-bold text-foreground bg-primary/30 rounded' : 'text-muted-foreground'
            )}
          >
            {t}
          </span>
        );
      })}
    </div>
  );
}

function MatchRow({ match, myTeam, predictions }: { match: NexusMatch; myTeam: string; predictions: Map<number, TeamPrediction> }) {
  const hasMyTeam = myTeam && [...match.redTeams, ...match.blueTeams].includes(myTeam);
  const time = match.times?.estimatedStartTime;
  const sumAlliance = (teams: string[]) =>
    teams.reduce((s, t) => s + (predictions.get(parseInt(t))?.predictedTotal ?? 0), 0);
  const redPred = sumAlliance(match.redTeams);
  const bluePred = sumAlliance(match.blueTeams);
  const havePred = redPred > 0 || bluePred > 0;

  return (
    <div className={cn(
      'rounded-md border px-2.5 py-1.5 grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 transition-all',
      hasMyTeam ? 'border-primary bg-primary/10 shadow-[0_0_10px_hsl(var(--primary)/0.25)]' : 'border-border bg-muted/15'
    )}>
      <div className="flex items-center gap-1.5 min-w-[60px]">
        <span className={cn('font-display text-base', hasMyTeam && 'text-primary')}>{match.label}</span>
        {match.replayOf && (
          <span className="text-[8px] uppercase px-1 py-0.5 rounded bg-secondary/30 text-secondary font-display">R</span>
        )}
      </div>
      <AllianceRowCell teams={match.redTeams} myTeam={myTeam} color="red" pred={redPred} havePred={havePred} />
      <AllianceRowCell teams={match.blueTeams} myTeam={myTeam} color="blue" pred={bluePred} havePred={havePred} />
      <span className="text-[10px] text-muted-foreground font-mono uppercase whitespace-nowrap">
        {match.status === 'Scheduled' || match.status === 'Not started' ? formatTime(time) : match.status}
      </span>
    </div>
  );
}

function AllianceRowCell({ teams, myTeam, color, pred, havePred }: { teams: string[]; myTeam: string; color: 'red' | 'blue'; pred: number; havePred: boolean }) {
  const bg = color === 'red' ? 'bg-alliance-red/10 border-alliance-red/30' : 'bg-alliance-blue/10 border-alliance-blue/30';
  const chipMe = color === 'red' ? 'bg-alliance-red text-white' : 'bg-alliance-blue text-white';
  return (
    <div className={cn('rounded border px-1.5 py-1 flex items-center justify-between gap-2', bg)}>
      <div className="flex flex-wrap gap-1">
        {teams.map((t, i) => (
          <span key={`${t}-${i}`} className={cn(
            'px-1 rounded text-xs font-mono',
            t === myTeam ? `font-bold ${chipMe}` : 'text-foreground/80'
          )}>
            {t}
          </span>
        ))}
      </div>
      {havePred && (
        <span className="text-xs font-display text-foreground">{pred.toFixed(0)}</span>
      )}
    </div>
  );
}

/* Confidence: weighted avg of per-team consistency, scaled down when match counts are low */
function computeConfidence(preds: TeamPrediction[]): number {
  if (preds.length === 0) return 0;
  const totalMatches = preds.reduce((s, p) => s + p.matchCount, 0);
  if (totalMatches === 0) return 0;
  const weighted = preds.reduce((s, p) => s + p.consistency * p.matchCount, 0) / totalMatches;
  const coverage = Math.min(1, totalMatches / (preds.length * 4)); // 4+ matches per team = full
  return Math.round(weighted * coverage);
}

function MatchPredictionCard({ match, predictions, oprMap, pitMap, myTeam }: {
  match: NexusMatch;
  predictions: Map<number, TeamPrediction>;
  oprMap: Map<number, number>;
  pitMap: Map<number, PitRow>;
  myTeam: string;
}) {
  const getStats = (teams: string[]) => {
    const preds = teams.map((t) => predictions.get(parseInt(t))).filter(Boolean) as TeamPrediction[];
    const oprSum = teams.reduce((s, t) => s + (oprMap.get(parseInt(t)) ?? 0), 0);
    const total = preds.reduce((s, p) => s + p.predictedTotal, 0);
    const auto = preds.reduce((s, p) => s + p.predictedAuto, 0);
    const teleop = preds.reduce((s, p) => s + p.predictedTeleop, 0);
    const endgame = preds.reduce((s, p) => s + p.predictedEndgame, 0);
    const confidence = computeConfidence(preds);
    return { total, auto, teleop, endgame, oprSum, preds, confidence };
  };

  const red = getStats(match.redTeams);
  const blue = getStats(match.blueTeams);
  const hasAnyData = red.preds.length > 0 || blue.preds.length > 0 || red.oprSum > 0 || blue.oprSum > 0;
  const redWinning = red.total >= blue.total;
  const margin = Math.abs(red.total - blue.total).toFixed(0);
  const combinedConfidence = Math.round((red.confidence + blue.confidence) / 2);

  return (
    <div className="data-card border-l-4 border-primary">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-xs font-display uppercase tracking-[0.2em] flex items-center gap-2 text-primary">
          <Target className="w-3.5 h-3.5" />
          Predicted Score • {match.label}
        </h2>
        <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider">
          {hasAnyData && (
            <span className="text-muted-foreground">
              {redWinning ? <span className="text-alliance-red">RED</span> : <span className="text-alliance-blue">BLUE</span>} +{margin}
            </span>
          )}
          <ConfidenceBar value={combinedConfidence} preds={[...red.preds, ...blue.preds]} />
        </div>
      </div>
      {!hasAnyData ? (
        <p className="text-xs text-muted-foreground">No scouting data yet for teams in this match.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <AlliancePrediction label="Red" stats={red} teams={match.redTeams} myTeam={myTeam} color="red"
            winning={redWinning} predictions={predictions} oprMap={oprMap} pitMap={pitMap} />
          <AlliancePrediction label="Blue" stats={blue} teams={match.blueTeams} myTeam={myTeam} color="blue"
            winning={!redWinning} predictions={predictions} oprMap={oprMap} pitMap={pitMap} />
        </div>
      )}
    </div>
  );
}

function ConfidenceBar({ value, preds }: { value: number; preds?: TeamPrediction[] }) {
  const tone =
    value >= 70 ? 'bg-success text-success-foreground' :
    value >= 40 ? 'bg-warning text-warning-foreground' :
    'bg-destructive text-destructive-foreground';
  const totalMatches = preds?.reduce((s, p) => s + p.matchCount, 0) ?? 0;
  const avgMatches = preds && preds.length ? totalMatches / preds.length : 0;
  const teamsWithData = preds?.filter((p) => p.matchCount > 0).length ?? 0;
  const teamsTotal = preds?.length ?? 0;
  const sampleLabel =
    avgMatches >= 4 ? 'Strong sample' :
    avgMatches >= 2 ? 'Moderate sample' :
    avgMatches > 0 ? 'Small sample' : 'No sample';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 cursor-help">
          <span className="text-muted-foreground">Confidence</span>
          <span className={cn('px-1.5 py-0.5 rounded font-display tracking-wider', tone)}>{value}%</span>
          <Info className="w-3 h-3 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        <p className="font-display uppercase tracking-wider mb-1">Prediction confidence</p>
        <p className="text-muted-foreground mb-1.5">
          Weighted by per-team consistency and scaled down for small sample sizes.
        </p>
        {preds && (
          <ul className="space-y-0.5 font-mono">
            <li>Teams with scouting: <span className="text-foreground">{teamsWithData}/{teamsTotal}</span></li>
            <li>Avg matches scouted: <span className="text-foreground">{avgMatches.toFixed(1)}</span></li>
            <li>Sample: <span className="text-foreground">{sampleLabel}</span></li>
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function AlliancePrediction({ label, stats, teams, myTeam, color, winning, predictions, oprMap, pitMap }: {
  label: string;
  stats: { total: number; auto: number; teleop: number; endgame: number; oprSum: number; confidence: number; preds: TeamPrediction[] };
  teams: string[];
  myTeam: string;
  color: 'red' | 'blue';
  winning: boolean;
  predictions: Map<number, TeamPrediction>;
  oprMap: Map<number, number>;
  pitMap: Map<number, PitRow>;
}) {
  const ringColor = color === 'red' ? 'border-alliance-red' : 'border-alliance-blue';
  const tone = color === 'red' ? 'text-alliance-red' : 'text-alliance-blue';
  return (
    <div className={cn('rounded-lg border-2 p-2.5 bg-muted/10', ringColor, winning && 'shadow-[0_0_18px_hsl(var(--primary)/0.2)]')}>
      <div className="flex items-baseline justify-between mb-2">
        <span className={cn('font-display uppercase text-xs tracking-[0.2em]', tone)}>{label}</span>
        <div className="text-right">
          <span className="font-display text-3xl leading-none">{stats.total.toFixed(0)}</span>
          <p className="text-[9px] text-muted-foreground font-mono uppercase mt-0.5">
            OPR {stats.oprSum.toFixed(0)} • Conf {stats.confidence}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 border-b border-border pb-1.5">
        <div>A <span className="text-foreground font-display text-sm">{stats.auto.toFixed(0)}</span></div>
        <div>T <span className="text-foreground font-display text-sm">{stats.teleop.toFixed(0)}</span></div>
        <div>E <span className="text-foreground font-display text-sm">{stats.endgame.toFixed(0)}</span></div>
        <div>Σ <span className="text-foreground font-display text-sm">{(stats.auto + stats.teleop + stats.endgame).toFixed(0)}</span></div>
      </div>

      <div className="space-y-1">
        {teams.map((t) => (
          <TeamBreakdownRow
            key={t}
            teamNumber={t}
            isMe={t === myTeam}
            prediction={predictions.get(parseInt(t))}
            opr={oprMap.get(parseInt(t))}
            pit={pitMap.get(parseInt(t))}
            color={color}
            allianceTotal={stats.total}
          />
        ))}
      </div>
    </div>
  );
}

function TeamBreakdownRow({ teamNumber, isMe, prediction, opr, pit, color, allianceTotal }: {
  teamNumber: string;
  isMe: boolean;
  prediction?: TeamPrediction;
  opr?: number;
  pit?: PitRow;
  color: 'red' | 'blue';
  allianceTotal?: number;
}) {
  const chipMe = color === 'red' ? 'bg-alliance-red text-white' : 'bg-alliance-blue text-white';
  const deltaPct = prediction && allianceTotal && allianceTotal > 0
    ? (prediction.predictedTotal / allianceTotal) * 100
    : null;
  const teamConfidence = prediction
    ? Math.round(prediction.consistency * Math.min(1, prediction.matchCount / 4))
    : 0;
  const confTone =
    teamConfidence >= 70 ? 'text-success' :
    teamConfidence >= 40 ? 'text-warning' :
    'text-destructive';

  return (
    <div className={cn(
      'rounded border px-2 py-1.5 grid grid-cols-[64px_1fr_auto] gap-2 items-center text-xs',
      isMe ? 'border-primary bg-primary/15 font-bold' : 'border-border bg-card/60'
    )}>
      <span className={cn('font-mono px-1.5 py-0.5 rounded text-center', isMe && chipMe)}>{teamNumber}</span>
      <div className="flex flex-wrap gap-1 items-center">
        {pit?.scores_motifs && <CapChip icon={Sparkles} label="Motif" />}
        {pit?.scores_artifacts && <CapChip icon={Crosshair} label="Artifact" />}
        {pit?.reliable_auto_leave === 'yes' && <CapChip icon={Zap} label="Leave" tone="success" />}
        {pit?.reliable_auto_leave === 'sometimes' && <CapChip icon={Zap} label="Leave?" tone="warning" />}
        {pit?.endgame_consistency === 'high' && <CapChip icon={ParkingSquare} label="Park" tone="success" />}
        {prediction && prediction.fullReturnRate >= 60 && (
          <CapChip icon={ShieldCheck} label={`Full ${prediction.fullReturnRate}%`} tone="info" />
        )}
        {!pit && !prediction && (
          <span className="text-[10px] text-muted-foreground italic">No data</span>
        )}
      </div>
      <div className="text-right font-mono text-[10px] text-muted-foreground leading-tight">
        <div>OPR <span className="text-foreground font-display text-sm">{opr !== undefined ? opr.toFixed(1) : '—'}</span></div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help inline-flex items-baseline gap-1 justify-end">
              <span>+</span>
              <span className="text-foreground font-display text-sm">{prediction ? prediction.predictedTotal.toFixed(0) : '—'}</span>
              {deltaPct !== null && (
                <span className="text-muted-foreground">({deltaPct.toFixed(0)}%)</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs text-xs">
            <p className="font-display uppercase tracking-wider mb-1">Team {teamNumber} contribution</p>
            {prediction ? (
              <ul className="space-y-0.5 font-mono">
                <li>Auto: <span className="text-foreground">{prediction.predictedAuto.toFixed(1)}</span></li>
                <li>Teleop: <span className="text-foreground">{prediction.predictedTeleop.toFixed(1)}</span></li>
                <li>Endgame: <span className="text-foreground">{prediction.predictedEndgame.toFixed(1)}</span></li>
                <li>Total: <span className="text-foreground">{prediction.predictedTotal.toFixed(1)}</span>{deltaPct !== null && ` (${deltaPct.toFixed(0)}% of alliance)`}</li>
                <li>Sample: <span className="text-foreground">{prediction.matchCount} match{prediction.matchCount === 1 ? '' : 'es'}</span></li>
                <li>Confidence: <span className={confTone}>{teamConfidence}%</span></li>
              </ul>
            ) : (
              <p className="text-muted-foreground">No scouting data yet for this team.</p>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function CapChip({ icon: Icon, label, tone = 'default' }: { icon: React.ElementType; label: string; tone?: 'default' | 'success' | 'warning' | 'info' }) {
  const tones = {
    default: 'bg-muted text-foreground border-border',
    success: 'bg-success/20 text-success border-success/40',
    warning: 'bg-warning/20 text-warning border-warning/40',
    info: 'bg-primary/15 text-primary border-primary/40',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-display uppercase tracking-wider', tones[tone])}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

function TeamCapabilitiesPanel({ title, match, predictions, pitMap, oprMap, myTeam }: {
  title: string;
  match: NexusMatch;
  predictions: Map<number, TeamPrediction>;
  pitMap: Map<number, PitRow>;
  oprMap: Map<number, number>;
  myTeam: string;
}) {
  const allTeams = [...match.redTeams.map((t) => ({ t, color: 'red' as const })),
                    ...match.blueTeams.map((t) => ({ t, color: 'blue' as const }))];
  return (
    <div className="data-card">
      <SectionTitle icon={Flame} label={title} tone="primary" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
        {allTeams.map(({ t, color }) => (
          <TeamInsightCard
            key={`${title}-${t}`}
            teamNumber={t}
            isMe={t === myTeam}
            color={color}
            prediction={predictions.get(parseInt(t))}
            opr={oprMap.get(parseInt(t))}
            pit={pitMap.get(parseInt(t))}
          />
        ))}
      </div>
    </div>
  );
}

function TeamInsightCard({ teamNumber, isMe, color, prediction, opr, pit }: {
  teamNumber: string;
  isMe: boolean;
  color: 'red' | 'blue';
  prediction?: TeamPrediction;
  opr?: number;
  pit?: PitRow;
}) {
  const tone = color === 'red' ? 'border-l-alliance-red' : 'border-l-alliance-blue';
  return (
    <div className={cn(
      'rounded-md border-l-4 border border-border bg-card p-2.5',
      tone,
      isMe && 'ring-2 ring-primary'
    )}>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-xl">{teamNumber}</span>
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          OPR <span className="text-foreground">{opr !== undefined ? opr.toFixed(1) : '—'}</span>
        </span>
      </div>
      {pit?.team_name && <p className="text-[11px] text-muted-foreground truncate">{pit.team_name}</p>}

      <div className="flex flex-wrap gap-1 mt-1.5">
        {pit?.scores_motifs && <CapChip icon={Sparkles} label="Motifs" />}
        {pit?.scores_artifacts && <CapChip icon={Crosshair} label="Artifacts" />}
        {pit?.reliable_auto_leave === 'yes' && <CapChip icon={Zap} label="Leave" tone="success" />}
        {pit?.reliable_auto_leave === 'sometimes' && <CapChip icon={Zap} label="Leave?" tone="warning" />}
        {pit?.endgame_consistency === 'high' && <CapChip icon={ParkingSquare} label="Park" tone="success" />}
      </div>

      {prediction ? (
        <div className="grid grid-cols-4 gap-1 mt-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <div>Auto <span className="block text-foreground font-display text-sm">{prediction.predictedAuto.toFixed(0)}</span></div>
          <div>Tele <span className="block text-foreground font-display text-sm">{prediction.predictedTeleop.toFixed(0)}</span></div>
          <div>End <span className="block text-foreground font-display text-sm">{prediction.predictedEndgame.toFixed(0)}</span></div>
          <div>Tot <span className="block text-primary font-display text-sm">{prediction.predictedTotal.toFixed(0)}</span></div>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground italic mt-2">No scouting data yet</p>
      )}

      {prediction && prediction.matchCount > 0 && (
        <div className="mt-1.5 flex items-center gap-2 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
          <span>{prediction.matchCount}m</span>
          <span>Lv {prediction.leaveRate}%</span>
          <span>Full {prediction.fullReturnRate}%</span>
          <span className={cn(
            prediction.consistency >= 70 ? 'text-success' :
            prediction.consistency >= 40 ? 'text-warning' : 'text-destructive'
          )}>
            ±{prediction.consistency}%
          </span>
        </div>
      )}
    </div>
  );
}
