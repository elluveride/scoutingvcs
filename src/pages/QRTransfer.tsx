import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { PitSection } from '@/components/match-scout/PitSection';
import { Loader2, QrCode, ScanLine, Download, Upload, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { QRPayloadSchema } from '@/lib/importValidation';

interface CompactEntry {
  t: number; // team_number
  m: number; // match_number
  ac: number; // auto_scored_close
  af: number; // auto_scored_far
  tc: number; // teleop_scored_close
  tf: number; // teleop_scored_far
  ll: boolean; // on_launch_line
  dr: number; // defense_rating
  er: string; // endgame_return
  ps: string; // penalty_status
  f: number; // fouls
}

// Compress entry data for QR codes
function compressEntries(entries: any[]): CompactEntry[] {
  return entries.map(e => ({
    t: e.team_number,
    m: e.match_number,
    ac: e.auto_scored_close,
    af: e.auto_scored_far,
    tc: e.teleop_scored_close,
    tf: e.teleop_scored_far,
    ll: e.on_launch_line,
    dr: e.defense_rating,
    er: e.endgame_return,
    ps: e.penalty_status,
    f: e.auto_fouls_minor,
  }));
}

// Chunk data to fit in QR codes (max ~2KB per QR)
function chunkData(entries: CompactEntry[], maxBytes: number = 1800): string[] {
  const chunks: string[] = [];
  let currentChunk: CompactEntry[] = [];

  for (const entry of entries) {
    currentChunk.push(entry);
    const json = JSON.stringify({ d: currentChunk });
    if (json.length > maxBytes) {
      currentChunk.pop();
      if (currentChunk.length > 0) {
        chunks.push(JSON.stringify({ d: currentChunk }));
      }
      currentChunk = [entry];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(JSON.stringify({ d: currentChunk }));
  }

  return chunks;
}

export default function QRTransfer() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const { toast } = useToast();

  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrChunks, setQrChunks] = useState<string[]>([]);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scannedEntries, setScannedEntries] = useState<CompactEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentEvent) return;
    loadEntries();
  }, [currentEvent]);

  const loadEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('match_entries')
      .select('*')
      .eq('event_code', currentEvent!.code)
      .order('match_number');
    setEntries(data || []);

    if (data && data.length > 0) {
      const compressed = compressEntries(data);
      setQrChunks(chunkData(compressed));
    }
    setLoading(false);
  };

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;
    setScanning(true);

    try {
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(
        (decodedText: string) => {
          try {
            const parsed = JSON.parse(decodedText);
            const result = QRPayloadSchema.safeParse(parsed);
            if (result.success) {
              const validEntries = result.data.d as CompactEntry[];
              setScannedEntries(prev => {
                const existing = new Set(prev.map(e => `${e.t}-${e.m}`));
                const newEntries = validEntries.filter((e) => !existing.has(`${e.t}-${e.m}`));
                if (newEntries.length > 0) {
                  toast({ title: 'Scanned!', description: `${newEntries.length} new entries found.` });
                }
                return [...prev, ...newEntries];
              });
            }
          } catch {
            console.warn('QR scan: invalid data format');
          }
        },
        () => {} // error callback
      );

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

  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  const importScannedData = async () => {
    if (!currentEvent || !user || scannedEntries.length === 0) return;
    setImporting(true);

    let successCount = 0;
    for (const entry of scannedEntries) {
      const { error } = await supabase.from('match_entries').upsert([{
        event_code: currentEvent.code,
        team_number: entry.t,
        match_number: entry.m,
        auto_scored_close: entry.ac,
        auto_scored_far: entry.af,
        teleop_scored_close: entry.tc,
        teleop_scored_far: entry.tf,
        on_launch_line: entry.ll,
        defense_rating: entry.dr,
        endgame_return: entry.er as any,
        penalty_status: entry.ps as any,
        auto_fouls_minor: entry.f,
        auto_fouls_major: 0,
        scouter_id: user.id,
      }], { onConflict: 'event_code,team_number,match_number,scouter_id' });

      if (!error) successCount++;
    }

    setImporting(false);
    toast({ title: 'Import Complete', description: `${successCount}/${scannedEntries.length} entries imported.` });
    setScannedEntries([]);
    loadEntries();
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (!currentEvent) return <Navigate to="/event-select" replace />;

  return (
    <AppLayout>
      <PageHeader title="QR Transfer" description="Send and receive scouting data via QR codes" />

      {/* Mode Toggle */}
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : entries.length === 0 ? (
            <div className="data-card text-center py-12 text-muted-foreground">
              No scouting data to share.
            </div>
          ) : (
            <PitSection title="QR Code" icon={QrCode}>
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-muted-foreground font-mono text-center">
                  Showing {entries.length} entries ({qrChunks.length} QR code{qrChunks.length > 1 ? 's' : ''})
                </p>

                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG
                    value={qrChunks[currentChunk] || '{}'}
                    size={256}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                {qrChunks.length > 1 && (
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentChunk(c => Math.max(0, c - 1))}
                      disabled={currentChunk === 0}
                    >
                      Previous
                    </Button>
                    <span className="text-sm font-mono">
                      {currentChunk + 1} / {qrChunks.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentChunk(c => Math.min(qrChunks.length - 1, c + 1))}
                      disabled={currentChunk === qrChunks.length - 1}
                    >
                      Next
                    </Button>
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  The receiving device scans each QR code to import data.
                  {qrChunks.length > 1 && ' Cycle through all codes.'}
                </p>
              </div>
            </PitSection>
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

              {scannedEntries.length > 0 && (
                <div className="w-full space-y-3">
                  <div className="flex items-center gap-2 text-sm text-accent">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-mono">{scannedEntries.length} entries scanned</span>
                  </div>
                  <Button
                    onClick={importScannedData}
                    disabled={importing}
                    className="w-full h-14 gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    Import {scannedEntries.length} Entries
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
