import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useFTCRankings } from '@/hooks/useFTCRankings';
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
import type { PenaltyStatus } from '@/types/scouting';
import { useSeason } from '@/hooks/useSeason';
import { tableColumnsByPhase, type TableColumn } from '@/seasons/fields';
import { scoreEntry } from '@/lib/seasonScoring';
import { detectMatchConflicts, type ConflictRow } from '@/lib/missingData';

const PRIVILEGED_TEAMS = [12841, 2844];

/**
 * One scouted row.
 *
 * Only the columns every season shares are named; the scoring columns depend on
 * the active game and are read through `tableColumns(season)`.
 */
interface MatchRow {
  id: string;
  event_code: string;
  match_number: number;
  team_number: number;
  scouter_id: string;
  scouter_name: string;
  auto_fouls_minor: number;
  auto_fouls_major: number;
  defense_rating: number;
  penalty_status: PenaltyStatus;
  notes: string;
  created_at: string;
  [column: string]: unknown;
}

/** Any numeric column can be sorted on, so this is a column name. */
type SortKey = string;
type SortDir = 'asc' | 'desc';

export default function Spreadsheet() {
  const { user, profile } = useAuth();
  const { currentEvent } = useEvent();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getTeamName } = useFTCRankings();
  const season = useSeason();

  // Score columns follow the active season; the meta / fouls / endgame-status
  // blocks around them are the same whatever the game.
  const columns = useMemo(() => tableColumnsByPhase(season), [season]);
  const allColumns = useMemo(
    () => [...columns.auto, ...columns.teleop, ...columns.endgame],
    [columns],
  );
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
        ? await supabase.from('profiles').select('id,name,team_number').in('id', scouterIds)
        : { data: [] as any[] };

      const profileById = new Map(
        (profileRows || []).map((p: any) => [p.id, p])
      );

      // For privileged teams, filter Team Data to only show own team + allied team entries
      const filtered = isPrivilegedTeam
        ? data.filter(entry => {
            const scouterProfile = profileById.get(entry.scouter_id);
            return scouterProfile && PRIVILEGED_TEAMS.includes(scouterProfile.team_number);
          })
        : data;

      setEntries(filtered.map(entry => ({
        ...entry,
        scouter_name: profileById.get(entry.scouter_id)?.name || 'Unknown',
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

  /**
   * Sorts on any numeric column the season declares, plus the synthetic
   * `__total` column (points for the match, which no single column holds).
   */
  const compareBySortKey = useCallback((a: MatchRow, b: MatchRow) => {
    const valueOf = (row: MatchRow) =>
      sortKey === '__total' ? scoreEntry(season, row).total : Number(row[sortKey] ?? 0);
    const aVal = valueOf(a);
    const bVal = valueOf(b);
    const cmp = Number.isFinite(aVal) && Number.isFinite(bVal) ? aVal - bVal : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  }, [sortKey, sortDir, season]);

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

    result.sort(compareBySortKey);

    return result;
  }, [entries, teamFilter, matchMin, matchMax, scouterFilter, compareBySortKey]);

  // Detect duplicate entries (same match + team + scouter) AND
  // cross-scouter conflicts (same match + team, different totals between scouters).
  const { duplicateIds, conflictIds } = useMemo(() => {
    const dupes = new Set<string>();
    const conflicts = new Set<string>();
    const dupeKey = new Map<string, string[]>();        // match-team-scouter -> ids

    entries.forEach(e => {
      const dk = `${e.match_number}-${e.team_number}-${e.scouter_id}`;
      const existing = dupeKey.get(dk) || [];
      existing.push(e.id);
      dupeKey.set(dk, existing);

    });

    dupeKey.forEach(ids => { if (ids.length > 1) ids.forEach(id => dupes.add(id)); });

    // Conflict = two scouters' totals for the same match/team differ by >= 4
    // points, priced with the active season. Shared with the rest of the app so
    // "conflict" means one thing — under BIOBUZZ a single hive tip is already 20.
    for (const id of detectMatchConflicts(season, entries as unknown as ConflictRow[])) {
      conflicts.add(id);
    }

    return { duplicateIds: dupes, conflictIds: conflicts };
  }, [entries, season]);

  // Apply filters to all entries too
  const filteredAllEntries = useMemo(() => {
    let result = [...allEntries];
    if (teamFilter) result = result.filter(e => e.team_number.toString().includes(teamFilter));
    if (matchMin) result = result.filter(e => e.match_number >= parseInt(matchMin));
    if (matchMax) result = result.filter(e => e.match_number <= parseInt(matchMax));
    result.sort(compareBySortKey);
    return result;
  }, [allEntries, teamFilter, matchMin, matchMax, compareBySortKey]);

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

  /** A season-driven score column header, sortable when the column is numeric. */
  const ScoreHead = ({ col }: { col: TableColumn }) => (
    <TableHead
      className={cn('font-semibold text-center', col.sortable && 'cursor-pointer select-none')}
      onClick={col.sortable ? () => handleSort(col.key) : undefined}
      title={col.label}
    >
      {col.short}
      {col.sortable && <SortIcon column={col.key} />}
    </TableHead>
  );

  /** The matching cell, rendered by the column's declared type. */
  const ScoreCell = ({ col, entry }: { col: TableColumn; entry: MatchRow }) => {
    const value = entry[col.key];
    if (col.type === 'bool') {
      return (
        <TableCell className="text-center">
          <span className={value ? 'text-primary font-semibold' : 'text-muted-foreground'}>
            {value ? 'YES' : '—'}
          </span>
        </TableCell>
      );
    }
    if (col.type === 'enum') {
      return (
        <TableCell className="text-center capitalize text-xs">
          {String(value ?? '').replace(/_/g, ' ') || '—'}
        </TableCell>
      );
    }
    return <TableCell className="text-center">{Number(value ?? 0)}</TableCell>;
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
            <TableHeader className="sticky top-0 z-10 bg-card">
              {/* Column-group header. Spans follow the season's column counts,
                  so a game with four TeleOp elements gets a four-wide TeleOp band. */}
              <TableRow className="border-b border-border/30">
                {isAdmin && !isReadOnly && <TableHead className="w-10 p-0" />}
                {isAdmin && !isReadOnly && <TableHead className="w-10 p-0" />}
                <TableHead colSpan={3} className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-mono py-1 border-r border-border/40">Meta</TableHead>
                <TableHead colSpan={columns.auto.length + 1} className="text-[10px] uppercase tracking-[0.15em] text-primary font-mono py-1 text-center border-r border-border/40 bg-primary/5">Auto</TableHead>
                <TableHead colSpan={columns.teleop.length + 1} className="text-[10px] uppercase tracking-[0.15em] text-secondary font-mono py-1 text-center border-r border-border/40 bg-secondary/5">TeleOp</TableHead>
                <TableHead colSpan={columns.endgame.length + 3} className="text-[10px] uppercase tracking-[0.15em] text-accent font-mono py-1 text-center bg-accent/5">Endgame / Notes</TableHead>
              </TableRow>
              <TableRow>
                {isAdmin && !isReadOnly && <TableHead className="w-10"></TableHead>}
                {isAdmin && !isReadOnly && <TableHead className="w-10"></TableHead>}
                <TableHead className="font-semibold cursor-pointer select-none" onClick={() => handleSort('match_number')}>
                  Match<SortIcon column="match_number" />
                </TableHead>
                <TableHead className="font-semibold cursor-pointer select-none" onClick={() => handleSort('team_number')}>
                  Team<SortIcon column="team_number" />
                </TableHead>
                <TableHead className="font-semibold border-r border-border/40">Scouter</TableHead>

                {columns.auto.map((col) => <ScoreHead key={col.key} col={col} />)}
                <TableHead className="font-semibold text-center border-r border-border/40" title="Minor / major fouls">Fouls</TableHead>

                {columns.teleop.map((col) => <ScoreHead key={col.key} col={col} />)}
                <TableHead className="font-semibold text-center cursor-pointer select-none border-r border-border/40" onClick={() => handleSort('defense_rating')}>
                  Def<SortIcon column="defense_rating" />
                </TableHead>

                {columns.endgame.map((col) => <ScoreHead key={col.key} col={col} />)}
                <TableHead className="font-semibold text-center cursor-pointer select-none" onClick={() => handleSort('__total')} title="Total points this match">
                  Pts<SortIcon column="__total" />
                </TableHead>
                <TableHead className="font-semibold text-center">Pen</TableHead>
                <TableHead className="font-semibold text-center">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((entry) => {
                const isConflict = !isReadOnly && conflictIds.has(entry.id);
                const isDup = !isReadOnly && duplicateIds.has(entry.id);
                return (
                <TableRow
                  key={entry.id}
                  className={cn(
                    !isReadOnly && isAdmin && "cursor-pointer hover:bg-muted/50",
                    isConflict && "border-l-2 border-l-destructive bg-destructive/5",
                    !isConflict && isDup && "border-l-2 border-l-warning bg-warning/5",
                  )}
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
                    {isDup && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-1.5 px-1 py-0.5 rounded text-[10px] bg-warning/20 text-warning font-semibold">DUP</span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[220px]">
                          <p className="text-xs">Same scouter submitted this match/team more than once.</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {isConflict && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-1.5 px-1 py-0.5 rounded text-[10px] bg-destructive/20 text-destructive font-semibold">CONFLICT</span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[260px]">
                          <p className="text-xs">Multiple scouters scored this team in this match with totals differing by 4+ pts. Review and pick the correct entry.</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell className="font-mono font-semibold">
                    {entry.team_number}
                    {getTeamName(entry.team_number) && (
                      <span className="ml-1.5 text-xs font-sans font-normal text-muted-foreground">{getTeamName(entry.team_number)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{entry.scouter_name}</TableCell>

                  {columns.auto.map((col) => <ScoreCell key={col.key} col={col} entry={entry} />)}
                  <TableCell className="text-center border-r border-border/40">
                    <span className="text-warning">{entry.auto_fouls_minor}</span>
                    /
                    <span className="text-destructive">{entry.auto_fouls_major}</span>
                  </TableCell>

                  {columns.teleop.map((col) => <ScoreCell key={col.key} col={col} entry={entry} />)}
                  <TableCell className="text-center font-mono border-r border-border/40">{entry.defense_rating}</TableCell>

                  {columns.endgame.map((col) => <ScoreCell key={col.key} col={col} entry={entry} />)}
                  <TableCell className="text-center font-mono font-semibold">
                    {scoreEntry(season, entry).total}
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
                );
              })}
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
