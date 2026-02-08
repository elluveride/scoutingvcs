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
  Loader2, Users, ClipboardList, Shuffle,
  ChevronDown, ChevronUp, CheckCircle2, Save,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ScouterProfile {
  id: string;
  name: string;
}

interface Assignment {
  scouterName: string;
  scouterId: string;
  matchNumber: number;
  teamNumber: number;
  position: string;
}

export default function ScouterAssignments() {
  const { user, isAdmin } = useAuth();
  const { currentEvent } = useEvent();
  const { matches, loading: matchesLoading } = useFTCMatches();
  const { toast } = useToast();

  const [scouters, setScouters] = useState<ScouterProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [numScouters, setNumScouters] = useState(4);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch team scouters and saved assignments on mount
  useEffect(() => {
    loadScouters();
  }, []);

  useEffect(() => {
    if (currentEvent) loadSavedAssignments();
  }, [currentEvent]);

  const loadScouters = async () => {
    setLoading(true);
    const { data: profile } = await supabase
      .from('profiles')
      .select('team_number')
      .eq('id', user!.id)
      .single();

    if (profile?.team_number) {
      const { data } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('team_number', profile.team_number)
        .eq('status', 'approved');
      setScouters(data || []);
    }
    setLoading(false);
  };

  const loadSavedAssignments = async () => {
    if (!currentEvent) return;
    const { data } = await supabase
      .from('scouter_assignments')
      .select('*')
      .eq('event_code', currentEvent.code)
      .order('match_number', { ascending: true });

    if (data && data.length > 0) {
      // Need scouter names
      const scouterIds = Array.from(new Set(data.map(a => a.scouter_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', scouterIds);
      
      const nameMap = new Map((profiles || []).map(p => [p.id, p.name]));

      setAssignments(data.map(a => ({
        scouterName: nameMap.get(a.scouter_id) || 'Unknown',
        scouterId: a.scouter_id,
        matchNumber: a.match_number,
        teamNumber: a.team_number,
        position: a.position,
      })));
    }
  };

  // Auto-generate assignments using round-robin
  const generateAssignments = () => {
    if (matches.length === 0 || scouters.length === 0) return;

    const activeScouters = scouters.slice(0, numScouters);
    const newAssignments: Assignment[] = [];
    let scouterIndex = 0;

    matches.forEach(match => {
      match.positions.forEach(pos => {
        const scouter = activeScouters[scouterIndex % activeScouters.length];
        newAssignments.push({
          scouterName: scouter.name,
          scouterId: scouter.id,
          matchNumber: match.matchNumber,
          teamNumber: pos.teamNumber,
          position: pos.position,
        });
        scouterIndex++;
      });
    });

    setAssignments(newAssignments);
    toast({ title: 'Assignments Generated', description: `${newAssignments.length} assignments created for ${activeScouters.length} scouters. Save to persist.` });
  };

  // Save assignments to database
  const saveAssignments = async () => {
    if (!currentEvent || assignments.length === 0) return;
    setSaving(true);

    // Delete existing assignments for this event
    await supabase
      .from('scouter_assignments')
      .delete()
      .eq('event_code', currentEvent.code);

    // Insert new assignments
    const rows = assignments.map(a => ({
      event_code: currentEvent.code,
      match_number: a.matchNumber,
      team_number: a.teamNumber,
      position: a.position,
      scouter_id: a.scouterId,
      created_by: user!.id,
    }));

    const { error } = await supabase
      .from('scouter_assignments')
      .insert(rows);

    setSaving(false);

    if (error) {
      toast({ title: 'Error', description: 'Failed to save assignments.', variant: 'destructive' });
    } else {
      toast({ title: 'Saved!', description: `${assignments.length} assignments saved and will persist across sessions.` });
    }
  };

  // Group assignments by match
  const assignmentsByMatch = useMemo(() => {
    const grouped = new Map<number, Assignment[]>();
    assignments.forEach(a => {
      const existing = grouped.get(a.matchNumber) || [];
      existing.push(a);
      grouped.set(a.matchNumber, existing);
    });
    return grouped;
  }, [assignments]);

  // Track which entries have been completed
  const [completedEntries, setCompletedEntries] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentEvent || assignments.length === 0) return;
    checkCompletion();
  }, [currentEvent, assignments]);

  const checkCompletion = async () => {
    if (!currentEvent) return;
    const { data } = await supabase
      .from('match_entries')
      .select('match_number, team_number, scouter_id')
      .eq('event_code', currentEvent.code);

    if (data) {
      const completed = new Set(data.map(e => `${e.match_number}-${e.team_number}-${e.scouter_id}`));
      setCompletedEntries(completed);
    }
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (!currentEvent) return <Navigate to="/event-select" replace />;

  const myAssignments = assignments.filter(a => a.scouterId === user.id);

  return (
    <AppLayout>
      <PageHeader
        title="Scouter Assignments"
        description="Organize who scouts which team per match"
      />

      {loading || matchesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6 max-w-2xl">
          {/* My Assignments */}
          {myAssignments.length > 0 && (
            <PitSection title="My Assignments" icon={ClipboardList}>
              <div className="space-y-2">
                {myAssignments.map((a, i) => {
                  const key = `${a.matchNumber}-${a.teamNumber}-${a.scouterId}`;
                  const done = completedEntries.has(key);
                  return (
                    <div key={i} className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      done ? "border-success/30 bg-success/5" : "border-border"
                    )}>
                      <div className="flex items-center gap-3">
                        {done && <CheckCircle2 className="w-4 h-4 text-success" />}
                        <span className="font-mono text-sm">M{a.matchNumber}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-semibold",
                          a.position.startsWith('B') ? "bg-alliance-blue/20 text-alliance-blue" : "bg-alliance-red/20 text-alliance-red"
                        )}>
                          {a.position}
                        </span>
                      </div>
                      <span className="font-display font-bold">{a.teamNumber}</span>
                    </div>
                  );
                })}
              </div>
            </PitSection>
          )}

          {/* Config (admin) */}
          {isAdmin && (
            <PitSection title="Assignment Config" icon={Users}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-mono text-muted-foreground">
                    Active Scouters ({scouters.length} available)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={scouters.length}
                    value={numScouters}
                    onChange={e => setNumScouters(Math.min(scouters.length, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="h-12 font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    {numScouters <= 2 ? 'Each scouter will cover 2 teams per match.' :
                     numScouters >= 4 ? 'Each scouter covers 1 team per match.' :
                     'Some scouters may cover 2 teams.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {scouters.slice(0, numScouters).map(s => (
                    <span key={s.id} className="px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-mono">
                      {s.name}
                    </span>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={generateAssignments}
                    disabled={matches.length === 0}
                    className="flex-1 h-14 gap-2"
                  >
                    <Shuffle className="w-5 h-5" />
                    Generate
                  </Button>
                  <Button
                    onClick={saveAssignments}
                    disabled={assignments.length === 0 || saving}
                    variant="outline"
                    className="flex-1 h-14 gap-2"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save
                  </Button>
                </div>
              </div>
            </PitSection>
          )}

          {/* All Assignments by Match */}
          {assignments.length > 0 && isAdmin && (
            <PitSection title="All Assignments" icon={ClipboardList}>
              <div className="space-y-1">
                {Array.from(assignmentsByMatch.entries()).map(([matchNum, assigns]) => (
                  <div key={matchNum} className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedMatch(expandedMatch === matchNum ? null : matchNum)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-mono text-sm font-semibold">Match {matchNum}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {assigns.filter(a => completedEntries.has(`${a.matchNumber}-${a.teamNumber}-${a.scouterId}`)).length}/{assigns.length} done
                        </span>
                        {expandedMatch === matchNum ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>
                    {expandedMatch === matchNum && (
                      <div className="border-t border-border p-3 space-y-1">
                        {assigns.map((a, i) => {
                          const done = completedEntries.has(`${a.matchNumber}-${a.teamNumber}-${a.scouterId}`);
                          return (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                {done ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30" />}
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-xs",
                                  a.position.startsWith('B') ? "bg-alliance-blue/20 text-alliance-blue" : "bg-alliance-red/20 text-alliance-red"
                                )}>
                                  {a.position}
                                </span>
                                <span className="font-mono">{a.teamNumber}</span>
                              </div>
                              <span className="text-muted-foreground text-xs">{a.scouterName}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </PitSection>
          )}
        </div>
      )}
    </AppLayout>
  );
}
