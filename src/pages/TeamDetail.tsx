import React, { useState, useEffect } from 'react';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Bot, Gamepad2, Flag, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { StatCard } from '@/components/team-detail/TeamStatCards';
import { MatchLogTable } from '@/components/team-detail/MatchLogTable';

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
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const teamNumber = searchParams.get('team');

  const [entries, setEntries] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentEvent || !teamNumber) return;
    loadData();
  }, [currentEvent, teamNumber]);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('match_entries')
      .select('*')
      .eq('event_code', currentEvent!.code)
      .eq('team_number', parseInt(teamNumber!))
      .order('match_number', { ascending: true });

    if (data) setEntries(data.map(e => ({ ...e, notes: (e as any).notes || '' })));
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
        </div>
      )}
    </AppLayout>
  );
}
