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
import { Loader2, RefreshCw, Radio, Trophy, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  status: string; // "Scheduled" | "Now queuing" | "On deck" | "On field" | "In progress" | "Completed" | "Not started"
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
}

const STATUS_PRIORITY: Record<string, number> = {
  'On field': 0,
  'On deck': 1,
  'Now queuing': 2,
  'Scheduled': 3,
  'Not started': 4,
};

function findByStatus(matches: NexusMatch[], status: string): NexusMatch | undefined {
  return matches.find((m) => m.status === status);
}

function formatTime(ms?: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

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

  const fetchData = async (key: string, silent = false) => {
    if (!key) return;
    if (!silent) setLoading(true);
    const { data: resp, error } = await supabase.functions.invoke('nexus-pit-display', {
      body: { eventKey: key },
    });
    if (!silent) setLoading(false);
    if (error || resp?.error) {
      if (!silent) {
        toast({
          title: 'Failed to load',
          description: resp?.error || error?.message || 'Nexus API request failed',
          variant: 'destructive',
        });
      }
      return;
    }
    setData(resp);
    setLastUpdated(Date.now());
  };

  useEffect(() => {
    if (currentEvent?.code) {
      setEventKey(currentEvent.code);
      fetchData(currentEvent.code);
      refetchRankings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.code]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!eventKey) return;
    const id = setInterval(() => fetchData(eventKey, true), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey]);

  if (!user) return <Navigate to="/auth" replace />;

  const status = data?.status;
  const matches = status?.matches || [];

  const onField = findByStatus(matches, 'On field') || findByStatus(matches, 'In progress');
  const queuing = findByStatus(matches, 'Now queuing');
  const onDeck = findByStatus(matches, 'On deck');

  // Upcoming = next scheduled matches (not completed/in progress)
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

  const myRanking: TeamRanking | undefined = useMemo(() => {
    if (!myTeam) return undefined;
    return rankings.find((r) => String(r.teamNumber) === myTeam);
  }, [rankings, myTeam]);

  const myPitAddress = myTeam && data?.pitAddresses ? data.pitAddresses[myTeam] : undefined;

  return (
    <AppLayout>
      <PageHeader title="Pit Display" description="Live event status from Nexus" />

      <div className="space-y-6">
        {/* Header row: event key input + refresh */}
        <div className="data-card">
          <div className="flex flex-col md:flex-row gap-4 md:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="eventKey">Nexus Event Key</Label>
              <Input
                id="eventKey"
                value={eventKey}
                onChange={(e) => setEventKey(e.target.value)}
                placeholder="e.g. 2024casf or demo1234"
                className="h-12 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              {myTeam && (
                <p className="text-xs text-muted-foreground">
                  Highlighting Team <span className="font-mono font-bold text-primary">{myTeam}</span>
                  {myPitAddress && <> • Pit <span className="font-mono font-bold">{myPitAddress}</span></>}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={() => { fetchData(eventKey); refetchRankings(); }}
                  disabled={!eventKey || loading}
                  className="h-12 gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Refresh
                </Button>
              </div>
            </div>
          </div>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-2">
              <Radio className="w-3 h-3 text-green-500 animate-pulse" />
              Updated {formatTime(lastUpdated)} • Auto-refresh 30s • Data via{' '}
              <a href="https://ftc.nexus" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                ftc.nexus
              </a>
            </p>
          )}
        </div>

        {/* Status row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusCard label="On Field" match={onField} myTeam={myTeam} accent="primary" />
          <StatusCard label="Queuing" match={queuing} myTeam={myTeam} accent="secondary" />
          <StatusCard label="On Deck" match={onDeck} myTeam={myTeam} accent="accent" />
        </div>

        {loading && !data && (
          <div className="data-card">
            <Skeleton className="w-full h-48" />
          </div>
        )}

        {/* Two-column: rankings + upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My team / Rankings */}
          <div className="data-card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-secondary" />
              Event Rankings
            </h2>
            {myRanking && (
              <div className="mb-4 p-4 rounded-lg bg-primary/10 border border-primary/30">
                <p className="text-xs text-muted-foreground mb-1">Your Team</p>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-2xl font-bold font-mono">#{myRanking.rank}</p>
                    <p className="text-sm text-muted-foreground">{myRanking.teamName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg">{myRanking.wins}-{myRanking.losses}-{myRanking.ties}</p>
                    <p className="text-xs text-muted-foreground">Avg {myRanking.qualAverage?.toFixed(1) ?? '—'}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 px-2 font-medium">#</th>
                    <th className="py-2 px-2 font-medium">Team</th>
                    <th className="py-2 px-2 font-medium text-right">RP</th>
                    <th className="py-2 px-2 font-medium text-right">Rec</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.slice(0, 12).map((r) => {
                    const isMe = String(r.teamNumber) === myTeam;
                    return (
                      <tr
                        key={r.teamNumber}
                        className={cn(
                          'border-b border-border/50',
                          isMe && 'bg-primary/10 font-bold'
                        )}
                      >
                        <td className="py-2 px-2 font-mono">{r.rank}</td>
                        <td className="py-2 px-2 font-mono">{r.teamNumber}</td>
                        <td className="py-2 px-2 font-mono text-right">{r.rankingPoints?.toFixed(1) ?? '—'}</td>
                        <td className="py-2 px-2 font-mono text-right">{r.wins}-{r.losses}-{r.ties}</td>
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
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" />
              Upcoming Matches
            </h2>
            <div className="space-y-3">
              {upcoming.map((m) => (
                <MatchRow key={`${m.label}-${m.replayOf ?? ''}`} match={m} myTeam={myTeam} />
              ))}
              {upcoming.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming matches</p>
              )}
            </div>
          </div>
        </div>

        {/* Announcements */}
        {status?.announcements && status.announcements.length > 0 && (
          <div className="data-card">
            <h2 className="text-lg font-semibold mb-3">Announcements</h2>
            <div className="space-y-2">
              {status.announcements.map((a) => (
                <div key={a.id} className="p-3 rounded-lg bg-muted/40 border-l-4 border-secondary">
                  <p className="text-sm">{a.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatTime(a.postedTime)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function StatusCard({
  label,
  match,
  myTeam,
  accent,
}: {
  label: string;
  match?: NexusMatch;
  myTeam: string;
  accent: 'primary' | 'secondary' | 'accent';
}) {
  const accentClass = {
    primary: 'text-primary border-primary/30 bg-primary/5',
    secondary: 'text-secondary border-secondary/30 bg-secondary/5',
    accent: 'text-accent border-accent/30 bg-accent/5',
  }[accent];

  const hasMyTeam = myTeam && match && [...match.redTeams, ...match.blueTeams].includes(myTeam);

  return (
    <div className={cn('data-card border-l-4', accentClass, hasMyTeam && 'ring-2 ring-primary')}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      {match ? (
        <>
          <p className="text-3xl font-bold font-mono mt-1">{match.label}</p>
          <div className="mt-3 space-y-1 text-sm">
            <TeamLine teams={match.redTeams} myTeam={myTeam} color="red" />
            <TeamLine teams={match.blueTeams} myTeam={myTeam} color="blue" />
          </div>
          {match.times?.estimatedStartTime && (
            <p className="text-xs text-muted-foreground mt-3">
              Est. start {formatTime(match.times.estimatedStartTime)}
            </p>
          )}
        </>
      ) : (
        <p className="text-3xl font-bold font-mono mt-1 text-muted-foreground">—</p>
      )}
    </div>
  );
}

function TeamLine({ teams, myTeam, color }: { teams: string[]; myTeam: string; color: 'red' | 'blue' }) {
  const dotClass = color === 'red' ? 'bg-alliance-red' : 'bg-alliance-blue';
  return (
    <div className="flex items-center gap-2 font-mono">
      <span className={cn('w-2 h-2 rounded-full', dotClass)} />
      {teams.map((t, i) => {
        const isMe = t === myTeam;
        return (
          <span
            key={`${t}-${i}`}
            className={cn(
              isMe ? 'font-bold text-foreground bg-primary/20 px-1.5 rounded' : 'text-muted-foreground'
            )}
          >
            {t}
          </span>
        );
      })}
    </div>
  );
}

function MatchRow({ match, myTeam }: { match: NexusMatch; myTeam: string }) {
  const hasMyTeam = myTeam && [...match.redTeams, ...match.blueTeams].includes(myTeam);
  const time = match.times?.estimatedStartTime;

  return (
    <div className={cn(
      'rounded-lg border p-3 transition-all',
      hasMyTeam ? 'border-primary bg-primary/10 shadow-[0_0_12px_hsl(var(--primary)/0.3)]' : 'border-border bg-muted/20'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn('font-mono font-bold text-lg', hasMyTeam && 'text-primary')}>{match.label}</span>
          {match.replayOf && (
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-secondary/20 text-secondary">Replay</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{formatTime(time)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm font-mono">
        <div className="flex flex-wrap gap-1 items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-alliance-red" />
          {match.redTeams.map((t, i) => (
            <span key={`r-${t}-${i}`} className={cn(
              'px-1.5 py-0.5 rounded',
              t === myTeam ? 'font-bold bg-alliance-red text-white' : 'text-muted-foreground'
            )}>
              {t}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-alliance-blue" />
          {match.blueTeams.map((t, i) => (
            <span key={`b-${t}-${i}`} className={cn(
              'px-1.5 py-0.5 rounded',
              t === myTeam ? 'font-bold bg-alliance-blue text-white' : 'text-muted-foreground'
            )}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
