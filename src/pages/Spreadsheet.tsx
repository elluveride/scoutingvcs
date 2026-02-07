import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, RefreshCw, Download, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { EndgameReturnStatus, PenaltyStatus } from '@/types/scouting';

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
  created_at: string;
}

export default function Spreadsheet() {
  const { user, profile } = useAuth();
  const { currentEvent } = useEvent();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [entries, setEntries] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<MatchRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = profile?.role === 'admin';

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
        ? await supabase
            .from('profiles')
            .select('id,name')
            .in('id', scouterIds)
        : { data: [] as any[] };

      const nameById = new Map<string, string>(
        (profileRows || []).map((p: any) => [p.id, p.name])
      );

      setEntries(data.map(entry => ({
        ...entry,
        scouter_name: nameById.get(entry.scouter_id) || 'Unknown',
      })));
    }
    
    setLoading(false);
  }, [currentEvent]);

  useEffect(() => {
    if (!currentEvent) return;
    loadEntries();

    const channel = supabase
      .channel('match_entries_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_entries',
          filter: `event_code=eq.${currentEvent.code}`,
        },
        () => {
          loadEntries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentEvent, loadEntries]);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!currentEvent) {
    return <Navigate to="/event-select" replace />;
  }

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
      toast({
        title: 'Error',
        description: 'Failed to delete entry.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Deleted',
        description: `Entry for Team ${deleteTarget.team_number}, Match ${deleteTarget.match_number} deleted.`,
      });
      loadEntries();
    }
    
    setDeleting(false);
    setDeleteTarget(null);
  };

  const exportCSV = () => {
    const headers = [
      'Event Code',
      'Match #',
      'Team #',
      'Scouter',
      'Auto Close',
      'Auto Far',
      'Minor Fouls',
      'Major Fouls',
      'Launch Line',
      'TeleOp Close',
      'TeleOp Far',
      'Defense',
      'Endgame',
      'Penalty',
      'Timestamp',
    ];

    const rows = entries.map(e => [
      e.event_code,
      e.match_number,
      e.team_number,
      e.scouter_name,
      e.auto_scored_close,
      e.auto_scored_far,
      e.auto_fouls_minor,
      e.auto_fouls_major,
      e.on_launch_line ? 'ON' : 'OFF',
      e.teleop_scored_close,
      e.teleop_scored_far,
      e.defense_rating,
      e.endgame_return,
      e.penalty_status,
      new Date(e.created_at).toLocaleString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentEvent.code}_scouting_data.csv`;
    a.click();
  };

  const getPenaltyBadge = (status: PenaltyStatus) => {
    switch (status) {
      case 'yellow_card': return <span className="px-2 py-0.5 rounded text-xs bg-yellow-500 text-white">YC</span>;
      case 'red_card': return <span className="px-2 py-0.5 rounded text-xs bg-red-500 text-white">RC</span>;
      case 'dead': return <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">Dead</span>;
      default: return <span className="text-muted-foreground">—</span>;
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Scouter Spreadsheet"
        description="Live synchronized match data"
      >
        <Button variant="outline" onClick={loadEntries} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="secondary" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </PageHeader>

      <div className="data-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No match data yet. Start scouting to see data here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                   {isAdmin && <TableHead className="w-10"></TableHead>}
                  {isAdmin && <TableHead className="w-10"></TableHead>}
                  <TableHead className="font-semibold">Match</TableHead>
                  <TableHead className="font-semibold">Team</TableHead>
                  <TableHead className="font-semibold">Scouter</TableHead>
                  <TableHead className="font-semibold text-center">Auto C</TableHead>
                  <TableHead className="font-semibold text-center">Auto F</TableHead>
                  <TableHead className="font-semibold text-center">Fouls</TableHead>
                  <TableHead className="font-semibold text-center">Line</TableHead>
                  <TableHead className="font-semibold text-center">Tel C</TableHead>
                  <TableHead className="font-semibold text-center">Tel F</TableHead>
                  <TableHead className="font-semibold text-center">Def</TableHead>
                  <TableHead className="font-semibold text-center">End</TableHead>
                  <TableHead className="font-semibold text-center">Pen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                   <TableRow 
                    key={entry.id}
                    className={cn(isAdmin && "cursor-pointer hover:bg-muted/50")}
                    onClick={() => isAdmin && handleEditRow(entry)}
                  >
                    {isAdmin && (
                      <TableCell>
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(entry);
                          }}
                          className="p-1 rounded hover:bg-destructive/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </TableCell>
                    )}
                    <TableCell className="font-mono">{entry.match_number}</TableCell>
                    <TableCell className="font-mono font-semibold">{entry.team_number}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.scouter_name}</TableCell>
                    <TableCell className="text-center">{entry.auto_scored_close}</TableCell>
                    <TableCell className="text-center">{entry.auto_scored_far}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-yellow-600">{entry.auto_fouls_minor}</span>
                      /
                      <span className="text-red-600">{entry.auto_fouls_major}</span>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        {entries.length} entries • Auto-syncing enabled
        {isAdmin && ' • Click row to edit'}
      </div>

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
