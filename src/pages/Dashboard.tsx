import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { Loader2, Search, TrendingUp, Bot, Gamepad2, Flag, Settings2, Trophy, Save, CheckCircle2, Info, Users, ShieldAlert, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortWeight, SortConfig } from '@/types/scouting';
import { useSeason } from '@/hooks/useSeason';
import {
  aggregateTeam, seasonMetrics, selectionScore,
  type TeamSeasonStats, type SeasonMetric, type MetricCategory,
} from '@/lib/seasonScoring';
import { countersForPhase, togglesForPhase } from '@/seasons/fields';
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

/**
 * Ranking weights.
 *
 * Everything game-specific — which metrics exist, what they are worth, how they
 * are described — comes from the active season (see `src/lib/seasonScoring.ts`).
 * Only the official-API metrics are defined here, because the FTC API reports
 * the same rank/average/record whatever the game is.
 */
const API_METRICS: SeasonMetric[] = [
  {
    id: 'apiRank', label: 'Official Rank (inverted)', category: 'api', defaultWeight: 0, defaultEnabled: false,
    description: 'Official FTC rank, inverted so #1 scores highest. Formula: ((total teams − rank + 1) ÷ total) × weight × 10.',
    value: () => 0,
  },
  {
    id: 'apiQualAvg', label: 'Qual Average', category: 'api', defaultWeight: 0, defaultEnabled: false,
    description: 'Official qual point average from FTC. Formula: (qual avg ÷ 100) × weight × 10.',
    value: () => 0,
  },
  {
    id: 'apiWinRate', label: 'Win Rate %', category: 'api', defaultWeight: 0, defaultEnabled: false,
    description: 'Win percentage from FTC records. Formula: (win % ÷ 100) × weight × 10.',
    value: () => 0,
  },
];

const API_CATEGORY: MetricCategory = { id: 'api', label: 'Official Stats (API)', metrics: API_METRICS };

export default function Dashboard() {
  const { user, profile, isAdmin } = useAuth();
  const { currentEvent } = useEvent();
  const navigate = useNavigate();
  const season = useSeason();

  // Metric catalogue for the active season, plus the game-independent API block.
  const categories = useMemo<MetricCategory[]>(
    () => [...seasonMetrics(season), API_CATEGORY],
    [season],
  );
  const metrics = useMemo(
    () => new Map(categories.flatMap(c => c.metrics).map(m => [m.id, m])),
    [categories],
  );
  const getDefaultWeights = useCallback((): SortWeight[] =>
    categories.flatMap(c => c.metrics).map(m => ({
      id: m.id, label: m.label, weight: m.defaultWeight, enabled: m.defaultEnabled,
    })), [categories]);

  const [teamStats, setTeamStats] = useState<TeamSeasonStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAllTeamsData, setShowAllTeamsData] = useState(false);
  const [configsLoaded, setConfigsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { rankings: apiRankings, getRankForTeam, getRecordForTeam, getTeamName } = useFTCRankings();

  const [config1, setConfig1] = useState<SortConfig>(() => ({
    name: 'List 1',
    weights: [],
  }));
  const [config2, setConfig2] = useState<SortConfig>(() => ({
    name: 'List 2',
    weights: [],
  }));

  // Seed (or re-seed) the sliders whenever the season's metric list changes.
  // Weights the new season does not define are dropped; ones it adds come in at
  // their defaults, so a mid-event switch never leaves an empty config panel.
  useEffect(() => {
    const reconcile = (weights: SortWeight[]): SortWeight[] =>
      getDefaultWeights().map(d => {
        const saved = weights.find(w => w.id === d.id);
        return saved ? { ...d, weight: saved.weight, enabled: saved.enabled } : d;
      });
    setConfig1(c => ({ ...c, weights: reconcile(c.weights) }));
    setConfig2(c => ({ ...c, weights: reconcile(c.weights) }));
  }, [getDefaultWeights]);

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
  }, [currentEvent?.code, showAllTeamsData]);

  /**
   * Per-phase card tiles. `detail` names the two highest-scoring fields of that
   * phase for the team, which is what a strategist actually reads off a card.
   */
  const phaseTiles = useMemo(() => {
    // "TeleOp Hive Tips" → "Hive Tips". The phase prefix is already the tile
    // heading, and the full label is on the tile's title attribute.
    const shortLabel = (label: string) =>
      label.replace(/^(Auto|TeleOp|Endgame)\s+/i, '').split(' ').slice(0, 2).join(' ');

    const spec = [
      { id: 'auto', label: 'Auto', icon: Bot, tone: 'text-primary', points: (t: TeamSeasonStats) => t.avgAuto },
      { id: 'teleop', label: 'TeleOp', icon: Gamepad2, tone: 'text-secondary', points: (t: TeamSeasonStats) => t.avgTeleop },
      { id: 'endgame', label: 'End', icon: Flag, tone: 'text-accent', points: (t: TeamSeasonStats) => t.avgEndgame },
    ] as const;

    return spec.map(({ id, label, icon, tone, points }) => {
      const counters = countersForPhase(season, id);
      const toggles = togglesForPhase(season, id);
      return {
        id, label, icon, tone, points,
        detail: (t: TeamSeasonStats) => {
          const parts = [
            ...counters.map(c => ({
              text: `${shortLabel(c.label)} ${t.avg[c.key] ?? 0}`,
              weight: (t.avg[c.key] ?? 0) * (c.pointsEach ?? 0),
            })),
            ...toggles.map(tg => ({
              text: `${shortLabel(tg.label)} ${t.rate[tg.key] ?? 0}%`,
              weight: ((t.rate[tg.key] ?? 0) / 100) * (tg.pointsEach ?? 0),
            })),
          ];
          return parts
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 2)
            .map(p => p.text)
            .join(' · ');
        },
      };
    });
  }, [season]);


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

    // Only keep entries scouted by our team (or allied team) unless toggle is on
    const data = showAllTeamsData ? allEntries : allEntries.filter(entry => {
      if (!myTeam) return true;
      const scouterTeam = scouterTeamMap.get(entry.scouter_id);
      if (!scouterTeam) return true;
      if (scouterTeam === myTeam) return true;
      if ((myTeam === 12841 && scouterTeam === 2844) || (myTeam === 2844 && scouterTeam === 12841)) return true;
      return false;
    });

    if (data.length > 0) {
      // Deduplicate: when several scouters cover the same match/team, keep only
      // the most recently created entry for that match before averaging.
      const rawTeamMap = new Map<number, typeof data>();
      data.forEach(entry => {
        const existing = rawTeamMap.get(entry.team_number) || [];
        existing.push(entry);
        rawTeamMap.set(entry.team_number, existing);
      });

      const stats: TeamSeasonStats[] = [];

      rawTeamMap.forEach((entries, teamNumber) => {
        const matchGroups = new Map<number, typeof data>();
        entries.forEach(e => {
          const group = matchGroups.get(e.match_number) || [];
          group.push(e);
          matchGroups.set(e.match_number, group);
        });

        const deduped: typeof data = [];
        matchGroups.forEach(group => {
          group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          deduped.push(group[0]);
        });

        // All averaging and point pricing happens in seasonScoring, so the
        // Dashboard and the Match Planner cannot drift apart.
        stats.push(aggregateTeam(season, teamNumber, deduped as unknown as Record<string, unknown>[]));
      });

      setTeamStats(stats);
    } else {
      setTeamStats([]);
    }

    setLoading(false);
  };

  /**
   * Weighted pick score. Season metrics read straight off the team's stats;
   * the three official-API metrics need the rankings table, so they arrive
   * through the `extra` hook instead.
   */
  const calculateScore = (team: TeamSeasonStats, weights: SortWeight[]): number => {
    const apiData = getApiDataForTeam(team.teamNumber);
    const totalTeams = apiRankings.length || 1;

    return selectionScore(team, weights, metrics, (id) => {
      if (!apiData) return null;
      switch (id) {
        case 'apiRank': return ((totalTeams - apiData.rank + 1) / totalTeams) * 10;
        case 'apiQualAvg': return (apiData.qualAverage / 100) * 10;
        case 'apiWinRate': return (apiData.winRate / 100) * 10;
        default: return null;
      }
    });
  };

  const getSortedTeams = (weights: SortWeight[]) => {
    return teamStats
      .map(team => ({ ...team, selectionScore: calculateScore(team, weights) }))
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

  /** Pair each season metric with its current slider setting. */
  const getWeightsByCategory = (weights: SortWeight[]) =>
    categories.map(cat => ({
      id: cat.id,
      label: cat.label,
      weights: cat.metrics.map(m =>
        weights.find(w => w.id === m.id)
          ?? { id: m.id, label: m.label, weight: m.defaultWeight, enabled: m.defaultEnabled },
      ),
    }));

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
                      {metrics.get(w.id)?.description && (
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button type="button" className="shrink-0 p-1 -m-1">
                              <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="center" className="max-w-[240px] z-50">
                            <p className="text-xs">{metrics.get(w.id)?.description}</p>
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

  const TeamCard = ({ team, rank }: { team: TeamSeasonStats; rank: number }) => {
    const officialRank = getRankForTeam(team.teamNumber);
    const teamName = getTeamName(team.teamNumber);

    // Reliability: sample size × consistency, both 0–1.
    // Consistency is variance *relative to the team's own average*, which is what
    // keeps this comparable across seasons — a ±10 pt swing means something very
    // different when a single hive tip is worth 20.
    const sampleWeight = Math.min(1, team.matchesPlayed / 6);
    const reliability = Math.round(sampleWeight * (team.consistency / 100) * 100);
    const reliabilityTier =
      reliability >= 70 ? { label: 'Stable', color: 'text-accent', bg: 'bg-accent/15 border-accent/30' } :
      reliability >= 40 ? { label: 'Mixed', color: 'text-warning', bg: 'bg-warning/15 border-warning/30' } :
                          { label: 'Volatile', color: 'text-destructive', bg: 'bg-destructive/15 border-destructive/30' };

    // Failure rate: penalty rate is already 0–100. Treat >25% as warn, >50% as fail.
    const failureRate = team.penaltyRate;
    const failureTier =
      failureRate >= 50 ? 'text-destructive' :
      failureRate >= 25 ? 'text-warning' :
                          'text-muted-foreground';

    const lowSample = team.matchesPlayed < 3;
    const isMyTeam = profile?.teamNumber === team.teamNumber;

    return (
      <button
        type="button"
        className={cn(
          "w-full text-left data-card transition-all active:scale-[0.99] hover:border-primary/50",
          "min-h-[140px] p-4 md:p-5",
          isMyTeam && "border-primary/60 ring-1 ring-primary/30"
        )}
        onClick={() => navigate(`/team?team=${team.teamNumber}`)}
      >
        {/* Header: rank + team + score */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-md bg-muted/60 border border-border flex items-center justify-center font-display text-base">
              {rank}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold font-mono leading-tight">{team.teamNumber}</h3>
                {isMyTeam && (
                  <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/40">
                    My Team
                  </span>
                )}
                {officialRank !== null && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/15 border border-accent/30 text-[11px] font-mono text-accent">
                    <Trophy className="w-3 h-3" />#{officialRank}
                  </span>
                )}
              </div>
              {teamName && <p className="text-xs text-muted-foreground truncate">{teamName}</p>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-2xl font-display font-bold text-primary leading-none">{team.selectionScore}</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">score</span>
          </div>
        </div>

        {/* Reliability + failure strip */}
        <div className="flex items-center gap-2 mb-3 text-[11px] font-mono">
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded border", reliabilityTier.bg, reliabilityTier.color)}>
                <Activity className="w-3 h-3" />
                {reliabilityTier.label} · {reliability}%
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px]">
              <p className="text-xs">
                Reliability = sample coverage × consistency.
                {' '}{team.matchesPlayed} match{team.matchesPlayed === 1 ? '' : 'es'} scouted,
                {' '}±{team.varianceScore.toFixed(1)} pts around a {team.avgTotal} pt average.
              </p>
            </TooltipContent>
          </Tooltip>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-muted/40", failureTier)}>
                <ShieldAlert className="w-3 h-3" />
                Fail {failureRate}%
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px]">
              <p className="text-xs">% of matches ending in card, dead robot, or penalty status.</p>
            </TooltipContent>
          </Tooltip>
          <span className="ml-auto text-muted-foreground">{team.matchesPlayed} match{team.matchesPlayed === 1 ? '' : 'es'}</span>
        </div>

        {lowSample && (
          <div className="mb-3 flex items-center gap-2 px-2 py-1.5 rounded border border-warning/30 bg-warning/10 text-[11px] text-warning">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Low sample — needs at least 3 matches for trustworthy stats.</span>
          </div>
        )}

        {/* Stat grid — one tile per phase, filled from the season's own fields.
            The headline number is the phase's predicted points; the line under it
            is the two biggest contributors, so the card says *why* without
            listing every column. */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          {phaseTiles.map(tile => (
            <div key={tile.id} className="bg-muted/40 rounded-md p-2.5 min-h-[64px]">
              <div className="flex items-center gap-1 mb-1">
                <tile.icon className={cn('w-3.5 h-3.5', tile.tone)} />
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider">{tile.label}</span>
              </div>
              <div className="font-mono font-semibold text-sm">{tile.points(team)} pts</div>
              <div className="text-muted-foreground text-[10px] truncate" title={tile.detail(team)}>
                {tile.detail(team) || '—'}
              </div>
            </div>
          ))}
        </div>

        {/* Total + defense strip */}
        <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <span>Def {team.avgDefense}/3</span>
          <span>Consistency {team.consistency}%</span>
          <span className="text-foreground">{team.avgTotal} pts/match</span>
        </div>
      </button>
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
        description={`Dual ranking lists, weighted and scored with ${season.name} point values`}
      />

      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by team number..."
            className="pl-12 h-12"
          />
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 shrink-0">
                <Users className={cn("w-4 h-4", showAllTeamsData ? "text-primary" : "text-muted-foreground")} />
                <Switch
                  checked={showAllTeamsData}
                  onCheckedChange={setShowAllTeamsData}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{showAllTeamsData ? "Showing all teams' scouting data" : "Showing only your team's data"}</p>
            </TooltipContent>
          </Tooltip>
          {isAdmin && <SaveIndicator />}
        </div>
      </div>

      {/* Reliability / failure chip legend — explains computation */}
      <details className="mb-4 group rounded-md border border-border bg-muted/20">
        <summary className="cursor-pointer list-none px-3 py-2 flex items-center gap-2 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors">
          <Info className="w-3.5 h-3.5" />
          <span>Legend — how reliability &amp; failure chips work</span>
          <span className="ml-auto text-muted-foreground/60 group-open:hidden">show</span>
          <span className="ml-auto text-muted-foreground/60 hidden group-open:inline">hide</span>
        </summary>
        <div className="px-3 pb-3 pt-1 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3 h-3 text-accent" />
              <span className="font-mono font-semibold text-foreground">Reliability</span>
            </div>
            <div className="text-muted-foreground font-mono">
              <span className="text-foreground">sample × consistency</span>. Sample maxes at 6+ matches.
              Consistency is 1 − (score spread ÷ average score), so it means the same thing
              whatever the season's point values are.
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="px-1.5 py-0.5 rounded border border-accent/30 bg-accent/15 text-accent font-mono">Stable ≥70%</span>
              <span className="px-1.5 py-0.5 rounded border border-warning/30 bg-warning/15 text-warning font-mono">Mixed 40–69%</span>
              <span className="px-1.5 py-0.5 rounded border border-destructive/30 bg-destructive/15 text-destructive font-mono">Volatile &lt;40%</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-3 h-3 text-warning" />
              <span className="font-mono font-semibold text-foreground">Failure rate</span>
            </div>
            <div className="text-muted-foreground font-mono">
              % of scouted matches ending in card, dead robot, or penalty.
              Lower is better — high failure means risky alliance pick.
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="px-1.5 py-0.5 rounded border border-border bg-muted/40 font-mono text-muted-foreground">&lt;25% safe</span>
              <span className="px-1.5 py-0.5 rounded border border-border bg-muted/40 font-mono text-warning">25–49% watch</span>
              <span className="px-1.5 py-0.5 rounded border border-border bg-muted/40 font-mono text-destructive">≥50% risky</span>
            </div>
          </div>
        </div>
      </details>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : teamStats.length === 0 ? (
        <div className="data-card text-center py-12 text-muted-foreground">
          No match data yet. Start scouting to see stats.
        </div>
      ) : (
        <>
          {(() => {
            const lowSampleTeams = teamStats.filter(t => t.matchesPlayed < 3);
            if (lowSampleTeams.length === 0) return null;
            return (
              <div className="mb-4 flex items-start gap-3 px-3 py-2.5 rounded-md border border-warning/30 bg-warning/10">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div className="text-xs font-mono leading-relaxed">
                  <span className="text-warning font-semibold">{lowSampleTeams.length}</span>
                  <span className="text-muted-foreground"> team{lowSampleTeams.length === 1 ? '' : 's'} have fewer than 3 scouted matches — reliability scores will be low. </span>
                  <span className="text-muted-foreground/80">({lowSampleTeams.slice(0, 6).map(t => t.teamNumber).join(', ')}{lowSampleTeams.length > 6 ? `, +${lowSampleTeams.length - 6} more` : ''})</span>
                </div>
              </div>
            );
          })()}
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
                <TeamCard key={team.teamNumber} team={team} rank={idx + 1} />
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
                <TeamCard key={team.teamNumber} team={team} rank={idx + 1} />
              ))}
            </div>
          </div>
        </div>
        </>
      )}
    </AppLayout>
  );
}
