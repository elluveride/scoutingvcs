import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { useSeason } from '@/hooks/useSeason';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { PitSection } from '@/components/match-scout/PitSection';
import { EntryQRCard } from '@/components/scout/EntryQRCard';
import {
  Loader2, ScanLine, Download, Upload, CheckCircle2, AlertTriangle, ClipboardList, Wrench,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { decodePayload, entryKey, type EntryKind } from '@/lib/qrPayload';
import { seasonById } from '@/seasons';
import { cn } from '@/lib/utils';

type Row = Record<string, number | boolean | string>;

interface ScannedRow {
  kind: EntryKind;
  row: Row;
  /** This entry already exists in the cloud for this event. */
  duplicate: boolean;
}

const KIND_META: Record<EntryKind, { label: string; table: 'match_entries' | 'pit_entries'; icon: typeof ClipboardList }> = {
  match: { label: 'Match', table: 'match_entries', icon: ClipboardList },
  pit: { label: 'Pit', table: 'pit_entries', icon: Wrench },
};

export default function QRTransfer() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const season = useSeason();
  const { toast } = useToast();

  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [sendKind, setSendKind] = useState<EntryKind>('match');
  const [matchEntries, setMatchEntries] = useState<Row[]>([]);
  const [pitEntries, setPitEntries] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<ScannedRow[]>([]);
  const [importing, setImporting] = useState(false);
  /** "team-match" / "team" keys that already exist in the cloud, per kind. */
  const cloudKeysRef = useRef<Record<EntryKind, Set<string>>>({ match: new Set(), pit: new Set() });
  const scannerRef = useRef<{ clear: () => Promise<void> } | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  const eventCode = currentEvent?.code ?? '';

  const loadEntries = useCallback(async () => {
    if (!eventCode) return;
    setLoading(true);
    const [matchRes, pitRes] = await Promise.all([
      supabase.from('match_entries').select('*').eq('event_code', eventCode).order('match_number'),
      supabase.from('pit_entries').select('*').eq('event_code', eventCode).order('team_number'),
    ]);
    const matches = (matchRes.data ?? []) as unknown as Row[];
    const pits = (pitRes.data ?? []) as unknown as Row[];
    setMatchEntries(matches);
    setPitEntries(pits);
    cloudKeysRef.current = {
      match: new Set(matches.map((r) => entryKey('match', r))),
      pit: new Set(pits.map((r) => entryKey('pit', r))),
    };
    setLoading(false);
  }, [eventCode]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const sendRows = sendKind === 'match' ? matchEntries : pitEntries;

  /** Fold one scanned code into the pending list, rejecting mismatched seasons. */
  const ingest = useCallback((text: string) => {
    const decoded = decodePayload(text, season);
    if (!decoded) return;

    if (decoded.seasonId !== season.id) {
      const from = seasonById(decoded.seasonId);
      toast({
        title: 'Wrong season',
        description: `That code was scouted under ${from.name}, but this event runs ${season.name}. Switch the season on Season Setup, or scan it into the right event.`,
        variant: 'destructive',
      });
      return;
    }

    if (decoded.eventCode && eventCode && decoded.eventCode !== eventCode) {
      toast({
        title: 'Different event',
        description: `That code is from ${decoded.eventCode}; you are importing into ${eventCode}.`,
        variant: 'destructive',
      });
      return;
    }

    setScanned((prev) => {
      const seen = new Set(prev.map((s) => `${s.kind}:${entryKey(s.kind, s.row)}`));
      const fresh = decoded.rows
        .filter((row) => !seen.has(`${decoded.kind}:${entryKey(decoded.kind, row)}`))
        .map((row) => ({
          kind: decoded.kind,
          row,
          duplicate: cloudKeysRef.current[decoded.kind].has(entryKey(decoded.kind, row)),
        }));

      if (fresh.length > 0) {
        const dupes = fresh.filter((f) => f.duplicate).length;
        toast({
          title: 'Scanned!',
          description: `${fresh.length - dupes} new${dupes > 0 ? `, ${dupes} already in cloud` : ''} ${KIND_META[decoded.kind].label.toLowerCase()} ${fresh.length === 1 ? 'entry' : 'entries'}.`,
        });
      }
      return [...prev, ...fresh];
    });
  }, [season, eventCode, toast]);

  // The scanner captures its callback once at render(), so route scans through a
  // ref that always points at the current `ingest`.
  const ingestRef = useRef(ingest);
  useEffect(() => { ingestRef.current = ingest; }, [ingest]);

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;
    setScanning(true);

    try {
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false,
      );
      scanner.render((text: string) => ingestRef.current(text), () => { /* per-frame decode misses are normal */ });
      scannerRef.current = scanner;
    } catch (e) {
      console.error('Scanner init error:', e);
      toast({ title: 'Scanner Error', description: 'Could not start camera.', variant: 'destructive' });
      setScanning(false);
    }
  }, [toast]);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => () => { stopScanner(); }, [stopScanner]);

  const freshRows = useMemo(() => scanned.filter((s) => !s.duplicate), [scanned]);
  const dupCount = scanned.length - freshRows.length;

  const importScanned = async () => {
    if (!currentEvent || !user || freshRows.length === 0) return;
    setImporting(true);

    let imported = 0;
    const failures: string[] = [];

    for (const { kind, row } of freshRows) {
      const payload = kind === 'match'
        ? { ...row, event_code: currentEvent.code, scouter_id: user.id }
        : { ...row, event_code: currentEvent.code, last_edited_by: user.id, last_edited_at: new Date().toISOString() };

      const conflict = kind === 'match'
        ? 'event_code,team_number,match_number,scouter_id'
        : 'event_code,team_number';

      const { error } = await supabase
        .from(KIND_META[kind].table)
        .upsert(payload as never, { onConflict: conflict });

      if (error) failures.push(`${KIND_META[kind].label} ${entryKey(kind, row)}: ${error.message}`);
      else imported++;
    }

    setImporting(false);

    if (failures.length > 0) {
      console.error('QR import failures:', failures);
      toast({
        title: `Imported ${imported}/${freshRows.length}`,
        description: failures[0],
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Import Complete',
        description: `${imported} ${imported === 1 ? 'entry' : 'entries'} imported.${dupCount > 0 ? ` ${dupCount} duplicates skipped.` : ''}`,
      });
    }

    setScanned([]);
    loadEntries();
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (!currentEvent) return <Navigate to="/event-select" replace />;

  return (
    <AppLayout>
      <PageHeader
        title="QR Transfer"
        description={`Send and receive ${season.name} scouting data via QR codes`}
      />

      <div className="flex gap-2 mb-6">
        <Button
          variant={mode === 'send' ? 'default' : 'outline'}
          onClick={() => { setMode('send'); stopScanner(); }}
          className="flex-1 h-12 gap-2"
        >
          <Upload className="w-4 h-4" />
          Send Data
        </Button>
        <Button
          variant={mode === 'receive' ? 'default' : 'outline'}
          onClick={() => setMode('receive')}
          className="flex-1 h-12 gap-2"
        >
          <Download className="w-4 h-4" />
          Receive Data
        </Button>
      </div>

      {mode === 'send' ? (
        <div className="space-y-6 max-w-md mx-auto">
          <div className="flex gap-2">
            {(['match', 'pit'] as const).map((kind) => {
              const { label, icon: Icon } = KIND_META[kind];
              const count = kind === 'match' ? matchEntries.length : pitEntries.length;
              return (
                <Button
                  key={kind}
                  variant={sendKind === kind ? 'secondary' : 'outline'}
                  onClick={() => setSendKind(kind)}
                  className="flex-1 h-11 gap-2 font-mono"
                >
                  <Icon className="w-4 h-4" />
                  {label} ({count})
                </Button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : sendRows.length === 0 ? (
            <div className="data-card text-center py-12 text-muted-foreground">
              No {KIND_META[sendKind].label.toLowerCase()} data to share.
            </div>
          ) : (
            <EntryQRCard
              season={season}
              kind={sendKind}
              eventCode={currentEvent.code}
              rows={sendRows}
              title={`${KIND_META[sendKind].label} Entries`}
              caption={`${sendRows.length} ${sendRows.length === 1 ? 'entry' : 'entries'} from ${currentEvent.code}`}
            />
          )}
        </div>
      ) : (
        <div className="space-y-6 max-w-md mx-auto">
          <PitSection title="Scanner" icon={ScanLine}>
            <div className="flex flex-col items-center gap-4">
              {!scanning ? (
                <Button onClick={startScanner} className="w-full h-14 gap-2">
                  <ScanLine className="w-5 h-5" />
                  Start Camera
                </Button>
              ) : (
                <Button onClick={stopScanner} variant="outline" className="w-full h-14 gap-2">
                  Stop Camera
                </Button>
              )}

              <div id="qr-reader" ref={videoRef} className="w-full rounded-xl overflow-hidden" />

              <p className="text-xs text-muted-foreground text-center">
                Accepts match and pit codes tagged{' '}
                <span className="font-mono text-foreground">{season.id}</span>. Codes from another
                season are rejected with a reason rather than imported.
              </p>

              {scanned.length > 0 && (
                <div className="w-full space-y-3">
                  <div className="flex items-center gap-2 text-sm text-accent">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-mono">{freshRows.length} new entries</span>
                  </div>
                  {dupCount > 0 && (
                    <div className="flex items-center gap-2 text-sm text-warning">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-mono">{dupCount} already in cloud</span>
                      <Badge variant="outline" className="text-warning border-warning/30 text-[10px]">DUP</Badge>
                    </div>
                  )}

                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border/40 divide-y divide-border/20">
                    {scanned.map((s, i) => (
                      <div key={`${s.kind}-${entryKey(s.kind, s.row)}-${i}`} className="flex items-center justify-between px-3 py-1.5 text-xs font-mono">
                        <span className={cn(s.duplicate && 'text-muted-foreground')}>
                          {s.kind === 'match'
                            ? `Team ${s.row.team_number} · Match ${s.row.match_number}`
                            : `Team ${s.row.team_number} · Pit`}
                        </span>
                        {s.duplicate && (
                          <Badge variant="outline" className="text-warning border-warning/30 text-[10px]">DUP</Badge>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={importScanned}
                    disabled={importing || freshRows.length === 0}
                    className="w-full h-14 gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    Import {freshRows.length} New {freshRows.length === 1 ? 'Entry' : 'Entries'}
                    {dupCount > 0 && ` (skip ${dupCount} dup)`}
                  </Button>
                </div>
              )}
            </div>
          </PitSection>
        </div>
      )}
    </AppLayout>
  );
}
