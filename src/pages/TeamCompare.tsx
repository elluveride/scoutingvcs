import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, X, Bot, Gamepad2, Flag, TrendingUp } from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Legend,
} from 'recharts';

interface TeamCompareStats {
  teamNumber: number;
  matchesPlayed: number;
  avgAutoClose: number;
  avgAutoFar: number;
  avgAutoTotal: number;
  avgTeleopClose: number;
  avgTeleopFar: number;
  avgTeleopTotal: number;
  avgDefense: number;
  liftPercent: number;
  fullReturnPercent: number;
  avgFouls: number;
  avgTotal: number;
}

const COLORS = ['hsl(210 100% 50%)', 'hsl(0 85% 55%)', 'hsl(260 60% 60%)'];

export default function TeamCompare() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const [teamInput, setTeamInput] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [teamStats, setTeamStats] = useState<TeamCompareStats[]>([]);
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
      const stats: TeamCompareStats[] = selectedTeams.map(teamNumber => {
        const entries = data.filter(e => e.team_number === teamNumber);
        const n = entries.length || 1;
        const sum = (fn: (e: any) => number) => entries.reduce((s, e) => s + fn(e), 0) / n;
        const round = (v: number) => Math.round(v * 10) / 10;

        return {
          teamNumber,
          matchesPlayed: entries.length,
          avgAutoClose: round(sum(e => e.auto_scored_close)),
          avgAutoFar: round(sum(e => e.auto_scored_far)),
          avgAutoTotal: round(sum(e => e.auto_scored_close + e.auto_scored_far)),
          avgTeleopClose: round(sum(e => e.teleop_scored_close)),
          avgTeleopFar: round(sum(e => e.teleop_scored_far)),
          avgTeleopTotal: round(sum(e => e.teleop_scored_close + e.teleop_scored_far)),
          avgDefense: round(sum(e => e.defense_rating)),
          liftPercent: entries.length > 0 ? Math.round((entries.filter(e => e.endgame_return === 'lift').length / n) * 100) : 0,
          fullReturnPercent: entries.length > 0 ? Math.round((entries.filter(e => e.endgame_return === 'full').length / n) * 100) : 0,
          avgFouls: round(sum(e => e.auto_fouls_minor)),
          avgTotal: round(sum(e => e.auto_scored_close + e.auto_scored_far + e.teleop_scored_close + e.teleop_scored_far)),
        };
      });
      setTeamStats(stats);
    }
    setLoading(false);
  };

  const radarData = [
    { metric: 'Auto Close', ...Object.fromEntries(teamStats.map(t => [t.teamNumber, t.avgAutoClose])) },
    { metric: 'Auto Far', ...Object.fromEntries(teamStats.map(t => [t.teamNumber, t.avgAutoFar])) },
    { metric: 'Teleop Close', ...Object.fromEntries(teamStats.map(t => [t.teamNumber, t.avgTeleopClose])) },
    { metric: 'Teleop Far', ...Object.fromEntries(teamStats.map(t => [t.teamNumber, t.avgTeleopFar])) },
    { metric: 'Defense', ...Object.fromEntries(teamStats.map(t => [t.teamNumber, t.avgDefense])) },
    { metric: 'Endgame', ...Object.fromEntries(teamStats.map(t => [t.teamNumber, t.liftPercent / 33.3])) },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Compare Teams"
        description="Side-by-side team comparison for alliance selection"
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
                    <th key={t.teamNumber} className="text-center py-2 px-3 font-mono font-bold" style={{ color: COLORS[i] }}>
                      {t.teamNumber}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono">
                {[
                  { label: 'Matches', key: 'matchesPlayed' },
                  { label: 'Avg Auto', key: 'avgAutoTotal' },
                  { label: 'Avg TeleOp', key: 'avgTeleopTotal' },
                  { label: 'Avg Total', key: 'avgTotal' },
                  { label: 'Auto Close', key: 'avgAutoClose' },
                  { label: 'Auto Far', key: 'avgAutoFar' },
                  { label: 'TeleOp Close', key: 'avgTeleopClose' },
                  { label: 'TeleOp Far', key: 'avgTeleopFar' },
                  { label: 'Defense', key: 'avgDefense' },
                  { label: 'Lift %', key: 'liftPercent' },
                  { label: 'Full Return %', key: 'fullReturnPercent' },
                  { label: 'Avg Fouls', key: 'avgFouls' },
                ].map(row => {
                  const values = teamStats.map(t => (t as any)[row.key] as number);
                  const best = Math.max(...values);
                  return (
                    <tr key={row.key} className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">{row.label}</td>
                      {teamStats.map((t, i) => {
                        const val = (t as any)[row.key] as number;
                        const isBest = val === best && values.filter(v => v === best).length === 1;
                        return (
                          <td key={t.teamNumber} className={`text-center py-2 px-3 ${isBest ? 'font-bold text-foreground' : ''}`}>
                            {row.key.includes('Percent') ? `${val}%` : val}
                          </td>
                        );
                      })}
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
