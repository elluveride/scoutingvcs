import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
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
import { Loader2, RefreshCw, Download } from 'lucide-react';

interface MatchRow {
  id: string;
  event_code: string;
  match_number: number;
  team_number: number;
  scouter_name: string;
  auto_motifs: number;
  auto_artifacts: number;
  auto_leave: boolean;
  teleop_motifs: number;
  teleop_artifacts: number;
  park_status: string;
  motif_type: string;
  created_at: string;
}

export default function Spreadsheet() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const [entries, setEntries] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!currentEvent) {
    return <Navigate to="/event-select" replace />;
  }

  const loadEntries = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('match_entries')
      .select('*, profiles:scouter_id(name)')
      .eq('event_code', currentEvent.code)
      .order('match_number', { ascending: true })
      .order('team_number', { ascending: true });

    if (data && !error) {
      setEntries(data.map(entry => ({
        id: entry.id,
        event_code: entry.event_code,
        match_number: entry.match_number,
        team_number: entry.team_number,
        scouter_name: (entry.profiles as any)?.name || 'Unknown',
        auto_motifs: entry.auto_motifs,
        auto_artifacts: entry.auto_artifacts,
        auto_leave: entry.auto_leave,
        teleop_motifs: entry.teleop_motifs,
        teleop_artifacts: entry.teleop_artifacts,
        park_status: entry.park_status,
        motif_type: entry.motif_type,
        created_at: entry.created_at,
      })));
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadEntries();

    // Subscribe to realtime updates
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
  }, [currentEvent.code]);

  const exportCSV = () => {
    const headers = [
      'Event Code',
      'Match #',
      'Team #',
      'Scouter',
      'Auto Motifs',
      'Auto Artifacts',
      'Auto Leave',
      'TeleOp Motifs',
      'TeleOp Artifacts',
      'Park Status',
      'Motif Type',
      'Timestamp',
    ];

    const rows = entries.map(e => [
      e.event_code,
      e.match_number,
      e.team_number,
      e.scouter_name,
      e.auto_motifs,
      e.auto_artifacts,
      e.auto_leave ? 'Yes' : 'No',
      e.teleop_motifs,
      e.teleop_artifacts,
      e.park_status,
      e.motif_type,
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
                  <TableHead className="font-semibold">Match</TableHead>
                  <TableHead className="font-semibold">Team</TableHead>
                  <TableHead className="font-semibold">Scouter</TableHead>
                  <TableHead className="font-semibold text-center">Auto M</TableHead>
                  <TableHead className="font-semibold text-center">Auto A</TableHead>
                  <TableHead className="font-semibold text-center">Leave</TableHead>
                  <TableHead className="font-semibold text-center">Tel M</TableHead>
                  <TableHead className="font-semibold text-center">Tel A</TableHead>
                  <TableHead className="font-semibold text-center">Park</TableHead>
                  <TableHead className="font-semibold text-center">Motif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono">{entry.match_number}</TableCell>
                    <TableCell className="font-mono font-semibold">{entry.team_number}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.scouter_name}</TableCell>
                    <TableCell className="text-center">{entry.auto_motifs}</TableCell>
                    <TableCell className="text-center">{entry.auto_artifacts}</TableCell>
                    <TableCell className="text-center">
                      <span className={entry.auto_leave ? 'text-primary' : 'text-muted-foreground'}>
                        {entry.auto_leave ? '✓' : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{entry.teleop_motifs}</TableCell>
                    <TableCell className="text-center">{entry.teleop_artifacts}</TableCell>
                    <TableCell className="text-center capitalize">{entry.park_status}</TableCell>
                    <TableCell className="text-center font-mono">{entry.motif_type}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        {entries.length} entries • Auto-syncing enabled
      </div>
    </AppLayout>
  );
}
