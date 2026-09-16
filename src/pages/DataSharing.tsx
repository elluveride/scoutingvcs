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
import {
  importFileSchema, entrySchema, exportColumns, IMPORT_FORMAT_VERSION, type ValidatedEntry,
} from '@/lib/importValidation';
import { useSeason } from '@/hooks/useSeason';

export default function DataSharing() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const { toast } = useToast();
  const season = useSeason();

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

    // Standardized export format — columns come from the active season, so a
    // file always carries exactly what the scout app collects.
    const columns = exportColumns(season, 'match');
    const shareData = {
      format_version: IMPORT_FORMAT_VERSION,
      season_id: season.id,
      event_code: currentEvent.code,
      event_name: currentEvent.name,
      exported_at: new Date().toISOString(),
      entries: (data as unknown as Record<string, unknown>[]).map(e =>
        Object.fromEntries(columns.map(c => [c, e[c]]))
      ),
    };

    if (format === 'json') {
      downloadBlob(JSON.stringify(shareData, null, 2), `${currentEvent.code}_shared_data.json`, 'application/json');
    } else {
      const rows = shareData.entries.map(e =>
        columns.map(h => {
          const val = e[h];
          if (typeof val === 'boolean') return val ? 'true' : 'false';
          // Notes can contain commas; quote every text cell rather than guess.
          if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
          return val ?? '';
        })
      );
      const csv = [columns, ...rows].map(r => r.join(',')).join('\n');
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
      let entries: ValidatedEntry[];

      // Enforce import size limit
      if (text.length > 5 * 1024 * 1024) {
        throw new Error('File too large. Maximum file size is 5MB.');
      }

      const rowSchema = entrySchema(season, 'match');
      const keepValid = (rows: unknown[]): ValidatedEntry[] =>
        rows
          .map((item) => rowSchema.safeParse(item))
          .filter((r): r is { success: true; data: ValidatedEntry } => r.success)
          .map((r) => r.data);

      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        const fileResult = importFileSchema(season, 'match').safeParse(parsed);
        if (fileResult.success) {
          // A file exported under another game keeps only its shared columns —
          // say so rather than quietly importing a half-empty entry.
          if (fileResult.data.season_id && fileResult.data.season_id !== season.id) {
            toast({
              title: 'Different season',
              description: `File is from '${fileResult.data.season_id}', this event runs '${season.id}'. Only columns both games share were imported.`,
              variant: 'destructive',
            });
          }
          entries = fileResult.data.entries as ValidatedEntry[];
        } else {
          const rawArray = Array.isArray(parsed) ? parsed : parsed.entries;
          if (!Array.isArray(rawArray)) throw new Error('Invalid JSON format: expected entries array');
          entries = keepValid(rawArray);
          if (entries.length === 0) throw new Error('No valid entries found in file');
        }
      } else if (file.name.endsWith('.csv')) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');
        const headers = lines[0].split(',').map(h => h.trim());
        const rawEntries = lines.slice(1).filter(l => l.trim()).map(line => {
          const values = line.split(',');
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => {
            const v = values[i]?.trim().replace(/^"|"$/g, '');
            if (v === 'true') obj[h] = true;
            else if (v === 'false') obj[h] = false;
            else if (v !== '' && v !== undefined && !isNaN(Number(v))) obj[h] = Number(v);
            else obj[h] = v;
          });
          return obj;
        });
        entries = keepValid(rawEntries);
        if (entries.length === 0) throw new Error('No valid entries found in CSV');
      } else {
        throw new Error('Unsupported file format. Use JSON or CSV.');
      }

      // Limit number of entries to prevent resource exhaustion
      if (entries.length > 500) {
        throw new Error('Import limited to 500 entries at a time. Please split your file.');
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
          ...entry,
          event_code: currentEvent.code,
          scouter_id: user.id,
        } as never, { onConflict: 'event_code,team_number,match_number,scouter_id' });

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
          <p>All exports use the same schema so any team running Apex Scout can import data from another Apex Scout team.</p>
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
