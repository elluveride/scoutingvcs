import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFTCRankings, type TeamRanking } from '@/hooks/useFTCRankings';
import { Loader2, RefreshCw, Radio, Trophy, Clock, Activity, Target, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { predictTeam, type TeamPrediction, type MatchEntryLite } from '@/lib/prediction';

interface NexusMatchTimes {
  estimatedQueueTime?: number;
  estimatedOnDeckTime?: number;
  estimatedOnFieldTime?: number;
  estimatedStartTime?: number;
  actualQueueTime?: number;
  actualOnDeckTime?: number;
  actualOnFieldTime?: number;
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

const STATUS_PRIORITY: Record<string, number> = {
  'On field': 0,
  'On deck': 1,
  'Now queuing': 2,
  'Scheduled': 3,
  'Not started': 4,
};

const findByStatus = (matches: NexusMatch[], status: string) =>
  matches.find((m) => m.status === status);

const formatTime = (ms?: number) =>
  !ms ? '—' : new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function PitDisplay() {
  const { user, profile } = useAuth();
  const { currentEvent } = useEvent();
  const { toast } = useToast();
  const { rankings, refetch: refetchRankings } = useFTCRankings();

  const myTeam = profile?.teamNumber ? String(profile.teamNumber) : '';

  const [eventKey, setEventKey] = useState(currentEvent?.code || '');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NexusResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [scoutingEntries, setScoutingEntries] = useState<MatchEntryLite[] & { team_number: number }[] | any[]>([]);

  const fetchNexus = async (key: string, silent = false) => {
    if (!key) return;
    if (!silent) setLoading(true);
    const { data: resp, error } = await supabase.functions.invoke('nexus-pit-display', {
      body: { eventKey: key },
    });
    if (!silent) setLoading(false);
    if (error || resp?.error) {
      if (!silent) {
        toast({
          title: 'Failed to load Nexus data',
          description: resp?.error || error?.message || 'Nexus API request failed',
          variant: 'destructive',
        });
      }
      return;
    }
    setData(resp);
    setLastUpdated(Date.now());
  };

  const fetchScouting = async () => {
    if (!currentEvent?.code) return;
    const { data: entries } = await supabase
      .from('match_entries')
      .select('*')
      .eq('event_code', currentEvent.code)
      .order('match_number', { ascending: true });
    setScoutingEntries(entries || []);
  };

  useEffect(() => {
    if (currentEvent?.code) {
      setEventKey(currentEvent.code);
      fetchNexus(currentEvent.code);
      fetchScouting();
      refetchRankings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.code]);

  // Auto-refresh every 15s
  useEffect(() => {
    if (!eventKey) return;
    const id = setInterval(() => {
      fetchNexus(eventKey, true);
      fetchScouting();
      refetchRankings();
    }, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey]);

  if (!user) return <Navigate to="/auth" replace />;

  const status = data?.status;
  const matches = status?.matches || [];
  const onField = findByStatus(matches, 'On field') || findByStatus(matches, 'In progress');
  const queuing = findByStatus(matches, 'Now queuing');
  const onDeck = findByStatus(matches, 'On deck');

  // Build prediction map from scouting data
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

  const upcoming = useMemo(() => {
    return matches
      .filter((m) => !['Completed', 'On field', 'In progress'].includes(m.status))
      .sort((a, b) => {
        const pa = STATUS_PRIORITY[a.status] ?? 99;
        const pb = STATUS_PRIORITY[b.status] ?? 99;
        if (pa !== pb) return pa - pb;
        return (a.times?.estimatedStartTime || 0) - (b.times?.estimatedStartTime || 0);
      })
      .slice(0, 6);
  }, [matches]);

  const myRanking: TeamRanking | undefined = useMemo(() => {
    if (!myTeam) return undefined;
    return rankings.find((r) => String(r.teamNumber) === myTeam);
  }, [rankings, myTeam]);

  const myPitAddress = myTeam && data?.pitAddresses ? data.pitAddresses[myTeam] : undefined;
  const myPrediction = myTeam ? teamPredictions.get(parseInt(myTeam)) : undefined;

  return (
    <AppLayout>
      <PageHeader title="Pit Display" description="Live event status, rankings & score predictions" />

      <div className="space-y-4">
        {/* Top control row */}
        <div className="data-card border-l-4 border-primary">
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="eventKey" className="text-xs uppercase tracking-wider text-muted-foreground">
                Event
              </Label>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-display text-xl text-foreground">
                  {currentEvent?.name || 'No event'}
                </span>
                <Input
                  id="eventKey"
                  value={eventKey}
                  onChange={(e) => setEventKey(e.target.value)}
                  placeholder="Nexus event key"
                  className="h-9 font-mono w-40"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1 text-right">
              {myTeam && (
                <p className="text-xs text-muted-foreground">
                  Team <span className="font-mono font-bold text-primary text-base">{myTeam}</span>
                  {myPitAddress && <> • Pit <span className="font-mono font-bold">{myPitAddress}</span></>}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={() => { fetchNexus(eventKey); fetchScouting(); refetchRankings(); }}
                  disabled={!eventKey || loading}
                  size="sm"
                  className="h-9 gap-2"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Refresh
                </Button>
              </div>
            </div>
          </div>
          {lastUpdated && (
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-2 font-mono uppercase tracking-wider">
              <Radio className="w-3 h-3 text-green-500 animate-pulse" />
              Updated {formatTime(lastUpdated)} • Auto 15s • via{' '}
              <a href="https://ftc.nexus" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                ftc.nexus
              </a>
            </p>
          )}
        </div>

        {/* Match status: On field / Queuing / On deck */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatusCard label="On Field" match={onField} myTeam={myTeam} variant="active" />
          <StatusCard label="Queuing" match={queuing} myTeam={myTeam} variant="warning" />
          <StatusCard label="On Deck" match={onDeck} myTeam={myTeam} variant="info" />
        </div>

        {/* PREDICTED SCORE for the current on-field match */}
        {onField && (
          <MatchPredictionCard match={onField} predictions={teamPredictions} myTeam={myTeam} />
        )}

        {loading && !data && (
          <div className="data-card"><Skeleton className="w-full h-48" /></div>
        )}

        {/* Main grid: rankings | upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Event Rankings */}
          <div className="data-card">
            <h2 className="text-sm font-display uppercase tracking-wider mb-3 flex items-center gap-2 text-secondary">
              <Trophy className="w-4 h-4" />
              Event Rankings
            </h2>
            {myRanking && (
              <div className="mb-3 grid grid-cols-3 gap-2">
                <MiniStat label="Record" value={`${myRanking.wins}-${myRanking.losses}-${myRanking.ties}`} highlight />
                <MiniStat label="Rank" value={`#${myRanking.rank}`} highlight />
                <MiniStat label="RP Avg" value={myRanking.rankingPoints?.toFixed(1) ?? '—'} highlight />
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] text-muted-foreground border-b border-border uppercase tracking-wider font-display">
                    <th className="py-1.5 px-2">#</th>
                    <th className="py-1.5 px-2">Team</th>
                    <th className="py-1.5 px-2 text-right">RP</th>
                    <th className="py-1.5 px-2 text-right">Rec</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.slice(0, 14).map((r) => {
                    const isMe = String(r.teamNumber) === myTeam;
                    return (
                      <tr
                        key={r.teamNumber}
                        className={cn(
                          'border-b border-border/40 transition-colors',
                          isMe && 'bg-primary/15 font-bold'
                        )}
                      >
                        <td className="py-1.5 px-2 font-mono">{r.rank}</td>
                        <td className="py-1.5 px-2 font-mono">{r.teamNumber}</td>
                        <td className="py-1.5 px-2 font-mono text-right">{r.rankingPoints?.toFixed(1) ?? '—'}</td>
                        <td className="py-1.5 px-2 font-mono text-right">{r.wins}-{r.losses}-{r.ties}</td>
                      </tr>
                    );
                  })}
                  {rankings.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-muted-foreground text-sm">No rankings published yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming matches */}
          <div className="data-card">
            <h2 className="text-sm font-display uppercase tracking-wider mb-3 flex items-center gap-2 text-accent">
              <Clock className="w-4 h-4" />
              Upcoming Matches
            </h2>
            <div className="space-y-2">
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
        </div>

        {/* Your Team Scouting Stats panel */}
        {myPrediction && myPrediction.matchCount > 0 && (
          <div className="data-card border-l-4 border-primary">
            <h2 className="text-sm font-display uppercase tracking-wider mb-3 flex items-center gap-2 text-primary">
              <Activity className="w-4 h-4" />
              Team {myTeam} • Scouting Snapshot ({myPrediction.matchCount} matches)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              <MiniStat label="Pred Total" value={myPrediction.predictedTotal.toFixed(1)} highlight />
              <MiniStat label="Auto" value={myPrediction.predictedAuto.toFixed(1)} />
              <MiniStat label="Teleop" value={myPrediction.predictedTeleop.toFixed(1)} />
              <MiniStat label="Endgame" value={myPrediction.predictedEndgame.toFixed(1)} />
              <MiniStat label="Consistency" value={`${myPrediction.consistency}%`} />
              <MiniStat label="Leave %" value={`${myPrediction.leaveRate}%`} />
            </div>
          </div>
        )}

        {/* Announcements */}
        {status?.announcements && status.announcements.length > 0 && (
          <div className="data-card">
            <h2 className="text-sm font-display uppercase tracking-wider mb-3">Announcements</h2>
            <div className="space-y-2">
              {status.announcements.map((a) => (
                <div key={a.id} className="p-3 rounded-lg bg-muted/40 border-l-4 border-secondary">
                  <p className="text-sm">{a.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono uppercase">{formatTime(a.postedTime)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

/*──────────────────────────────────────────────────────────────
  Subcomponents
──────────────────────────────────────────────────────────────*/

function MiniStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-md border px-3 py-2',
      highlight ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/20'
    )}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">{label}</p>
      <p className="font-display text-xl">{value}</p>
    </div>
  );
}

function StatusCard({
  label,
  match,
  myTeam,
  variant,
}: {
  label: string;
  match?: NexusMatch;
  myTeam: string;
  variant: 'active' | 'warning' | 'info';
}) {
  const styles = {
    active: 'border-primary bg-primary/10',
    warning: 'border-secondary bg-secondary/10',
    info: 'border-accent bg-accent/10',
  }[variant];

  const hasMyTeam = myTeam && match && [...match.redTeams, ...match.blueTeams].includes(myTeam);

  return (
    <div className={cn(
      'rounded-lg border-l-4 p-4 bg-card border border-border',
      styles,
      hasMyTeam && 'ring-2 ring-primary shadow-[0_0_18px_hsl(var(--primary)/0.35)]'
    )}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">{label}</p>
      {match ? (
        <>
          <p className="text-4xl font-display mt-0.5">{match.label}</p>
          <div className="mt-2 space-y-0.5 text-xs">
            <TeamLine teams={match.redTeams} myTeam={myTeam} color="red" />
            <TeamLine teams={match.blueTeams} myTeam={myTeam} color="blue" />
          </div>
          {match.times?.estimatedStartTime && (
            <p className="text-[10px] text-muted-foreground mt-2 font-mono uppercase">
              {formatTime(match.times.estimatedStartTime)}
            </p>
          )}
        </>
      ) : (
        <p className="text-4xl font-display mt-0.5 text-muted-foreground">—</p>
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

function MatchRow({
  match,
  myTeam,
  predictions,
}: {
  match: NexusMatch;
  myTeam: string;
  predictions: Map<number, TeamPrediction>;
}) {
  const hasMyTeam = myTeam && [...match.redTeams, ...match.blueTeams].includes(myTeam);
  const time = match.times?.estimatedStartTime;

  const sumAlliance = (teams: string[]) =>
    teams.reduce((s, t) => s + (predictions.get(parseInt(t))?.predictedTotal ?? 0), 0);
  const redPred = sumAlliance(match.redTeams);
  const bluePred = sumAlliance(match.blueTeams);
  const havePred = redPred > 0 || bluePred > 0;

  return (
    <div className={cn(
      'rounded-lg border p-3 transition-all',
      hasMyTeam ? 'border-primary bg-primary/10 shadow-[0_0_12px_hsl(var(--primary)/0.3)]' : 'border-border bg-muted/20'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn('font-display text-lg', hasMyTeam && 'text-primary')}>{match.label}</span>
          {match.replayOf && (
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-secondary/30 text-secondary font-display">Replay</span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono uppercase">{formatTime(time)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm font-mono">
        <AllianceCell teams={match.redTeams} myTeam={myTeam} color="red" pred={redPred} havePred={havePred} />
        <AllianceCell teams={match.blueTeams} myTeam={myTeam} color="blue" pred={bluePred} havePred={havePred} />
      </div>
    </div>
  );
}

function AllianceCell({
  teams, myTeam, color, pred, havePred,
}: {
  teams: string[]; myTeam: string; color: 'red' | 'blue'; pred: number; havePred: boolean;
}) {
  const bg = color === 'red' ? 'bg-alliance-red/15 border-alliance-red/40' : 'bg-alliance-blue/15 border-alliance-blue/40';
  const chipMe = color === 'red' ? 'bg-alliance-red text-white' : 'bg-alliance-blue text-white';
  return (
    <div className={cn('rounded border p-2', bg)}>
      <div className="flex flex-wrap gap-1 items-center">
        {teams.map((t, i) => (
          <span key={`${t}-${i}`} className={cn(
            'px-1.5 py-0.5 rounded text-xs',
            t === myTeam ? `font-bold ${chipMe}` : 'text-foreground/80'
          )}>
            {t}
          </span>
        ))}
      </div>
      {havePred && (
        <p className="text-[10px] mt-1 font-display text-muted-foreground uppercase tracking-wider">
          Pred <span className="text-foreground">{pred.toFixed(0)}</span>
        </p>
      )}
    </div>
  );
}

function MatchPredictionCard({
  match,
  predictions,
  myTeam,
}: {
  match: NexusMatch;
  predictions: Map<number, TeamPrediction>;
  myTeam: string;
}) {
  const getStats = (teams: string[]) => {
    const preds = teams.map((t) => predictions.get(parseInt(t))).filter(Boolean) as TeamPrediction[];
    const total = preds.reduce((s, p) => s + p.predictedTotal, 0);
    const auto = preds.reduce((s, p) => s + p.predictedAuto, 0);
    const teleop = preds.reduce((s, p) => s + p.predictedTeleop, 0);
    const endgame = preds.reduce((s, p) => s + p.predictedEndgame, 0);
    const matches = preds.reduce((s, p) => s + p.matchCount, 0);
    return { total, auto, teleop, endgame, matches, preds };
  };

  const red = getStats(match.redTeams);
  const blue = getStats(match.blueTeams);
  const hasAnyData = red.matches > 0 || blue.matches > 0;

  if (!hasAnyData) {
    return (
      <div className="data-card border-l-4 border-muted">
        <h2 className="text-sm font-display uppercase tracking-wider mb-1 flex items-center gap-2 text-muted-foreground">
          <Target className="w-4 h-4" />
          Predicted Score • {match.label}
        </h2>
        <p className="text-xs text-muted-foreground">No scouting data yet for teams in this match.</p>
      </div>
    );
  }

  const redWinning = red.total > blue.total;
  const margin = Math.abs(red.total - blue.total).toFixed(0);

  return (
    <div className="data-card border-l-4 border-primary">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-display uppercase tracking-wider flex items-center gap-2 text-primary">
          <Target className="w-4 h-4" />
          Predicted Score • {match.label}
        </h2>
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          {redWinning ? 'Red' : 'Blue'} +{margin}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <AlliancePrediction label="Red" stats={red} teams={match.redTeams} myTeam={myTeam} color="red" winning={redWinning} />
        <AlliancePrediction label="Blue" stats={blue} teams={match.blueTeams} myTeam={myTeam} color="blue" winning={!redWinning} />
      </div>
    </div>
  );
}

function AlliancePrediction({
  label, stats, teams, myTeam, color, winning,
}: {
  label: string;
  stats: { total: number; auto: number; teleop: number; endgame: number; matches: number; preds: TeamPrediction[] };
  teams: string[];
  myTeam: string;
  color: 'red' | 'blue';
  winning: boolean;
}) {
  const ringColor = color === 'red' ? 'border-alliance-red' : 'border-alliance-blue';
  const tone = color === 'red' ? 'text-alliance-red' : 'text-alliance-blue';
  return (
    <div className={cn(
      'rounded-lg border-2 p-3 bg-muted/10',
      ringColor,
      winning && 'shadow-[0_0_18px_hsl(var(--primary)/0.25)]'
    )}>
      <div className="flex items-baseline justify-between">
        <span className={cn('font-display uppercase text-xs tracking-wider', tone)}>{label}</span>
        <span className="font-display text-4xl">{stats.total.toFixed(0)}</span>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {teams.map((t, i) => {
          const p = stats.preds.find(pp => pp.teamNumber === parseInt(t));
          const isMe = t === myTeam;
          return (
            <div
              key={`${t}-${i}`}
              className={cn(
                'rounded px-2 py-1 text-xs font-mono border',
                isMe ? 'bg-primary/20 border-primary font-bold' : 'bg-card border-border'
              )}
            >
              <span>{t}</span>
              {p && <span className="ml-1 text-muted-foreground">({p.predictedTotal.toFixed(0)})</span>}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-1 mt-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <div>A <span className="text-foreground font-display text-sm">{stats.auto.toFixed(0)}</span></div>
        <div>T <span className="text-foreground font-display text-sm">{stats.teleop.toFixed(0)}</span></div>
        <div>E <span className="text-foreground font-display text-sm">{stats.endgame.toFixed(0)}</span></div>
      </div>
    </div>
  );
}
