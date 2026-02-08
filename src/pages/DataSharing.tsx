import React, { useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { PitSection } from '@/components/match-scout/PitSection';
import {
  Loader2, Share2, Download, Upload, FileJson, FileSpreadsheet,
  CheckCircle2, AlertTriangle, ArrowRightLeft,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ImportFileSchema, MatchEntryImportSchema } from '@/lib/importValidation';

export default function DataSharing() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; duplicates: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return <Navigate to="/auth" replace />;
  if (!currentEvent) return <Navigate to="/event-select" replace />;

  const exportForSharing = async (format: 'json' | 'csv') => {
    setLoading(true);

    const { data } = await supabase
      .from('match_entries')
      .select('*')
      .eq('event_code', currentEvent.code)
      .order('match_number');

    if (!data || data.length === 0) {
      toast({ title: 'No Data', description: 'No scouting data to export.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Standardized export format
    const shareData = {
      format_version: '1.0',
      event_code: currentEvent.code,
      event_name: currentEvent.name,
      exported_at: new Date().toISOString(),
      entries: data.map(e => ({
        team_number: e.team_number,
        match_number: e.match_number,
        auto_scored_close: e.auto_scored_close,
        auto_scored_far: e.auto_scored_far,
        auto_fouls_minor: e.auto_fouls_minor,
        auto_fouls_major: e.auto_fouls_major,
        on_launch_line: e.on_launch_line,
        teleop_scored_close: e.teleop_scored_close,
        teleop_scored_far: e.teleop_scored_far,
        defense_rating: e.defense_rating,
        endgame_return: e.endgame_return,
        penalty_status: e.penalty_status,
      })),
    };

    if (format === 'json') {
      downloadBlob(JSON.stringify(shareData, null, 2), `${currentEvent.code}_shared_data.json`, 'application/json');
    } else {
      const headers = [
        'team_number', 'match_number',
        'auto_scored_close', 'auto_scored_far', 'auto_fouls_minor', 'auto_fouls_major',
        'on_launch_line', 'teleop_scored_close', 'teleop_scored_far',
        'defense_rating', 'endgame_return', 'penalty_status',
      ];
      const rows = shareData.entries.map(e =>
        headers.map(h => {
          const val = (e as any)[h];
          return typeof val === 'boolean' ? (val ? 'true' : 'false') : val;
        })
      );
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      downloadBlob(csv, `${currentEvent.code}_shared_data.csv`, 'text/csv');
    }

    toast({ title: 'Exported', description: `${data.length} entries exported as ${format.toUpperCase()}.` });
    setLoading(false);
  };

  const importSharedData = async (file: File) => {
    setImporting(true);
    setImportResults(null);

    try {
      const text = await file.text();
      let entries: any[];

      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        // Try parsing as full export format first, then as raw array
        const fileResult = ImportFileSchema.safeParse(parsed);
        if (fileResult.success) {
          entries = fileResult.data.entries;
        } else {
          const rawArray = Array.isArray(parsed) ? parsed : parsed.entries;
          if (!Array.isArray(rawArray)) throw new Error('Invalid JSON format: expected entries array');
          // Validate each entry individually, skip invalid ones
          entries = rawArray.map((item: unknown) => {
            const result = MatchEntryImportSchema.safeParse(item);
            return result.success ? result.data : null;
          }).filter(Boolean);
          if (entries.length === 0) throw new Error('No valid entries found in file');
        }
      } else if (file.name.endsWith('.csv')) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');
        const headers = lines[0].split(',').map(h => h.trim());
        const rawEntries = lines.slice(1).filter(l => l.trim()).map(line => {
          const values = line.split(',');
          const obj: any = {};
          headers.forEach((h, i) => {
            const v = values[i]?.trim();
            if (v === 'true') obj[h] = true;
            else if (v === 'false') obj[h] = false;
            else if (!isNaN(Number(v)) && v !== '') obj[h] = Number(v);
            else obj[h] = v;
          });
          return obj;
        });
        // Validate each parsed CSV row
        entries = rawEntries.map((item: unknown) => {
          const result = MatchEntryImportSchema.safeParse(item);
          return result.success ? result.data : null;
        }).filter(Boolean);
        if (entries.length === 0) throw new Error('No valid entries found in CSV');
      } else {
        throw new Error('Unsupported file format. Use JSON or CSV.');
      }

      let success = 0;
      let duplicates = 0;
      let errors = 0;

      for (const entry of entries) {
        if (!entry.team_number || !entry.match_number) {
          errors++;
          continue;
        }

        const { error } = await supabase.from('match_entries').upsert({
          event_code: currentEvent.code,
          team_number: entry.team_number,
          match_number: entry.match_number,
          auto_scored_close: entry.auto_scored_close || 0,
          auto_scored_far: entry.auto_scored_far || 0,
          auto_fouls_minor: entry.auto_fouls_minor || 0,
          auto_fouls_major: entry.auto_fouls_major || 0,
          on_launch_line: entry.on_launch_line ?? false,
          teleop_scored_close: entry.teleop_scored_close || 0,
          teleop_scored_far: entry.teleop_scored_far || 0,
          defense_rating: entry.defense_rating || 0,
          endgame_return: entry.endgame_return || 'not_returned',
          penalty_status: entry.penalty_status || 'none',
          scouter_id: user.id,
        }, { onConflict: 'event_code,team_number,match_number,scouter_id' });

        if (error) {
          if (error.code === '23505') duplicates++;
          else errors++;
        } else {
          success++;
        }
      }

      setImportResults({ success, duplicates, errors });
      toast({
        title: 'Import Complete',
        description: `${success} imported, ${duplicates} duplicates, ${errors} errors.`,
      });
    } catch (e) {
      toast({
        title: 'Import Failed',
        description: e instanceof Error ? e.message : 'Could not parse file.',
        variant: 'destructive',
      });
    }

    setImporting(false);
  };

  return (
    <AppLayout>
      <PageHeader title="Data Sharing" description="Share and import scouting data with other teams" />

      <div className="space-y-6 max-w-lg">
        {/* Export */}
        <PitSection title="Export for Sharing" icon={Share2}>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Export your team's scouting data in a standardized format to share with alliance partners.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => exportForSharing('json')}
                disabled={loading}
                className="flex-1 h-12 gap-2"
              >
                <FileJson className="w-4 h-4" />
                Export JSON
              </Button>
              <Button
                variant="secondary"
                onClick={() => exportForSharing('csv')}
                disabled={loading}
                className="flex-1 h-12 gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </PitSection>

        {/* Import */}
        <PitSection title="Import Shared Data" icon={Download}>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Import scouting data from another team. Supports JSON and CSV formats.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) importSharedData(file);
              }}
            />

            <Button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="w-full h-14 gap-2"
            >
              {importing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              {importing ? 'Importing...' : 'Select File to Import'}
            </Button>

            {importResults && (
              <div className="space-y-2 rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="font-mono">{importResults.success} entries imported</span>
                </div>
                {importResults.duplicates > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ArrowRightLeft className="w-4 h-4" />
                    <span className="font-mono">{importResults.duplicates} duplicates (updated)</span>
                  </div>
                )}
                {importResults.errors > 0 && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-mono">{importResults.errors} errors</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </PitSection>

        {/* Format Info */}
        <div className="data-card text-xs text-muted-foreground space-y-2">
          <h4 className="font-display font-semibold text-foreground text-sm">Standardized Format</h4>
          <p>All exports use the same schema so any team running Cipher can import data from another Cipher team.</p>
          <p>CSV files can also be opened in Google Sheets or Excel for manual analysis.</p>
          <p>Imported data will be attributed to your account. Duplicate team+match combinations will be updated.</p>
        </div>
      </div>
    </AppLayout>
  );
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
