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
import { useFTCRankings } from '@/hooks/useFTCRankings';
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

import { POINTS, predictTeam, type TeamPrediction, type MatchEntryLite as MatchEntry } from '@/lib/prediction';
import { MissingDataBanner, type TeamMissingInputs } from '@/components/shared/MissingDataBanner';

const round1 = (v: number) => Math.round(v * 10) / 10;



/*──────────────────────────────────────────────────────────────
  Component
──────────────────────────────────────────────────────────────*/
export default function MatchPlanner() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const { matches } = useFTCMatches();
  const { getTeamName } = useFTCRankings();

  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState('');

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

  const teamPredictions = useMemo(() => {
    const teamMap = new Map<number, MatchEntry[]>();
    allEntries.forEach(e => {
      const existing = teamMap.get(e.team_number) || [];
      existing.push(e);
      teamMap.set(e.team_number, existing);
    });

    const preds = new Map<number, TeamPrediction>();
    teamMap.forEach((entries, teamNumber) => {
      preds.set(teamNumber, predictTeam(teamNumber, entries));
    });
    return preds;
  }, [allEntries]);

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

  // Alliance totals (including both-full bonus estimate)
  const blueRawTotal = bluePreds.reduce((s, p) => s + p.predictedTotal, 0);
  const redRawTotal = redPreds.reduce((s, p) => s + p.predictedTotal, 0);

  // Estimate both-full bonus probability
  const blueBothFullProb = bluePreds.length === 2
    ? ((bluePreds[0].fullReturnRate + bluePreds[0].liftRate) / 100) * ((bluePreds[1].fullReturnRate + bluePreds[1].liftRate) / 100)
    : 0;
  const redBothFullProb = redPreds.length === 2
    ? ((redPreds[0].fullReturnRate + redPreds[0].liftRate) / 100) * ((redPreds[1].fullReturnRate + redPreds[1].liftRate) / 100)
    : 0;

  const blueTotal = blueRawTotal + blueBothFullProb * POINTS.BASE_BOTH_FULL_BONUS;
  const redTotal = redRawTotal + redBothFullProb * POINTS.BASE_BOTH_FULL_BONUS;

  // Fouls given to opponent
  const blueFoulsToOpponent = bluePreds.reduce((s, p) => s + p.foulsGivenToOpponent, 0);
  const redFoulsToOpponent = redPreds.reduce((s, p) => s + p.foulsGivenToOpponent, 0);

  // Net scores (opponent fouls add to your score)
  const blueNetTotal = round1(blueTotal + redFoulsToOpponent);
  const redNetTotal = round1(redTotal + blueFoulsToOpponent);

  const allPreds = [...bluePreds, ...redPreds];

  const comparisonData = allPreds.map(p => ({
    team: `${p.teamNumber}`,
    auto: p.predictedAuto,
    teleop: p.predictedTeleop,
    endgame: p.predictedEndgame,
  }));

  const radarData = [
    { metric: 'Auto', ...Object.fromEntries(allPreds.map(p => [p.teamNumber, p.predictedAuto])) },
    { metric: 'TeleOp', ...Object.fromEntries(allPreds.map(p => [p.teamNumber, p.predictedTeleop])) },
    { metric: 'Endgame', ...Object.fromEntries(allPreds.map(p => [p.teamNumber, p.predictedEndgame])) },
    { metric: 'Defense', ...Object.fromEntries(allPreds.map(p => [p.teamNumber, p.avgDefense * 3])) },
    { metric: 'Consistency', ...Object.fromEntries(allPreds.map(p => [p.teamNumber, p.consistency / 10])) },
  ];

  const radarColors = ['hsl(210 100% 50%)', 'hsl(210 100% 70%)', 'hsl(0 85% 55%)', 'hsl(0 85% 75%)'];

  return (
    <AppLayout>
      <PageHeader
        title="Match Planner"
        description="Predict scores using DECODE point values"
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
                  <div>
                    <Input value={blueTeam1} onChange={e => setBlueTeam1(e.target.value)} placeholder="Team 1" type="number" className="h-12 font-mono" />
                    {blueTeam1 && getTeamName(parseInt(blueTeam1)) && <p className="text-xs text-muted-foreground mt-1 truncate">{getTeamName(parseInt(blueTeam1))}</p>}
                  </div>
                  <div>
                    <Input value={blueTeam2} onChange={e => setBlueTeam2(e.target.value)} placeholder="Team 2" type="number" className="h-12 font-mono" />
                    {blueTeam2 && getTeamName(parseInt(blueTeam2)) && <p className="text-xs text-muted-foreground mt-1 truncate">{getTeamName(parseInt(blueTeam2))}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-mono text-alliance-red font-semibold">Red Alliance</Label>
                  <div>
                    <Input value={redTeam1} onChange={e => setRedTeam1(e.target.value)} placeholder="Team 1" type="number" className="h-12 font-mono" />
                    {redTeam1 && getTeamName(parseInt(redTeam1)) && <p className="text-xs text-muted-foreground mt-1 truncate">{getTeamName(parseInt(redTeam1))}</p>}
                  </div>
                  <div>
                    <Input value={redTeam2} onChange={e => setRedTeam2(e.target.value)} placeholder="Team 2" type="number" className="h-12 font-mono" />
                    {redTeam2 && getTeamName(parseInt(redTeam2)) && <p className="text-xs text-muted-foreground mt-1 truncate">{getTeamName(parseInt(redTeam2))}</p>}
                  </div>
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
                      {Math.round(blueNetTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {Math.round(blueTotal)} + {Math.round(redFoulsToOpponent)} fouls
                    </p>
                    <div className="flex gap-2 justify-center mt-1 text-xs text-muted-foreground font-mono">
                      {bluePreds.map(p => <span key={p.teamNumber}>{p.teamNumber}</span>)}
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Predicted Winner</p>
                    <div className={`text-2xl font-display font-bold ${blueNetTotal > redNetTotal ? 'text-alliance-blue' : blueNetTotal < redNetTotal ? 'text-alliance-red' : 'text-muted-foreground'}`}>
                      {blueNetTotal > redNetTotal ? 'BLUE' : blueNetTotal < redNetTotal ? 'RED' : 'TIE'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Margin: {Math.abs(Math.round(blueNetTotal - redNetTotal))}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Red Alliance</p>
                    <p className="text-4xl font-display font-bold text-alliance-red">
                      {Math.round(redNetTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {Math.round(redTotal)} + {Math.round(blueFoulsToOpponent)} fouls
                    </p>
                    <div className="flex gap-2 justify-center mt-1 text-xs text-muted-foreground font-mono">
                      {redPreds.map(p => <span key={p.teamNumber}>{p.teamNumber}</span>)}
                    </div>
                  </div>
                </div>

                {/* Point value reference */}
                <div className="mt-4 pt-4 border-t border-border/40">
                  <p className="text-xs text-muted-foreground font-mono mb-2">DECODE Point Values Used:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground">
                    <span>Leave: {POINTS.LEAVE}pts</span>
                    <span>Classified: {POINTS.CLASSIFIED_AUTO}pts</span>
                    <span>Overflow: {POINTS.OVERFLOW_AUTO}pt</span>
                    <span>Pattern: {POINTS.PATTERN_MATCH}pts</span>
                    <span>Depot: {POINTS.DEPOT}pt</span>
                    <span>Partial Base: {POINTS.BASE_PARTIAL}pts</span>
                    <span>Full Base: {POINTS.BASE_FULL}pts</span>
                    <span>Both Full: +{POINTS.BASE_BOTH_FULL_BONUS}pts</span>
                  </div>
                </div>
              </PitSection>

              {/* Team Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allPreds.map((pred, i) => (
                  <div key={pred.teamNumber} className="data-card">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-3 h-3 rounded-full ${i < bluePreds.length ? 'bg-alliance-blue' : 'bg-alliance-red'}`} />
                      <span className="font-display font-bold text-lg">{pred.teamNumber}</span>
                      {getTeamName(pred.teamNumber) && <span className="text-xs text-muted-foreground truncate">{getTeamName(pred.teamNumber)}</span>}
                      <span className="text-xs font-mono text-muted-foreground ml-auto">{pred.matchCount} matches</span>
                    </div>

                    {/* Score Breakdown */}
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between items-center pb-1 border-b border-border/30">
                        <span className="text-muted-foreground font-semibold">AUTO</span>
                        <span className="font-bold text-primary">{pred.predictedAuto} pts</span>
                      </div>
                      <div className="flex justify-between pl-3">
                        <span className="text-muted-foreground">Leave ({pred.leaveRate}%)</span>
                        <span>{pred.autoLeavePoints}</span>
                      </div>
                      <div className="flex justify-between pl-3">
                        <span className="text-muted-foreground">Classified × {POINTS.CLASSIFIED_AUTO}</span>
                        <span>{pred.autoClassifiedPoints}</span>
                      </div>
                      <div className="flex justify-between pl-3">
                        <span className="text-muted-foreground">Overflow × {POINTS.OVERFLOW_AUTO}</span>
                        <span>{pred.autoOverflowPoints}</span>
                      </div>

                      <div className="flex justify-between items-center pt-1 pb-1 border-b border-border/30">
                        <span className="text-muted-foreground font-semibold">TELEOP</span>
                        <span className="font-bold text-primary">{pred.predictedTeleop} pts</span>
                      </div>
                      <div className="flex justify-between pl-3">
                        <span className="text-muted-foreground">Classified × {POINTS.CLASSIFIED_TELEOP}</span>
                        <span>{pred.teleopClassifiedPoints}</span>
                      </div>
                      <div className="flex justify-between pl-3">
                        <span className="text-muted-foreground">Overflow × {POINTS.OVERFLOW_TELEOP}</span>
                        <span>{pred.teleopOverflowPoints}</span>
                      </div>

                      <div className="flex justify-between items-center pt-1 pb-1 border-b border-border/30">
                        <span className="text-muted-foreground font-semibold">ENDGAME</span>
                        <span className="font-bold text-primary">{pred.predictedEndgame} pts</span>
                      </div>
                      <div className="flex justify-between pl-3">
                        <span className="text-muted-foreground">Full Return ({pred.fullReturnRate}%)</span>
                        <span>{round1(pred.fullReturnRate / 100 * POINTS.BASE_FULL)}</span>
                      </div>
                      <div className="flex justify-between pl-3">
                        <span className="text-muted-foreground">Partial ({pred.partialReturnRate}%)</span>
                        <span>{round1(pred.partialReturnRate / 100 * POINTS.BASE_PARTIAL)}</span>
                      </div>
                      <div className="flex justify-between pl-3">
                        <span className="text-muted-foreground">Lift ({pred.liftRate}%)</span>
                        <span>{round1(pred.liftRate / 100 * POINTS.BASE_FULL)}</span>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-border/40">
                        <span className="font-semibold">TOTAL</span>
                        <span className="font-bold text-lg">{pred.predictedTotal} pts</span>
                      </div>

                      <div className="flex justify-between text-warning/80">
                        <span>Fouls → opponent</span>
                        <span>+{pred.foulsGivenToOpponent} pts</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Defense</span>
                          <span>{pred.avgDefense}/3</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Consistency</span>
                          <span>{pred.consistency}%</span>
                        </div>
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
                      <Bar dataKey="auto" name="Auto" fill="hsl(210 100% 50%)" stackId="score" />
                      <Bar dataKey="teleop" name="TeleOp" fill="hsl(0 85% 55%)" stackId="score" />
                      <Bar dataKey="endgame" name="Endgame" fill="hsl(142 70% 45%)" radius={[6, 6, 0, 0]} stackId="score" />
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
              <p className="text-xs mt-1">Predictions use official DECODE point values.</p>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
