import React, { useState, useEffect } from 'react';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Bot, Gamepad2, Flag, TrendingUp, MessageSquare, Map } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { StatCard } from '@/components/team-detail/TeamStatCards';
import { MatchLogTable } from '@/components/team-detail/MatchLogTable';
import { AutoPathsViewer } from '@/components/team-detail/AutoPathsViewer';
import type { DrawnPath } from '@/components/pit-scout/DrawableFieldMap';

interface MatchEntry {
  match_number: number;
  auto_scored_close: number;
  auto_scored_far: number;
  auto_fouls_minor: number;
  on_launch_line: boolean;
  teleop_scored_close: number;
  teleop_scored_far: number;
  defense_rating: number;
  endgame_return: string;
  penalty_status: string;
  notes: string;
  created_at: string;
}

export default function TeamDetail() {
  const { user, profile } = useAuth();
  const { currentEvent } = useEvent();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const teamNumber = searchParams.get('team');

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

  const chartData = entries.map(e => ({
    match: `M${e.match_number}`,
    autoClose: e.auto_scored_close,
    autoFar: e.auto_scored_far,
    autoTotal: e.auto_scored_close + e.auto_scored_far,
    teleopClose: e.teleop_scored_close,
    teleopFar: e.teleop_scored_far,
    teleopTotal: e.teleop_scored_close + e.teleop_scored_far,
    total: e.auto_scored_close + e.auto_scored_far + e.teleop_scored_close + e.teleop_scored_far,
    fouls: e.auto_fouls_minor,
    defense: e.defense_rating,
  }));

  const avg = (fn: (e: MatchEntry) => number) =>
    entries.length > 0
      ? Math.round((entries.reduce((s, e) => s + fn(e), 0) / entries.length) * 10) / 10
      : 0;

  const radarData = [
    { metric: 'Auto Close', value: avg(e => e.auto_scored_close), max: 10 },
    { metric: 'Auto Far', value: avg(e => e.auto_scored_far), max: 10 },
    { metric: 'Teleop Close', value: avg(e => e.teleop_scored_close), max: 10 },
    { metric: 'Teleop Far', value: avg(e => e.teleop_scored_far), max: 10 },
    { metric: 'Defense', value: avg(e => e.defense_rating), max: 3 },
    {
      metric: 'Endgame',
      value: avg(e => (e.endgame_return === 'lift' ? 3 : e.endgame_return === 'full' ? 2 : e.endgame_return === 'partial' ? 1 : 0)),
      max: 3,
    },
  ];

  const endgameCounts = {
    lift: entries.filter(e => e.endgame_return === 'lift').length,
    full: entries.filter(e => e.endgame_return === 'full').length,
    partial: entries.filter(e => e.endgame_return === 'partial').length,
    none: entries.filter(e => e.endgame_return === 'not_returned').length,
  };

  const endgameBarData = [
    { status: 'Lift', count: endgameCounts.lift },
    { status: 'Full', count: endgameCounts.full },
    { status: 'Partial', count: endgameCounts.partial },
    { status: 'None', count: endgameCounts.none },
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
        title={`Team ${teamNumber}`}
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
            <StatCard icon={Bot} label="Avg Auto" value={avg(e => e.auto_scored_close + e.auto_scored_far)} color="text-primary" />
            <StatCard icon={Gamepad2} label="Avg TeleOp" value={avg(e => e.teleop_scored_close + e.teleop_scored_far)} color="text-secondary" />
            <StatCard icon={Flag} label="Lift %" value={`${entries.length > 0 ? Math.round((endgameCounts.lift / entries.length) * 100) : 0}%`} color="text-accent" />
            <StatCard icon={TrendingUp} label="Avg Total" value={avg(e => e.auto_scored_close + e.auto_scored_far + e.teleop_scored_close + e.teleop_scored_far)} color="text-foreground" />
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
                  <Line type="monotone" dataKey="autoTotal" name="Auto" stroke="hsl(210 100% 50%)" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="teleopTotal" name="TeleOp" stroke="hsl(0 85% 55%)" strokeWidth={2} dot={{ r: 4 }} />
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
                    <Radar name="Avg" dataKey="value" stroke="hsl(210 100% 50%)" fill="hsl(210 100% 50%)" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Endgame Breakdown */}
            <div className="data-card">
              <h3 className="font-display text-lg mb-4">Endgame Breakdown</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={endgameBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                    <XAxis dataKey="status" stroke="hsl(220 10% 55%)" fontSize={12} />
                    <YAxis stroke="hsl(220 10% 55%)" fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={chartStyle} />
                    <Bar dataKey="count" name="Count" fill="hsl(260 60% 60%)" radius={[6, 6, 0, 0]} />
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

          {/* Per-Match Close/Far Breakdown */}
          <div className="data-card">
            <h3 className="font-display text-lg mb-4">Close vs Far Scoring</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                  <XAxis dataKey="match" stroke="hsl(220 10% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(220 10% 55%)" fontSize={12} />
                  <Tooltip contentStyle={chartStyle} />
                  <Legend />
                  <Bar dataKey="autoClose" name="Auto Close" fill="hsl(210 100% 50%)" stackId="auto" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="autoFar" name="Auto Far" fill="hsl(210 100% 70%)" stackId="auto" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="teleopClose" name="TeleOp Close" fill="hsl(0 85% 55%)" stackId="teleop" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="teleopFar" name="TeleOp Far" fill="hsl(0 85% 75%)" stackId="teleop" radius={[6, 6, 0, 0]} />
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
