import React, { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useFTCRankings } from '@/hooks/useFTCRankings';
import { Loader2, Plus, X, Bot, Gamepad2, Flag, TrendingUp } from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Legend,
} from 'recharts';
import { useSeason } from '@/hooks/useSeason';
import { aggregateTeam, type TeamSeasonStats } from '@/lib/seasonScoring';
import { tableColumns } from '@/seasons/fields';

/** One comparison row. The metric list itself comes from the active season. */
interface CompareRow {
  label: string;
  /** Read a team's value for this metric. */
  value: (s: TeamSeasonStats) => number;
  /** Render as a percentage rather than a bare number. */
  percent?: boolean;
  /** Lower is better (fouls), so the "best" highlight flips. */
  lowerIsBetter?: boolean;
  /** Include on the radar overlay, normalised against the best team shown. */
  radar?: boolean;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--alliance-red))', 'hsl(260 60% 60%)'];

export default function TeamCompare() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const { getTeamName } = useFTCRankings();
  const season = useSeason();
  const columns = useMemo(() => tableColumns(season), [season]);
  const [teamInput, setTeamInput] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [teamStats, setTeamStats] = useState<TeamSeasonStats[]>([]);
  const [loading, setLoading] = useState(false);

  const addTeam = () => {
    const num = parseInt(teamInput);
    if (!num || selectedTeams.includes(num) || selectedTeams.length >= 3) return;
    setSelectedTeams([...selectedTeams, num]);
    setTeamInput('');
  };

  const removeTeam = (num: number) => {
    setSelectedTeams(selectedTeams.filter(t => t !== num));
    setTeamStats(teamStats.filter(t => t.teamNumber !== num));
  };

  useEffect(() => {
    if (selectedTeams.length === 0) {
      setTeamStats([]);
      return;
    }
    if (currentEvent) loadStats();
  }, [selectedTeams, currentEvent]);

  if (!user) return <Navigate to="/auth" replace />;
  if (!currentEvent) return <Navigate to="/event-select" replace />;

  const loadStats = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('match_entries')
      .select('*')
      .eq('event_code', currentEvent!.code)
      .in('team_number', selectedTeams);

    if (data) {
      // All averaging and pricing happens in seasonScoring, so this page can
      // never disagree with the Dashboard about what a team is worth.
      setTeamStats(
        selectedTeams.map((teamNumber) =>
          aggregateTeam(
            season,
            teamNumber,
            data.filter((e) => e.team_number === teamNumber) as unknown as Record<string, unknown>[],
          ),
        ),
      );
    }
    setLoading(false);
  };

  /**
   * Comparison metrics for the active season: the phase totals every game has,
   * then one row per scoring element and achievement the season declares.
   */
  const rows: CompareRow[] = [
    { label: 'Matches', value: (s) => s.matchesPlayed },
    { label: 'Avg Total', value: (s) => s.avgTotal, radar: true },
    { label: 'Avg Auto', value: (s) => s.avgAuto, radar: true },
    { label: 'Avg TeleOp', value: (s) => s.avgTeleop, radar: true },
    { label: 'Avg Endgame', value: (s) => s.avgEndgame, radar: true },
    // Column labels are phase-disambiguated: this table has no phase bands, and
    // two rows both reading "Park" would be unreadable.
    ...columns
      .filter((c) => c.type === 'int')
      .map((c): CompareRow => ({ label: `Avg ${c.uniqueShort}`, value: (s) => s.avg[c.key] ?? 0 })),
    ...columns
      .filter((c) => c.type === 'bool')
      .map((c): CompareRow => ({
        label: `${c.uniqueShort} %`,
        value: (s) => s.rate[c.key] ?? 0,
        percent: true,
      })),
    ...season.enums
      .filter((e) => e.phase === 'endgame' && !e.key.includes('penalty'))
      .flatMap((e) =>
        e.options
          .filter((o) => (season.points.ENDGAME[o.value] ?? 0) > 0)
          .map((o): CompareRow => ({
            label: `${o.label} %`,
            value: (s) => s.rate[`${e.key}:${o.value}`] ?? 0,
            percent: true,
          })),
      ),
    { label: 'Defense', value: (s) => s.avgDefense, radar: true },
    { label: 'Consistency %', value: (s) => s.consistency, percent: true, radar: true },
    { label: 'Failure %', value: (s) => s.penaltyRate, percent: true, lowerIsBetter: true },
    { label: 'Fouls → opponent', value: (s) => s.avgFoulsGiven, lowerIsBetter: true },
  ];

  /**
   * Radar overlay. Each axis is scaled to the best team shown (0–100), because
   * raw points would let one 20-point element swamp every other axis.
   */
  const radarData = rows
    .filter((r) => r.radar)
    .map((r) => {
      const values = teamStats.map((t) => r.value(t));
      const peak = Math.max(1, ...values);
      return {
        metric: r.label.replace(/^Avg /, ''),
        ...Object.fromEntries(
          teamStats.map((t, i) => [t.teamNumber, Math.round((values[i] / peak) * 100)]),
        ),
      };
    });

  return (
    <AppLayout>
      <PageHeader
        title="Compare Teams"
        description={`Side-by-side comparison, scored with ${season.name} point values`}
      />

      {/* Team Selector */}
      <div className="data-card mb-6">
        <div className="flex gap-2 mb-3">
          <Input
            value={teamInput}
            onChange={(e) => setTeamInput(e.target.value)}
            placeholder="Enter team number"
            type="number"
            className="h-12 font-mono flex-1"
            onKeyDown={(e) => e.key === 'Enter' && addTeam()}
          />
          <Button
            onClick={addTeam}
            disabled={selectedTeams.length >= 3 || !teamInput}
            className="h-12 gap-2"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedTeams.map((num, i) => (
            <span
              key={num}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono font-semibold border"
              style={{ borderColor: COLORS[i], color: COLORS[i] }}
            >
              {num}
              {getTeamName(num) && <span className="text-xs font-sans font-normal text-muted-foreground">{getTeamName(num)}</span>}
              <button onClick={() => removeTeam(num)} className="hover:opacity-70">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          {selectedTeams.length === 0 && (
            <p className="text-sm text-muted-foreground">Add up to 3 teams to compare</p>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {teamStats.length > 0 && !loading && (
        <div className="space-y-6">
          {/* Stats Table */}
          <div className="data-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-mono">Metric</th>
                  {teamStats.map((t, i) => (
                    <th key={t.teamNumber} className="text-center py-2 px-3" style={{ color: COLORS[i] }}>
                      <span className="font-mono font-bold">{t.teamNumber}</span>
                      {getTeamName(t.teamNumber) && <div className="text-xs font-sans font-normal text-muted-foreground">{getTeamName(t.teamNumber)}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono">
                {rows.map((row) => {
                  const values = teamStats.map((t) => row.value(t));
                  const best = row.lowerIsBetter ? Math.min(...values) : Math.max(...values);
                  const uniqueBest = values.filter((v) => v === best).length === 1;
                  return (
                    <tr key={row.label} className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">{row.label}</td>
                      {teamStats.map((t, i) => (
                        <td
                          key={t.teamNumber}
                          className={`text-center py-2 px-3 ${values[i] === best && uniqueBest ? 'font-bold text-foreground' : ''}`}
                        >
                          {row.percent ? `${values[i]}%` : values[i]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Radar Comparison */}
          <div className="data-card">
            <h3 className="font-display text-lg mb-4">Profile Overlay</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(220 15% 20%)" />
                  <PolarAngleAxis dataKey="metric" stroke="hsl(220 10% 55%)" fontSize={11} />
                  <PolarRadiusAxis stroke="hsl(220 15% 20%)" fontSize={10} />
                  {teamStats.map((t, i) => (
                    <Radar
                      key={t.teamNumber}
                      name={`Team ${t.teamNumber}`}
                      dataKey={t.teamNumber}
                      stroke={COLORS[i]}
                      fill={COLORS[i]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
