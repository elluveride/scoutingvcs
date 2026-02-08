import React, { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useFTCMatches } from '@/hooks/useFTCMatches';
import { PitSection } from '@/components/match-scout/PitSection';
import {
  Loader2, Swords, TrendingUp, Bot, Gamepad2, Flag,
  Calculator, Users, ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

interface TeamScoutData {
  teamNumber: number;
  entries: {
    auto_scored_close: number;
    auto_scored_far: number;
    teleop_scored_close: number;
    teleop_scored_far: number;
    defense_rating: number;
    endgame_return: string;
    on_launch_line: boolean;
    auto_fouls_minor: number;
  }[];
}

interface TeamPrediction {
  teamNumber: number;
  predictedAuto: number;
  predictedTeleop: number;
  predictedTotal: number;
  liftChance: number;
  consistency: number;
  matchCount: number;
}

function predictTeam(data: TeamScoutData): TeamPrediction {
  const { entries, teamNumber } = data;
  if (entries.length === 0) {
    return { teamNumber, predictedAuto: 0, predictedTeleop: 0, predictedTotal: 0, liftChance: 0, consistency: 0, matchCount: 0 };
  }

  // Weight recent matches more heavily (exponential decay)
  const weights = entries.map((_, i) => Math.pow(1.3, i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const weightedAvg = (fn: (e: typeof entries[0]) => number) =>
    entries.reduce((s, e, i) => s + fn(e) * weights[i], 0) / totalWeight;

  const predictedAuto = weightedAvg(e => e.auto_scored_close + e.auto_scored_far);
  const predictedTeleop = weightedAvg(e => e.teleop_scored_close + e.teleop_scored_far);
  const liftChance = entries.filter(e => e.endgame_return === 'lift').length / entries.length;

  // Consistency: inverse of coefficient of variation
  const totals = entries.map(e => e.auto_scored_close + e.auto_scored_far + e.teleop_scored_close + e.teleop_scored_far);
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  const variance = totals.reduce((s, t) => s + Math.pow(t - mean, 2), 0) / totals.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
  const consistency = Math.max(0, Math.round((1 - cv) * 100));

  return {
    teamNumber,
    predictedAuto: Math.round(predictedAuto * 10) / 10,
    predictedTeleop: Math.round(predictedTeleop * 10) / 10,
    predictedTotal: Math.round((predictedAuto + predictedTeleop) * 10) / 10,
    liftChance: Math.round(liftChance * 100),
    consistency,
    matchCount: entries.length,
  };
}

export default function MatchPlanner() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const { matches } = useFTCMatches();

  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState('');

  // Manual team entry for custom matchups
  const [blueTeam1, setBlueTeam1] = useState('');
  const [blueTeam2, setBlueTeam2] = useState('');
  const [redTeam1, setRedTeam1] = useState('');
  const [redTeam2, setRedTeam2] = useState('');

  useEffect(() => {
    if (!currentEvent) return;
    loadAllEntries();
  }, [currentEvent]);

  const loadAllEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('match_entries')
      .select('*')
      .eq('event_code', currentEvent!.code)
      .order('match_number', { ascending: true });
    setAllEntries(data || []);
    setLoading(false);
  };

  // Build predictions for all teams
  const teamPredictions = useMemo(() => {
    const teamMap = new Map<number, any[]>();
    allEntries.forEach(e => {
      const existing = teamMap.get(e.team_number) || [];
      existing.push(e);
      teamMap.set(e.team_number, existing);
    });

    const preds = new Map<number, TeamPrediction>();
    teamMap.forEach((entries, teamNumber) => {
      preds.set(teamNumber, predictTeam({ teamNumber, entries }));
    });
    return preds;
  }, [allEntries]);

  // Auto-fill teams from match schedule
  useEffect(() => {
    if (!selectedMatch || matches.length === 0) return;
    const matchNum = parseInt(selectedMatch);
    const match = matches.find(m => m.matchNumber === matchNum);
    if (!match) return;

    const blues = match.positions.filter(p => p.position.startsWith('B'));
    const reds = match.positions.filter(p => p.position.startsWith('R'));
    if (blues[0]) setBlueTeam1(blues[0].teamNumber.toString());
    if (blues[1]) setBlueTeam2(blues[1].teamNumber.toString());
    if (reds[0]) setRedTeam1(reds[0].teamNumber.toString());
    if (reds[1]) setRedTeam2(reds[1].teamNumber.toString());
  }, [selectedMatch, matches]);

  if (!user) return <Navigate to="/auth" replace />;
  if (!currentEvent) return <Navigate to="/event-select" replace />;

  const getTeamPrediction = (teamStr: string) => {
    const num = parseInt(teamStr);
    if (isNaN(num)) return null;
    return teamPredictions.get(num) || null;
  };

  const bluePreds = [getTeamPrediction(blueTeam1), getTeamPrediction(blueTeam2)].filter(Boolean) as TeamPrediction[];
  const redPreds = [getTeamPrediction(redTeam1), getTeamPrediction(redTeam2)].filter(Boolean) as TeamPrediction[];

  const blueTotal = bluePreds.reduce((s, p) => s + p.predictedTotal, 0);
  const redTotal = redPreds.reduce((s, p) => s + p.predictedTotal, 0);

  const allPreds = [...bluePreds, ...redPreds];

  const comparisonData = allPreds.map(p => ({
    team: `${p.teamNumber}`,
    auto: p.predictedAuto,
    teleop: p.predictedTeleop,
    total: p.predictedTotal,
  }));

  const radarData = [
    { metric: 'Auto', ...Object.fromEntries(allPreds.map(p => [p.teamNumber, p.predictedAuto])) },
    { metric: 'TeleOp', ...Object.fromEntries(allPreds.map(p => [p.teamNumber, p.predictedTeleop])) },
    { metric: 'Lift %', ...Object.fromEntries(allPreds.map(p => [p.teamNumber, p.liftChance / 10])) },
    { metric: 'Consistency', ...Object.fromEntries(allPreds.map(p => [p.teamNumber, p.consistency / 10])) },
  ];

  const radarColors = ['hsl(210 100% 50%)', 'hsl(210 100% 70%)', 'hsl(0 85% 55%)', 'hsl(0 85% 75%)'];

  return (
    <AppLayout>
      <PageHeader
        title="Match Planner"
        description="Predict scores and plan strategy"
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          {/* Match Selection */}
          <PitSection title="Select Match" icon={Swords}>
            <div className="space-y-4">
              {matches.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-mono text-muted-foreground">From Schedule</Label>
                  <select
                    value={selectedMatch}
                    onChange={e => setSelectedMatch(e.target.value)}
                    className="w-full h-12 rounded-xl bg-background border border-border px-4 font-mono text-sm"
                  >
                    <option value="">Select a match...</option>
                    {matches.map(m => (
                      <option key={m.matchNumber} value={m.matchNumber}>
                        Match {m.matchNumber} — {m.positions.map(p => `${p.position}:${p.teamNumber}`).join(', ')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-mono text-alliance-blue font-semibold">Blue Alliance</Label>
                  <Input value={blueTeam1} onChange={e => setBlueTeam1(e.target.value)} placeholder="Team 1" type="number" className="h-12 font-mono" />
                  <Input value={blueTeam2} onChange={e => setBlueTeam2(e.target.value)} placeholder="Team 2" type="number" className="h-12 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-mono text-alliance-red font-semibold">Red Alliance</Label>
                  <Input value={redTeam1} onChange={e => setRedTeam1(e.target.value)} placeholder="Team 1" type="number" className="h-12 font-mono" />
                  <Input value={redTeam2} onChange={e => setRedTeam2(e.target.value)} placeholder="Team 2" type="number" className="h-12 font-mono" />
                </div>
              </div>
            </div>
          </PitSection>

          {/* Score Prediction */}
          {allPreds.length > 0 && (
            <>
              <PitSection title="Score Prediction" icon={Calculator}>
                <div className="grid grid-cols-3 gap-4 items-center">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Blue Alliance</p>
                    <p className="text-4xl font-display font-bold text-alliance-blue">
                      {Math.round(blueTotal)}
                    </p>
                    <div className="flex gap-2 justify-center mt-1 text-xs text-muted-foreground font-mono">
                      {bluePreds.map(p => <span key={p.teamNumber}>{p.teamNumber}</span>)}
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Predicted Winner</p>
                    <div className={`text-2xl font-display font-bold ${blueTotal > redTotal ? 'text-alliance-blue' : blueTotal < redTotal ? 'text-alliance-red' : 'text-muted-foreground'}`}>
                      {blueTotal > redTotal ? 'BLUE' : blueTotal < redTotal ? 'RED' : 'TIE'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Margin: {Math.abs(Math.round(blueTotal - redTotal))}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Red Alliance</p>
                    <p className="text-4xl font-display font-bold text-alliance-red">
                      {Math.round(redTotal)}
                    </p>
                    <div className="flex gap-2 justify-center mt-1 text-xs text-muted-foreground font-mono">
                      {redPreds.map(p => <span key={p.teamNumber}>{p.teamNumber}</span>)}
                    </div>
                  </div>
                </div>
              </PitSection>

              {/* Team Breakdown Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {allPreds.map((pred, i) => (
                  <div key={pred.teamNumber} className="data-card">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${i < bluePreds.length ? 'bg-alliance-blue' : 'bg-alliance-red'}`} />
                      <span className="font-display font-bold">{pred.teamNumber}</span>
                    </div>
                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Auto</span>
                        <span>{pred.predictedAuto}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">TeleOp</span>
                        <span>{pred.predictedTeleop}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lift</span>
                        <span>{pred.liftChance}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Consistency</span>
                        <span>{pred.consistency}%</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Matches</span>
                        <span>{pred.matchCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comparison Chart */}
              <div className="data-card">
                <h3 className="font-display text-lg mb-4">Scoring Comparison</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                      <XAxis dataKey="team" stroke="hsl(220 10% 55%)" fontSize={12} />
                      <YAxis stroke="hsl(220 10% 55%)" fontSize={12} />
                      <Tooltip contentStyle={{ background: 'hsl(220 18% 11%)', border: '1px solid hsl(220 15% 20%)', borderRadius: '0.75rem', fontSize: 12 }} />
                      <Legend />
                      <Bar dataKey="auto" name="Auto" fill="hsl(210 100% 50%)" radius={[0, 0, 0, 0]} stackId="score" />
                      <Bar dataKey="teleop" name="TeleOp" fill="hsl(0 85% 55%)" radius={[6, 6, 0, 0]} stackId="score" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Radar Comparison */}
              {allPreds.length >= 2 && (
                <div className="data-card">
                  <h3 className="font-display text-lg mb-4">Team Profiles</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="hsl(220 15% 20%)" />
                        <PolarAngleAxis dataKey="metric" stroke="hsl(220 10% 55%)" fontSize={11} />
                        <PolarRadiusAxis stroke="hsl(220 15% 20%)" fontSize={10} />
                        {allPreds.map((p, i) => (
                          <Radar
                            key={p.teamNumber}
                            name={`${p.teamNumber}`}
                            dataKey={p.teamNumber}
                            stroke={radarColors[i]}
                            fill={radarColors[i]}
                            fillOpacity={0.15}
                          />
                        ))}
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}

          {allPreds.length === 0 && !loading && (
            <div className="data-card text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Enter team numbers above to see predictions.</p>
              <p className="text-xs mt-1">Predictions are based on your scouting data.</p>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
