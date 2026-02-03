import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, TrendingUp, Bot, Gamepad2, Flag, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamStats, SortWeight, SortConfig } from '@/types/scouting';
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
];

// Flatten categories to get all weights
const getDefaultWeights = (): SortWeight[] => 
  defaultCategories.flatMap(cat => cat.weights);

export default function Dashboard() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Two independent sort configs
  const [config1, setConfig1] = useState<SortConfig>({
    name: 'List 1',
    weights: JSON.parse(JSON.stringify(getDefaultWeights())),
  });
  const [config2, setConfig2] = useState<SortConfig>({
    name: 'List 2', 
    weights: JSON.parse(JSON.stringify(getDefaultWeights())),
  });

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!currentEvent) {
    return <Navigate to="/event-select" replace />;
  }

  const calculateStats = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('match_entries')
      .select('*')
      .eq('event_code', currentEvent.code);

    if (data && !error) {
      const teamMap = new Map<number, typeof data>();
      
      data.forEach(entry => {
        const existing = teamMap.get(entry.team_number) || [];
        existing.push(entry);
        teamMap.set(entry.team_number, existing);
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
        
        // Variance calculation on auto scoring
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
          selectionScore: 0, // Will be calculated per-list
        });
      });
      
      setTeamStats(stats);
    }
    
    setLoading(false);
  };

  const calculateScore = (team: TeamStats, weights: SortWeight[]): number => {
    let score = 0;
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

  useEffect(() => {
    calculateStats();
  }, [currentEvent.code]);

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

  // Get weights organized by category for display
  const getWeightsByCategory = (weights: SortWeight[]) => {
    return defaultCategories.map(cat => ({
      ...cat,
      weights: cat.weights.map(defaultW => 
        weights.find(w => w.id === defaultW.id) || defaultW
      ),
    }));
  };

  const ConfigPanel = ({ config, setConfig }: { config: SortConfig; setConfig: React.Dispatch<React.SetStateAction<SortConfig>> }) => {
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
                    </div>
                    <span className={cn(
                      "text-sm font-mono w-8 text-right",
                      w.weight > 0 ? "text-green-500" : w.weight < 0 ? "text-red-500" : "text-muted-foreground"
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

  const TeamCard = ({ team }: { team: TeamStats }) => (
    <div className="data-card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xl font-bold font-mono">{team.teamNumber}</h3>
          <p className="text-xs text-muted-foreground">{team.matchesPlayed} matches</p>
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

  const list1Teams = getSortedTeams(config1.weights);
  const list2Teams = getSortedTeams(config2.weights);

  return (
    <AppLayout>
      <PageHeader
        title="Team Dashboard"
        description="Dual team ranking lists with configurable weights"
      />

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by team number..."
          className="pl-12 h-12"
        />
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
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2 className="w-4 h-4 mr-2" />
                    Configure
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Configure {config1.name}</SheetTitle>
                    <SheetDescription>Adjust weights for each metric</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <ConfigPanel config={config1} setConfig={setConfig1} />
                  </div>
                </SheetContent>
              </Sheet>
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
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2 className="w-4 h-4 mr-2" />
                    Configure
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Configure {config2.name}</SheetTitle>
                    <SheetDescription>Adjust weights for each metric</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <ConfigPanel config={config2} setConfig={setConfig2} />
                  </div>
                </SheetContent>
              </Sheet>
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
