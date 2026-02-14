import React, { useState, useEffect, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, Pencil, Trash2, ArrowUp, ArrowDown, MessageSquare, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { DataExportButtons } from '@/components/data/DataExportButtons';
import { DataQualityAlerts } from '@/components/data/DataQualityAlerts';
import { SpreadsheetFilters } from '@/components/spreadsheet/SpreadsheetFilters';
import type { EndgameReturnStatus, PenaltyStatus } from '@/types/scouting';

const PRIVILEGED_TEAMS = [12841, 2844];

interface MatchRow {
  id: string;
  event_code: string;
  match_number: number;
  team_number: number;
  scouter_id: string;
  scouter_name: string;
  auto_scored_close: number;
  auto_scored_far: number;
  auto_fouls_minor: number;
  auto_fouls_major: number;
  on_launch_line: boolean;
  teleop_scored_close: number;
  teleop_scored_far: number;
  defense_rating: number;
  endgame_return: EndgameReturnStatus;
  penalty_status: PenaltyStatus;
  notes: string;
  created_at: string;
}

type SortKey = 'match_number' | 'team_number' | 'auto_scored_close' | 'auto_scored_far' | 'teleop_scored_close' | 'teleop_scored_far' | 'defense_rating';
type SortDir = 'asc' | 'desc';

export default function Spreadsheet() {
  const { user, profile } = useAuth();
  const { currentEvent } = useEvent();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [entries, setEntries] = useState<MatchRow[]>([]);
  const [allEntries, setAllEntries] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [allLoading, setAllLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MatchRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('team');

  // Filters
  const [teamFilter, setTeamFilter] = useState('');
  const [matchMin, setMatchMin] = useState('');
  const [matchMax, setMatchMax] = useState('');
  const [scouterFilter, setScouterFilter] = useState('all');

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('match_number');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const isAdmin = profile?.role === 'admin';
  const isPrivilegedTeam = profile?.teamNumber != null && PRIVILEGED_TEAMS.includes(profile.teamNumber);

  const loadEntries = React.useCallback(async () => {
    if (!currentEvent) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('match_entries')
      .select('*')
      .eq('event_code', currentEvent.code)
      .order('match_number', { ascending: true })
      .order('team_number', { ascending: true });

    if (data && !error) {
      const scouterIds = Array.from(
        new Set((data as any[]).map((e) => e.scouter_id).filter(Boolean))
      ) as string[];

      const { data: profileRows } = scouterIds.length
        ? await supabase.from('profiles').select('id,name').in('id', scouterIds)
        : { data: [] as any[] };

      const nameById = new Map<string, string>(
        (profileRows || []).map((p: any) => [p.id, p.name])
      );

      setEntries(data.map(entry => ({
        ...entry,
        scouter_name: nameById.get(entry.scouter_id) || 'Unknown',
        notes: (entry as any).notes || '',
      })));
    }
    
    setLoading(false);
  }, [currentEvent]);

  useEffect(() => {
    if (!currentEvent) return;
    loadEntries();

    const channel = supabase
      .channel('match_entries_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'match_entries',
        filter: `event_code=eq.${currentEvent.code}`,
      }, () => {
        loadEntries();
        if (isPrivilegedTeam && activeTab === 'all') loadAllEntries();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentEvent, loadEntries]);

  // Load all-teams data for privileged teams
  const loadAllEntries = React.useCallback(async () => {
    if (!currentEvent || !isPrivilegedTeam) return;
    setAllLoading(true);

    // Privileged teams can see all entries via RLS
    const { data, error } = await supabase
      .from('match_entries')
      .select('*')
      .eq('event_code', currentEvent.code)
      .order('match_number', { ascending: true })
      .order('team_number', { ascending: true });

    if (data && !error) {
      const scouterIds = Array.from(
        new Set(data.map((e: any) => e.scouter_id).filter(Boolean))
      ) as string[];

      const { data: profileRows } = scouterIds.length
        ? await supabase.from('profiles').select('id,name,team_number').in('id', scouterIds)
        : { data: [] as any[] };

      const profileById = new Map(
        (profileRows || []).map((p: any) => [p.id, p])
      );

      // Only show entries scouted by teams OTHER than the privileged teams
      const filtered = data.filter(e => {
        const scouterProfile = profileById.get(e.scouter_id);
        if (!scouterProfile) return false;
        return !PRIVILEGED_TEAMS.includes(scouterProfile.team_number);
      });

      setAllEntries(filtered.map(entry => ({
        ...entry,
        scouter_name: profileById.get(entry.scouter_id)?.name || 'Unknown',
        notes: (entry as any).notes || '',
      })));
    }

    setAllLoading(false);
  }, [currentEvent, isPrivilegedTeam, profile?.teamNumber]);

  useEffect(() => {
    if (isPrivilegedTeam && activeTab === 'all') {
      loadAllEntries();
    }
  }, [activeTab, isPrivilegedTeam, loadAllEntries]);

  // Unique scouter names for filter dropdown
  const scouterNames = useMemo(() => 
    Array.from(new Set(entries.map(e => e.scouter_name))).sort(),
    [entries]
  );

  // Filtered + sorted entries
  const filteredEntries = useMemo(() => {
    let result = entries;

    if (teamFilter) {
      result = result.filter(e => e.team_number.toString().includes(teamFilter));
    }
    if (matchMin) {
      result = result.filter(e => e.match_number >= parseInt(matchMin));
    }
    if (matchMax) {
      result = result.filter(e => e.match_number <= parseInt(matchMax));
    }
    if (scouterFilter && scouterFilter !== 'all') {
      result = result.filter(e => e.scouter_name === scouterFilter);
    }

    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = typeof aVal === 'number' && typeof bVal === 'number' ? aVal - bVal : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [entries, teamFilter, matchMin, matchMax, scouterFilter, sortKey, sortDir]);

  // Detect duplicate entries (same match + team + scouter)
  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    const keyMap = new Map<string, string[]>();
    entries.forEach(e => {
      const key = `${e.match_number}-${e.team_number}-${e.scouter_id}`;
      const existing = keyMap.get(key) || [];
      existing.push(e.id);
      keyMap.set(key, existing);
    });
    keyMap.forEach(idList => {
      if (idList.length > 1) {
        idList.forEach(id => ids.add(id));
      }
    });
    return ids;
  }, [entries]);

  // Apply filters to all entries too
  const filteredAllEntries = useMemo(() => {
    let result = [...allEntries];
    if (teamFilter) result = result.filter(e => e.team_number.toString().includes(teamFilter));
    if (matchMin) result = result.filter(e => e.match_number >= parseInt(matchMin));
    if (matchMax) result = result.filter(e => e.match_number <= parseInt(matchMax));
    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = typeof aVal === 'number' && typeof bVal === 'number' ? aVal - bVal : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [allEntries, teamFilter, matchMin, matchMax, sortKey, sortDir]);

  if (!user) return <Navigate to="/auth" replace />;
  if (!currentEvent) return <Navigate to="/event-select" replace />;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return sortDir === 'asc' 
      ? <ArrowUp className="w-3 h-3 inline ml-1" /> 
      : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  const handleEditRow = (entry: MatchRow) => {
    navigate(`/scout?edit=${entry.id}`);
  };

  const handleDeleteRow = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    
    const { error } = await supabase
      .from('match_entries')
      .delete()
      .eq('id', deleteTarget.id);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete entry.', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: `Entry for Team ${deleteTarget.team_number}, Match ${deleteTarget.match_number} deleted.` });
      loadEntries();
    }
    
    setDeleting(false);
    setDeleteTarget(null);
  };

  const getPenaltyBadge = (status: PenaltyStatus) => {
    switch (status) {
      case 'yellow_card': return <span className="px-2 py-0.5 rounded text-xs bg-warning text-warning-foreground">YC</span>;
      case 'red_card': return <span className="px-2 py-0.5 rounded text-xs bg-destructive text-destructive-foreground">RC</span>;
      case 'dead': return <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">Dead</span>;
      default: return <span className="text-muted-foreground">—</span>;
    }
  };

  const renderTable = (data: MatchRow[], isReadOnly = false) => (
    <div className="data-card overflow-hidden">
      {(isReadOnly ? allLoading : loading) ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {isReadOnly ? 'No data from other teams yet.' : 'No match data yet. Start scouting to see data here.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && !isReadOnly && <TableHead className="w-10"></TableHead>}
                {isAdmin && !isReadOnly && <TableHead className="w-10"></TableHead>}
                <TableHead className="font-semibold cursor-pointer select-none" onClick={() => handleSort('match_number')}>
                  Match<SortIcon column="match_number" />
                </TableHead>
                <TableHead className="font-semibold cursor-pointer select-none" onClick={() => handleSort('team_number')}>
                  Team<SortIcon column="team_number" />
                </TableHead>
                <TableHead className="font-semibold">Scouter</TableHead>
                <TableHead className="font-semibold text-center cursor-pointer select-none" onClick={() => handleSort('auto_scored_close')}>
                  Auto C<SortIcon column="auto_scored_close" />
                </TableHead>
                <TableHead className="font-semibold text-center cursor-pointer select-none" onClick={() => handleSort('auto_scored_far')}>
                  Auto F<SortIcon column="auto_scored_far" />
                </TableHead>
                <TableHead className="font-semibold text-center">Fouls</TableHead>
                <TableHead className="font-semibold text-center">Line</TableHead>
                <TableHead className="font-semibold text-center cursor-pointer select-none" onClick={() => handleSort('teleop_scored_close')}>
                  Tel C<SortIcon column="teleop_scored_close" />
                </TableHead>
                <TableHead className="font-semibold text-center cursor-pointer select-none" onClick={() => handleSort('teleop_scored_far')}>
                  Tel F<SortIcon column="teleop_scored_far" />
                </TableHead>
                <TableHead className="font-semibold text-center cursor-pointer select-none" onClick={() => handleSort('defense_rating')}>
                  Def<SortIcon column="defense_rating" />
                </TableHead>
                <TableHead className="font-semibold text-center">End</TableHead>
                <TableHead className="font-semibold text-center">Pen</TableHead>
                <TableHead className="font-semibold text-center">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((entry) => (
                <TableRow 
                  key={entry.id}
                  className={cn(!isReadOnly && isAdmin && "cursor-pointer hover:bg-muted/50")}
                  onClick={() => !isReadOnly && isAdmin && handleEditRow(entry)}
                >
                  {isAdmin && !isReadOnly && (
                    <TableCell>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  )}
                  {isAdmin && !isReadOnly && (
                    <TableCell>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(entry); }}
                        className="p-1 rounded hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </TableCell>
                  )}
                  <TableCell className="font-mono">
                    {entry.match_number}
                    {!isReadOnly && duplicateIds.has(entry.id) && (
                      <span className="ml-1.5 px-1 py-0.5 rounded text-[10px] bg-warning/20 text-warning font-semibold">
                        DUP
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono font-semibold">{entry.team_number}</TableCell>
                  <TableCell className="text-muted-foreground">{entry.scouter_name}</TableCell>
                  <TableCell className="text-center">{entry.auto_scored_close}</TableCell>
                  <TableCell className="text-center">{entry.auto_scored_far}</TableCell>
                  <TableCell className="text-center">
                    <span className="text-warning">{entry.auto_fouls_minor}</span>
                    /
                    <span className="text-destructive">{entry.auto_fouls_major}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={entry.on_launch_line ? 'text-primary font-semibold' : 'text-muted-foreground'}>
                      {entry.on_launch_line ? 'ON' : 'OFF'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">{entry.teleop_scored_close}</TableCell>
                  <TableCell className="text-center">{entry.teleop_scored_far}</TableCell>
                  <TableCell className="text-center font-mono">{entry.defense_rating}</TableCell>
                  <TableCell className="text-center capitalize text-xs">
                    {entry.endgame_return.replace('_', ' ')}
                  </TableCell>
                  <TableCell className="text-center">{getPenaltyBadge(entry.penalty_status)}</TableCell>
                  <TableCell className="text-center">
                    {entry.notes ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <MessageSquare className="w-4 h-4 text-primary inline-block" />
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[300px]">
                          <p className="text-sm">{entry.notes}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );



  return (
    <AppLayout>
      <PageHeader title="Scouter Spreadsheet" description="Live synchronized match data">
        <Button variant="outline" onClick={() => { loadEntries(); if (isPrivilegedTeam) loadAllEntries(); }} disabled={loading || allLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${(loading || allLoading) ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <DataExportButtons entries={activeTab === 'all' ? allEntries : entries} eventCode={currentEvent.code} />
      </PageHeader>

      {/* Data Quality Alerts */}
      {!loading && entries.length > 0 && activeTab === 'team' && (
        <div className="mb-4">
          <DataQualityAlerts entries={entries} />
        </div>
      )}

      {/* Filters */}
      {!loading && (entries.length > 0 || allEntries.length > 0) && (
        <SpreadsheetFilters
          teamFilter={teamFilter}
          onTeamFilterChange={setTeamFilter}
          matchMin={matchMin}
          onMatchMinChange={setMatchMin}
          matchMax={matchMax}
          onMatchMaxChange={setMatchMax}
          scouterFilter={activeTab === 'team' ? scouterFilter : 'all'}
          onScouterFilterChange={setScouterFilter}
          scouterNames={scouterNames}
        />
      )}

      {isPrivilegedTeam ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="team">Team Data</TabsTrigger>
            <TabsTrigger value="all" className="gap-1.5">
              <Globe className="w-4 h-4" />
              All Teams
            </TabsTrigger>
          </TabsList>
          <TabsContent value="team">
            {renderTable(filteredEntries)}
            <div className="mt-4 text-sm text-muted-foreground">
              {filteredEntries.length}{filteredEntries.length !== entries.length ? ` / ${entries.length}` : ''} entries • Auto-syncing enabled
              {isAdmin && ' • Click row to edit'}
            </div>
          </TabsContent>
          <TabsContent value="all">
            {renderTable(filteredAllEntries, true)}
            <div className="mt-4 text-sm text-muted-foreground">
              {filteredAllEntries.length}{filteredAllEntries.length !== allEntries.length ? ` / ${allEntries.length}` : ''} entries from other teams • Read-only
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {renderTable(filteredEntries)}
          <div className="mt-4 text-sm text-muted-foreground">
            {filteredEntries.length}{filteredEntries.length !== entries.length ? ` / ${entries.length}` : ''} entries • Auto-syncing enabled
            {isAdmin && ' • Click row to edit'}
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the entry for Team {deleteTarget?.team_number}, Match {deleteTarget?.match_number}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRow}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
