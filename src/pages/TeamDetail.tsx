import React, { useState, useEffect, useMemo } from 'react';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useFTCRankings } from '@/hooks/useFTCRankings';
import { Loader2, ArrowLeft, Bot, Gamepad2, Flag, TrendingUp, MessageSquare, Map } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { StatCard } from '@/components/team-detail/TeamStatCards';
import { MatchLogTable } from '@/components/team-detail/MatchLogTable';
import { useSeason } from '@/hooks/useSeason';
import { scoreEntry, aggregateTeam } from '@/lib/seasonScoring';
import { tableColumns } from '@/seasons/fields';
import { AutoPathsViewer } from '@/components/team-detail/AutoPathsViewer';
import type { DrawnPath } from '@/components/pit-scout/DrawableFieldMap';

/**
 * One scouted match. Only the shared columns are named — the scoring columns
 * belong to the active season and are read through its config.
 */
interface MatchEntry {
  match_number: number;
  auto_fouls_minor: number;
  auto_fouls_major: number;
  defense_rating: number;
  penalty_status: string;
  notes: string;
  [column: string]: unknown;
}

/** Stacked-series palette; cycles when a season has more elements than colours. */
const ELEMENT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--vcs-silver))',
  'hsl(var(--alliance-blue) / 0.7)',
  'hsl(260 60% 60%)',
  'hsl(142 70% 45%)',
  'hsl(var(--alliance-red) / 0.7)',
];

export default function TeamDetail() {
  const { user, profile } = useAuth();
  const { currentEvent } = useEvent();
  const { getTeamName } = useFTCRankings();
  const season = useSeason();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const teamNumber = searchParams.get('team');
  const teamName = teamNumber ? getTeamName(parseInt(teamNumber)) : null;

  /** Per-element scoring columns for this season, used by the charts below. */
  const elementColumns = useMemo(
    () => tableColumns(season).filter((c) => c.type === 'int'),
    [season],
  );
  /**
   * Toggle columns by key, for their phase-disambiguated labels.
   * A record rather than a Map: lucide-react's `Map` icon shadows the global.
   */
  const toggleLabels = useMemo(
    () => Object.fromEntries(
      tableColumns(season).filter((c) => c.type === 'bool').map((c) => [c.key, c.uniqueShort]),
    ) as Record<string, string>,
    [season],
  );

  const [entries, setEntries] = useState<MatchEntry[]>([]);
  const [autoPaths, setAutoPaths] = useState<DrawnPath[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentEvent || !teamNumber) return;
    loadData();
  }, [currentEvent, teamNumber]);

  const loadData = async () => {
    setLoading(true);
    const [matchResult, pitResult] = await Promise.all([
      supabase
        .from('match_entries')
        .select('*')
        .eq('event_code', currentEvent!.code)
        .eq('team_number', parseInt(teamNumber!))
        .order('match_number', { ascending: true }),
      supabase
        .from('pit_entries')
        .select('auto_paths')
        .eq('event_code', currentEvent!.code)
        .eq('team_number', parseInt(teamNumber!))
        .maybeSingle(),
    ]);

    if (matchResult.data) {
      // Filter to only entries scouted by our team (or allied team)
      const myTeam = profile?.teamNumber;
      let filtered = matchResult.data;

      if (myTeam) {
        const scouterIds = [...new Set(matchResult.data.map(e => e.scouter_id))];
        const { data: scouterProfiles } = await supabase
          .from('profiles')
          .select('id, team_number')
          .in('id', scouterIds);

        const scouterTeamMap: Record<string, number | null> = {};
        scouterProfiles?.forEach(p => { scouterTeamMap[p.id] = p.team_number; });
        

        filtered = matchResult.data.filter(entry => {
          const scouterTeam = scouterTeamMap[entry.scouter_id];
          if (!scouterTeam) return true;
          if (scouterTeam === myTeam) return true;
          if ((myTeam === 12841 && scouterTeam === 2844) || (myTeam === 2844 && scouterTeam === 12841)) return true;
          return false;
        });
      }

      // Deduplicate: keep only the latest entry per match
      const matchGroupsObj: Record<number, typeof filtered> = {};
      filtered.forEach(e => {
        if (!matchGroupsObj[e.match_number]) matchGroupsObj[e.match_number] = [];
        matchGroupsObj[e.match_number].push(e);
      });
      const deduped: typeof filtered = [];
      Object.values(matchGroupsObj).forEach((group) => {
        group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        deduped.push(group[0]);
      });
      deduped.sort((a, b) => a.match_number - b.match_number);

      setEntries(deduped.map(e => ({ ...e, notes: (e as any).notes || '' })));
    }
    if (pitResult.data) {
      const stored = pitResult.data.auto_paths as any;
      if (Array.isArray(stored)) setAutoPaths(stored);
    }
    setLoading(false);
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (!currentEvent) return <Navigate to="/event-select" replace />;
  if (!teamNumber) return <Navigate to="/dashboard" replace />;

  // Every chart below is built from the season config: a new game changes the
  // series and the radar axes without a line of work here.
  const scored = entries.map((e) => ({ entry: e, score: scoreEntry(season, e) }));

  const chartData = scored.map(({ entry, score }) => ({
    match: `M${entry.match_number}`,
    auto: score.auto,
    teleop: score.teleop,
    endgame: score.endgame,
    total: score.total,
    // Per-element counts, keyed by column name, for the stacked breakdown.
    ...Object.fromEntries(elementColumns.map((c) => [c.key, Number(entry[c.key] ?? 0)])),
  }));

  const avg = (fn: (e: MatchEntry) => number) =>
    entries.length > 0
      ? Math.round((entries.reduce((s, e) => s + fn(e), 0) / entries.length) * 10) / 10
      : 0;

  const stats = aggregateTeam(season, parseInt(teamNumber ?? '0', 10), entries as unknown as Record<string, unknown>[]);

  /**
   * Radar axes, normalised to each element's own observed ceiling so one
   * 20-point element doesn't flatten the rest of the shape.
   */
  const radarData = [
    ...elementColumns.map((c) => {
      const value = stats.avg[c.key] ?? 0;
      const observedMax = Math.max(1, ...entries.map((e) => Number(e[c.key] ?? 0)));
      return { metric: c.uniqueShort, value, max: observedMax };
    }),
    ...season.toggles
      .filter((t) => (t.role ?? 'score') === 'score')
      .map((t) => ({
        metric: toggleLabels[t.key] ?? t.label,
        value: (stats.rate[t.key] ?? 0) / 100,
        max: 1,
      })),
    { metric: 'Defense', value: stats.avgDefense, max: 3 },
  ];

  /** Achievement rates — replaces DECODE's fixed lift/full/partial bar chart. */
  const achievementBarData = [
    ...season.toggles
      .filter((t) => (t.role ?? 'score') === 'score')
      .map((t) => ({ status: toggleLabels[t.key] ?? t.label, count: stats.rate[t.key] ?? 0 })),
    ...season.enums
      .filter((e) => e.phase === 'endgame' && !e.key.includes('penalty'))
      .flatMap((e) =>
        e.options
          .filter((o) => (season.points.ENDGAME[o.value] ?? 0) > 0)
          .map((o) => ({ status: o.label, count: stats.rate[`${e.key}:${o.value}`] ?? 0 })),
      ),
  ];

  const chartStyle = {
    background: 'hsl(220 18% 11%)',
    border: '1px solid hsl(220 15% 20%)',
    borderRadius: '0.75rem',
    fontSize: 12,
  };

  return (
    <AppLayout>
      <PageHeader
        title={`Team ${teamNumber}${teamName ? ` – ${teamName}` : ''}`}
        description={`${entries.length} matches at ${currentEvent.name}`}
      >
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <div className="data-card text-center py-12 text-muted-foreground">
          No match data for this team yet.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Bot} label="Avg Auto" value={stats.avgAuto} color="text-primary" />
            <StatCard icon={Gamepad2} label="Avg TeleOp" value={stats.avgTeleop} color="text-secondary" />
            <StatCard icon={Flag} label="Avg Endgame" value={stats.avgEndgame} color="text-accent" />
            <StatCard icon={TrendingUp} label="Avg Total" value={stats.avgTotal} color="text-foreground" />
          </div>

          {/* Scoring Trend */}
          <div className="data-card">
            <h3 className="font-display text-lg mb-4">Scoring Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                  <XAxis dataKey="match" stroke="hsl(220 10% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(220 10% 55%)" fontSize={12} />
                  <Tooltip contentStyle={chartStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="auto" name="Auto" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="teleop" name="TeleOp" stroke="hsl(var(--vcs-silver))" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="total" name="Total" stroke="hsl(260 60% 60%)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Radar Profile */}
            <div className="data-card">
              <h3 className="font-display text-lg mb-4">Team Profile</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(220 15% 20%)" />
                    <PolarAngleAxis dataKey="metric" stroke="hsl(220 10% 55%)" fontSize={11} />
                    <PolarRadiusAxis stroke="hsl(220 15% 20%)" fontSize={10} />
                    <Radar name="Avg" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Endgame Breakdown */}
            <div className="data-card">
              <h3 className="font-display text-lg mb-4">Achievement Rates</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={achievementBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                    <XAxis dataKey="status" stroke="hsl(220 10% 55%)" fontSize={12} />
                    <YAxis stroke="hsl(220 10% 55%)" fontSize={12} allowDecimals={false} unit="%" domain={[0, 100]} />
                    <Tooltip contentStyle={chartStyle} formatter={(v: number) => [`${v}%`, 'Rate']} />
                    <Bar dataKey="count" name="Rate" fill="hsl(260 60% 60%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Autonomous Paths from Pit Scouting */}
          {autoPaths.length > 0 && (
            <div className="data-card">
              <h3 className="font-display text-lg mb-4 flex items-center gap-2">
                <Map className="w-5 h-5 text-secondary" />
                Autonomous Paths
              </h3>
              <AutoPathsViewer paths={autoPaths} />
            </div>
          )}

          {/* Per-match element breakdown. One stacked series per scoring column
              the season declares, so the chart follows the game. */}
          <div className="data-card">
            <h3 className="font-display text-lg mb-4">Scoring by Element</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                  <XAxis dataKey="match" stroke="hsl(220 10% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(220 10% 55%)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={chartStyle} />
                  <Legend />
                  {elementColumns.map((col, i) => (
                    <Bar
                      key={col.key}
                      dataKey={col.key}
                      name={col.uniqueShort}
                      stackId="elements"
                      fill={ELEMENT_COLORS[i % ELEMENT_COLORS.length]}
                      radius={i === elementColumns.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Match-by-Match Log with Notes */}
          <MatchLogTable entries={entries} />

          {/* Scouting Comments */}
          {(() => {
            const notesEntries = entries.filter(e => e.notes && e.notes.trim());
            if (notesEntries.length === 0) return null;
            return (
              <div className="data-card">
                <h3 className="font-display text-lg mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Scouting Comments ({notesEntries.length})
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {notesEntries.map((e, idx) => (
                    <div key={idx} className="flex gap-3 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                      <div className="shrink-0 text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded h-fit">
                        M{e.match_number}
                      </div>
                      <p className="text-sm">{e.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </AppLayout>
  );
}
