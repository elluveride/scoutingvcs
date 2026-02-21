import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useFTCRankings } from '@/hooks/useFTCRankings';
import { Loader2, Search, TrendingUp, Bot, Gamepad2, Flag, Settings2, Trophy, Save, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamStats, SortWeight, SortConfig } from '@/types/scouting';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// Grouped weight categories for intuitive configuration
interface WeightCategory {
  id: string;
  label: string;
  weights: SortWeight[];
}

const defaultCategories: WeightCategory[] = [
  {
    id: 'scoring',
    label: 'Scoring',
    weights: [
      { id: 'autoClose', label: 'Auto Close', weight: 3, enabled: true },
      { id: 'autoFar', label: 'Auto Far', weight: 4, enabled: true },
      { id: 'teleopClose', label: 'TeleOp Close', weight: 2, enabled: true },
      { id: 'teleopFar', label: 'TeleOp Far', weight: 3, enabled: true },
    ],
  },
  {
    id: 'auto',
    label: 'Autonomous',
    weights: [
      { id: 'autoTotal', label: 'Auto Total', weight: 5, enabled: true },
      { id: 'launchLine', label: 'Launch Line %', weight: 1, enabled: true },
    ],
  },
  {
    id: 'endgame',
    label: 'Endgame',
    weights: [
      { id: 'lift', label: 'Lift %', weight: 5, enabled: true },
      { id: 'fullReturn', label: 'Full Return %', weight: 3, enabled: true },
    ],
  },
  {
    id: 'other',
    label: 'Other Factors',
    weights: [
      { id: 'defense', label: 'Defense Rating', weight: 2, enabled: false },
      { id: 'fouls', label: 'Fouls (penalty)', weight: -2, enabled: true },
      { id: 'penalties', label: 'Card/Dead (penalty)', weight: -5, enabled: true },
      { id: 'variance', label: 'Consistency', weight: -1, enabled: true },
    ],
  },
  {
    id: 'api',
    label: 'Official Stats (API)',
    weights: [
      { id: 'apiRank', label: 'Official Rank (inverted)', weight: 0, enabled: false },
      { id: 'apiQualAvg', label: 'Qual Average', weight: 0, enabled: false },
      { id: 'apiWinRate', label: 'Win Rate %', weight: 0, enabled: false },
    ],
  },
];

const weightDescriptions: Record<string, string> = {
  autoClose: 'Multiplied by avg close-zone samples scored in Auto. E.g. weight 3, avg 2.5 → +7.5 pts.',
  autoFar: 'Multiplied by avg far-zone samples scored in Auto. Higher weight = more emphasis on far scoring.',
  autoTotal: 'Multiplied by total Auto avg (close + far combined). Use instead of individual close/far for simpler scoring.',
  launchLine: 'Rewards teams starting on the launch line. Formula: (% on line ÷ 100) × weight × 10. At weight 1, 80% → +8 pts.',
  teleopClose: 'Multiplied by avg close-zone samples in TeleOp. Same formula as Auto Close.',
  teleopFar: 'Multiplied by avg far-zone samples in TeleOp. Same formula as Auto Far.',
  defense: 'Based on avg defense rating (0–3 scale). Formula: rating × weight × 10. At weight 2, rating 2.5 → +50 pts.',
  lift: 'Bonus for achieving Lift endgame. Formula: (lift % ÷ 100) × weight × 10. 100% lift at weight 5 → +50 pts.',
  fullReturn: 'Bonus for Full Return endgame. Formula: (full return % ÷ 100) × weight × 10.',
  fouls: 'Penalty per avg minor fouls. Negative weight means more fouls → lower score. At -2, avg 1.5 fouls → -3 pts.',
  penalties: 'Penalty for yellow/red card or dead robot rate. Formula: (penalty rate % ÷ 100) × weight × 10.',
  variance: 'Consistency factor. High variance = unpredictable scores. Negative weight rewards consistent teams.',
  apiRank: 'Official FTC rank (inverted: #1 = max score). Formula: ((total teams − rank + 1) ÷ total) × weight × 10.',
  apiQualAvg: 'Official qual point average from FTC. Formula: (qual avg ÷ 100) × weight × 10.',
  apiWinRate: 'Win percentage from FTC records. Formula: (win % ÷ 100) × weight × 10.',
};

const getDefaultWeights = (): SortWeight[] =>
  defaultCategories.flatMap(cat => cat.weights);

export default function Dashboard() {
  const { user, profile, isAdmin } = useAuth();
  const { currentEvent } = useEvent();
  const navigate = useNavigate();
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [configsLoaded, setConfigsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { rankings: apiRankings, getRankForTeam, getRecordForTeam } = useFTCRankings();

  const [config1, setConfig1] = useState<SortConfig>({
    name: 'List 1',
    weights: JSON.parse(JSON.stringify(getDefaultWeights())),
  });
  const [config2, setConfig2] = useState<SortConfig>({
    name: 'List 2',
    weights: JSON.parse(JSON.stringify(getDefaultWeights())),
  });

  // Load dashboard configs from server
  useEffect(() => {
    if (currentEvent?.code && profile?.teamNumber) {
      loadDashboardConfigs();
    }
  }, [currentEvent?.code, profile?.teamNumber]);

  const loadDashboardConfigs = async () => {
    if (!currentEvent?.code || !profile?.teamNumber) return;

    const { data, error } = await supabase
      .from('dashboard_configs')
      .select('*')
      .eq('team_number', profile.teamNumber)
      .eq('event_code', currentEvent.code);

    if (data && data.length > 0 && !error) {
      const cfg0 = data.find(d => d.config_index === 0);
      const cfg1 = data.find(d => d.config_index === 1);

      if (cfg0) {
        setConfig1({
          name: cfg0.list_name,
          weights: Array.isArray(cfg0.weights) ? cfg0.weights as unknown as SortWeight[] : getDefaultWeights(),
        });
      }
      if (cfg1) {
        setConfig2({
          name: cfg1.list_name,
          weights: Array.isArray(cfg1.weights) ? cfg1.weights as unknown as SortWeight[] : getDefaultWeights(),
        });
      }
    }
    setConfigsLoaded(true);
  };

  // Auto-save configs when admin makes changes (debounced)
  const saveDashboardConfig = useCallback(async (configIndex: number, config: SortConfig) => {
    if (!isAdmin || !currentEvent?.code || !profile?.teamNumber || !user) return;

    setSaveStatus('saving');

    const record = {
      team_number: profile.teamNumber,
      event_code: currentEvent.code,
      config_index: configIndex,
      list_name: config.name,
      weights: config.weights as unknown as Record<string, unknown>[],
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('dashboard_configs')
      .upsert(record as any, { onConflict: 'team_number,event_code,config_index' });

    if (error) {
      console.error('Error saving dashboard config:', error);
      setSaveStatus('idle');
    } else {
      setSaveStatus('saved');
      if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
      saveStatusTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [isAdmin, currentEvent?.code, profile?.teamNumber, user]);

  // Debounced save for config1
  useEffect(() => {
    if (!configsLoaded || !isAdmin) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDashboardConfig(0, config1);
    }, 1500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [config1, configsLoaded, isAdmin]);

  // Debounced save for config2
  useEffect(() => {
    if (!configsLoaded || !isAdmin) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDashboardConfig(1, config2);
    }, 1500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [config2, configsLoaded, isAdmin]);

  useEffect(() => {
    if (currentEvent?.code) {
      calculateStats();
    }
  }, [currentEvent?.code]);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!currentEvent) {
    return <Navigate to="/event-select" replace />;
  }

  const calculateStats = async () => {
    setLoading(true);

    // Fetch match entries and filter to only our team's scouted data
    const myTeam = profile?.teamNumber;
    const { data: allEntries, error } = await supabase
      .from('match_entries')
      .select('*')
      .eq('event_code', currentEvent.code);

    if (!allEntries || error) {
      setLoading(false);
      return;
    }

    // Get scouter team numbers to filter by own team only
    const scouterIds = [...new Set(allEntries.map(e => e.scouter_id))];
    const { data: scouterProfiles } = await supabase
      .from('profiles')
      .select('id, team_number')
      .in('id', scouterIds);

    const scouterTeamMap = new Map<string, number | null>();
    scouterProfiles?.forEach(p => scouterTeamMap.set(p.id, p.team_number));

    // Only keep entries scouted by our team (or allied team)
    const data = allEntries.filter(entry => {
      if (!myTeam) return true;
      const scouterTeam = scouterTeamMap.get(entry.scouter_id);
      if (!scouterTeam) return true;
      if (scouterTeam === myTeam) return true;
      // Allied teams
      if ((myTeam === 12841 && scouterTeam === 2844) || (myTeam === 2844 && scouterTeam === 12841)) return true;
      return false;
    });

    if (data.length > 0) {
      // Deduplicate: when multiple scouters scout the same match/team,
      // average their values per match first, then average across matches
      const teamMap = new Map<number, typeof data>();

      // Group by team first
      const rawTeamMap = new Map<number, typeof data>();
      data.forEach(entry => {
        const existing = rawTeamMap.get(entry.team_number) || [];
        existing.push(entry);
        rawTeamMap.set(entry.team_number, existing);
      });

      // Deduplicate per match_number within each team
      rawTeamMap.forEach((entries, teamNumber) => {
        const matchGroups = new Map<number, typeof data>();
        entries.forEach(e => {
          const group = matchGroups.get(e.match_number) || [];
          group.push(e);
          matchGroups.set(e.match_number, group);
        });

        // For each match, keep only the most recently created/edited entry
        const deduped: typeof data = [];
        matchGroups.forEach((group) => {
          // Sort by created_at descending and take the latest entry
          group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          deduped.push(group[0]);
        });

        teamMap.set(teamNumber, deduped);
      });

      const stats: TeamStats[] = [];

      teamMap.forEach((entries, teamNumber) => {
        const matchesPlayed = entries.length;

        const avgAutoClose = entries.reduce((sum, e) => sum + e.auto_scored_close, 0) / matchesPlayed;
        const avgAutoFar = entries.reduce((sum, e) => sum + e.auto_scored_far, 0) / matchesPlayed;
        const autoTotalAvg = avgAutoClose + avgAutoFar;

        const avgTeleopClose = entries.reduce((sum, e) => sum + e.teleop_scored_close, 0) / matchesPlayed;
        const avgTeleopFar = entries.reduce((sum, e) => sum + e.teleop_scored_far, 0) / matchesPlayed;
        const teleopTotalAvg = avgTeleopClose + avgTeleopFar;

        const avgFoulsMinor = entries.reduce((sum, e) => sum + e.auto_fouls_minor, 0) / matchesPlayed;
        const avgFoulsMajor = entries.reduce((sum, e) => sum + e.auto_fouls_major, 0) / matchesPlayed;

        const onLaunchLinePercent = (entries.filter(e => e.on_launch_line).length / matchesPlayed) * 100;
        const avgDefense = entries.reduce((sum, e) => sum + e.defense_rating, 0) / matchesPlayed;

        const liftPercent = (entries.filter(e => e.endgame_return === 'lift').length / matchesPlayed) * 100;
        const fullReturnPercent = (entries.filter(e => e.endgame_return === 'full').length / matchesPlayed) * 100;
        const partialReturnPercent = (entries.filter(e => e.endgame_return === 'partial').length / matchesPlayed) * 100;

        const penaltyRate = (entries.filter(e => e.penalty_status !== 'none').length / matchesPlayed) * 100;

        const autoVariance = entries.reduce((sum, e) => {
          const autoTotal = e.auto_scored_close + e.auto_scored_far;
          return sum + Math.pow(autoTotal - autoTotalAvg, 2);
        }, 0) / matchesPlayed;
        const varianceScore = Math.sqrt(autoVariance);

        stats.push({
          teamNumber,
          matchesPlayed,
          avgAutoClose: Math.round(avgAutoClose * 10) / 10,
          avgAutoFar: Math.round(avgAutoFar * 10) / 10,
          autoTotalAvg: Math.round(autoTotalAvg * 10) / 10,
          avgTeleopClose: Math.round(avgTeleopClose * 10) / 10,
          avgTeleopFar: Math.round(avgTeleopFar * 10) / 10,
          teleopTotalAvg: Math.round(teleopTotalAvg * 10) / 10,
          avgFoulsMinor: Math.round(avgFoulsMinor * 10) / 10,
          avgFoulsMajor: Math.round(avgFoulsMajor * 10) / 10,
          onLaunchLinePercent: Math.round(onLaunchLinePercent),
          avgDefense: Math.round(avgDefense * 10) / 10,
          liftPercent: Math.round(liftPercent),
          fullReturnPercent: Math.round(fullReturnPercent),
          partialReturnPercent: Math.round(partialReturnPercent),
          penaltyRate: Math.round(penaltyRate),
          varianceScore: Math.round(varianceScore * 10) / 10,
          selectionScore: 0,
        });
      });

      setTeamStats(stats);
    }

    setLoading(false);
  };

  const calculateScore = (team: TeamStats, weights: SortWeight[]): number => {
    let score = 0;
    const apiData = getApiDataForTeam(team.teamNumber);
    const totalTeams = apiRankings.length || 1;

    weights.forEach(w => {
      if (!w.enabled) return;
      switch (w.id) {
        case 'autoClose': score += team.avgAutoClose * w.weight; break;
        case 'autoFar': score += team.avgAutoFar * w.weight; break;
        case 'autoTotal': score += team.autoTotalAvg * w.weight; break;
        case 'launchLine': score += (team.onLaunchLinePercent / 100) * w.weight * 10; break;
        case 'teleopClose': score += team.avgTeleopClose * w.weight; break;
        case 'teleopFar': score += team.avgTeleopFar * w.weight; break;
        case 'defense': score += team.avgDefense * w.weight * 10; break;
        case 'lift': score += (team.liftPercent / 100) * w.weight * 10; break;
        case 'fullReturn': score += (team.fullReturnPercent / 100) * w.weight * 10; break;
        case 'fouls': score += team.avgFoulsMinor * w.weight; break;
        case 'penalties': score += (team.penaltyRate / 100) * w.weight * 10; break;
        case 'variance': score += team.varianceScore * w.weight; break;
        case 'apiRank':
          if (apiData) score += ((totalTeams - apiData.rank + 1) / totalTeams) * w.weight * 10;
          break;
        case 'apiQualAvg':
          if (apiData) score += (apiData.qualAverage / 100) * w.weight * 10;
          break;
        case 'apiWinRate':
          if (apiData) score += (apiData.winRate / 100) * w.weight * 10;
          break;
      }
    });
    return Math.round(score * 10) / 10;
  };

  const getSortedTeams = (weights: SortWeight[]) => {
    return [...teamStats]
      .map(team => ({
        ...team,
        selectionScore: calculateScore(team, weights),
      }))
      .filter(team => team.teamNumber.toString().includes(searchTerm))
      .sort((a, b) => b.selectionScore - a.selectionScore);
  };

  const getApiDataForTeam = (teamNumber: number) => {
    const ranking = apiRankings.find(r => r.teamNumber === teamNumber);
    if (!ranking) return null;
    return {
      rank: ranking.rank,
      qualAverage: ranking.qualAverage,
      winRate: ranking.matchesPlayed > 0
        ? (ranking.wins / ranking.matchesPlayed) * 100
        : 0,
    };
  };

  const updateWeight = (configSetter: React.Dispatch<React.SetStateAction<SortConfig>>, id: string, value: number) => {
    configSetter(prev => ({
      ...prev,
      weights: prev.weights.map(w => w.id === id ? { ...w, weight: value } : w),
    }));
  };

  const toggleWeight = (configSetter: React.Dispatch<React.SetStateAction<SortConfig>>, id: string) => {
    configSetter(prev => ({
      ...prev,
      weights: prev.weights.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w),
    }));
  };

  const getWeightsByCategory = (weights: SortWeight[]) => {
    return defaultCategories.map(cat => ({
      ...cat,
      weights: cat.weights.map(defaultW =>
        weights.find(w => w.id === defaultW.id) || defaultW
      ),
    }));
  };

  const renderConfigPanel = (config: SortConfig, setConfig: React.Dispatch<React.SetStateAction<SortConfig>>) => {
    const categorizedWeights = getWeightsByCategory(config.weights);

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>List Name</Label>
          <Input
            value={config.name}
            onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
            className="h-10"
          />
        </div>
        <div className="space-y-6">
          {categorizedWeights.map(category => (
            <div key={category.id} className="space-y-3">
              <h4 className="text-sm font-semibold text-primary border-b border-border pb-1">
                {category.label}
              </h4>
              {category.weights.map(w => (
                <div key={w.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={w.enabled}
                        onCheckedChange={() => toggleWeight(setConfig, w.id)}
                      />
                      <span className={cn("text-sm", !w.enabled && "text-muted-foreground")}>{w.label}</span>
                      {weightDescriptions[w.id] && (
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button type="button" className="shrink-0 p-1 -m-1">
                              <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="center" className="max-w-[240px] z-50">
                            <p className="text-xs">{weightDescriptions[w.id]}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <span className={cn(
                      "text-sm font-mono w-8 text-right",
                      w.weight > 0 ? "text-accent" : w.weight < 0 ? "text-secondary" : "text-muted-foreground"
                    )}>{w.weight > 0 ? `+${w.weight}` : w.weight}</span>
                  </div>
                  {w.enabled && (
                    <Slider
                      value={[w.weight]}
                      onValueChange={([v]) => updateWeight(setConfig, w.id, v)}
                      min={-10}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const TeamCard = ({ team }: { team: TeamStats }) => {
    const officialRank = getRankForTeam(team.teamNumber);

    return (
      <div
        className="data-card cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => navigate(`/team?team=${team.teamNumber}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-xl font-bold font-mono">{team.teamNumber}</h3>
              <p className="text-xs text-muted-foreground">{team.matchesPlayed} matches</p>
            </div>
            {officialRank !== null && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/20 border border-accent/30">
                <Trophy className="w-3 h-3 text-accent" />
                <span className="text-xs font-mono font-semibold text-accent">#{officialRank}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-lg font-bold text-primary">{team.selectionScore}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-muted/50 rounded p-2">
            <div className="flex items-center gap-1 mb-1">
              <Bot className="w-3 h-3 text-primary" />
              <span className="text-muted-foreground">Auto</span>
            </div>
            <div className="font-mono font-semibold">
              {team.autoTotalAvg} <span className="text-muted-foreground">({team.avgAutoClose}C/{team.avgAutoFar}F)</span>
            </div>
            <div className="text-muted-foreground">Line: {team.onLaunchLinePercent}%</div>
          </div>

          <div className="bg-muted/50 rounded p-2">
            <div className="flex items-center gap-1 mb-1">
              <Gamepad2 className="w-3 h-3 text-secondary" />
              <span className="text-muted-foreground">TeleOp</span>
            </div>
            <div className="font-mono font-semibold">
              {team.teleopTotalAvg} <span className="text-muted-foreground">({team.avgTeleopClose}C/{team.avgTeleopFar}F)</span>
            </div>
            <div className="text-muted-foreground">Def: {team.avgDefense}</div>
          </div>

          <div className="bg-muted/50 rounded p-2">
            <div className="flex items-center gap-1 mb-1">
              <Flag className="w-3 h-3 text-accent" />
              <span className="text-muted-foreground">End</span>
            </div>
            <div className="font-mono font-semibold">Lift: {team.liftPercent}%</div>
            <div className="text-muted-foreground">Full: {team.fullReturnPercent}%</div>
          </div>
        </div>
      </div>
    );
  };

  const list1Teams = getSortedTeams(config1.weights);
  const list2Teams = getSortedTeams(config2.weights);

  // Save status indicator
  const SaveIndicator = () => {
    if (saveStatus === 'idle') return null;
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {saveStatus === 'saving' && (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Saving...</span>
          </>
        )}
        {saveStatus === 'saved' && (
          <>
            <CheckCircle2 className="w-3 h-3 text-accent" />
            <span className="text-accent">Saved</span>
          </>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
      <PageHeader
        title="Team Dashboard"
        description="Dual team ranking lists with configurable weights"
      />

      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 mr-4">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by team number..."
            className="pl-12 h-12"
          />
        </div>
        {isAdmin && <SaveIndicator />}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : teamStats.length === 0 ? (
        <div className="data-card text-center py-12 text-muted-foreground">
          No match data yet. Start scouting to see stats.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* List 1 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{config1.name}</h2>
              {isAdmin && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings2 className="w-4 h-4 mr-2" />
                      Configure
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Configure {config1.name}</SheetTitle>
                      <SheetDescription>Adjust weights for each metric</SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 pb-6">
                      {renderConfigPanel(config1, setConfig1)}
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>
            <div className="space-y-3">
              {list1Teams.map((team, idx) => (
                <div key={team.teamNumber} className="relative">
                  <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-sm font-mono text-muted-foreground">
                    {idx + 1}
                  </div>
                  <TeamCard team={team} />
                </div>
              ))}
            </div>
          </div>

          {/* List 2 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{config2.name}</h2>
              {isAdmin && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings2 className="w-4 h-4 mr-2" />
                      Configure
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Configure {config2.name}</SheetTitle>
                      <SheetDescription>Adjust weights for each metric</SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 pb-6">
                      {renderConfigPanel(config2, setConfig2)}
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>
            <div className="space-y-3">
              {list2Teams.map((team, idx) => (
                <div key={team.teamNumber} className="relative">
                  <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-sm font-mono text-muted-foreground">
                    {idx + 1}
                  </div>
                  <TeamCard team={team} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
