import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { PitSection } from '@/components/match-scout/PitSection';
import { chunkPayload, type EntryKind } from '@/lib/qrPayload';
import type { SeasonConfig } from '@/seasons/types';
import { QrCode, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface EntryQRCardProps {
  season: SeasonConfig;
  kind: EntryKind;
  eventCode: string;
  /** DB-shaped rows (keys are column names). */
  rows: Record<string, unknown>[];
  title?: string;
  /** Shown under the code — e.g. "Team 12841 · Match 14". */
  caption?: string;
  onDismiss?: () => void;
}

/**
 * Renders entries as scannable QR codes.
 *
 * This is the half of the offline path that a scout's phone owns: they save the
 * entry (queued locally if there is no signal), then hold up this code for the
 * lead's device to read on `/qr-transfer`.
 */
export function EntryQRCard({
  season, kind, eventCode, rows, title = 'Submit by QR', caption, onDismiss,
}: EntryQRCardProps) {
  const chunks = useMemo(
    () => chunkPayload(season, kind, eventCode, rows),
    [season, kind, eventCode, rows],
  );
  const [index, setIndex] = useState(0);

  if (chunks.length === 0) return null;
  const current = Math.min(index, chunks.length - 1);

  return (
    <PitSection title={title} icon={QrCode}>
      <div className="flex flex-col items-center gap-3">
        {caption && <p className="text-sm font-mono text-muted-foreground text-center">{caption}</p>}

        {/* QR codes need a light quiet zone; the app is dark, so force white here. */}
        <div className="bg-white p-4 rounded-xl">
          <QRCodeSVG value={chunks[current]} size={232} level="M" includeMargin={false} />
        </div>

        {chunks.length > 1 && (
          <div className="flex items-center gap-3">
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={current === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-mono">{current + 1} / {chunks.length}</span>
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setIndex((i) => Math.min(chunks.length - 1, i + 1))}
              disabled={current === chunks.length - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center max-w-[36ch]">
          Scan from the lead device on <span className="font-mono text-foreground">QR Transfer → Receive</span>.
          Tagged <span className="font-mono text-foreground">{season.id}</span>
          {chunks.length > 1 && ' — show every code, order does not matter'}.
        </p>

        {onDismiss && (
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss} className="gap-2">
            <X className="w-4 h-4" />
            Done
          </Button>
        )}
      </div>
    </PitSection>
  );
}
