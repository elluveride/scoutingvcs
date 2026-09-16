import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileJson } from 'lucide-react';
import { useSeason } from '@/hooks/useSeason';
import { matchFields } from '@/seasons/fields';
import { scoreEntry } from '@/lib/seasonScoring';
import { IMPORT_FORMAT_VERSION } from '@/lib/importValidation';

/**
 * One scouted row. Only the columns every season shares are named; the scoring
 * columns are whatever the active game declares, read through `matchFields`.
 */
interface MatchRow {
  id: string;
  event_code: string;
  match_number: number;
  team_number: number;
  scouter_name: string;
  created_at: string;
  [column: string]: unknown;
}

interface DataExportButtonsProps {
  entries: MatchRow[];
  eventCode: string;
}

/** CSV cells: quote anything that could contain a comma, and flatten booleans. */
function csvCell(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value == null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function DataExportButtons({ entries, eventCode }: DataExportButtonsProps) {
  const season = useSeason();

  // Exported columns follow the season, so a file always carries exactly what
  // the scout app collected — and re-imports cleanly on the other side.
  const fields = matchFields(season);

  const exportCSV = () => {
    const meta = ['event_code', 'match_number', 'team_number', 'scouter', 'total_points'];
    const scoreKeys = fields.map((f) => f.key).filter((k) => k !== 'team_number' && k !== 'match_number');
    const headers = [...meta, ...scoreKeys, 'timestamp'];

    const rows = entries.map((e) => [
      csvCell(e.event_code),
      csvCell(e.match_number),
      csvCell(e.team_number),
      csvCell(e.scouter_name),
      csvCell(scoreEntry(season, e).total),
      ...scoreKeys.map((k) => csvCell(e[k])),
      csvCell(new Date(e.created_at).toLocaleString()),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    downloadBlob(csv, `${eventCode}_${season.id}_scouting_data.csv`, 'text/csv');
  };

  const exportJSON = () => {
    const payload = {
      format_version: IMPORT_FORMAT_VERSION,
      season_id: season.id,
      event_code: eventCode,
      exported_at: new Date().toISOString(),
      entries: entries.map((e) => {
        const score = scoreEntry(season, e);
        return {
          // Column names match the DB, so this file re-imports without mapping.
          ...Object.fromEntries(fields.map((f) => [f.key, e[f.key]])),
          scouter: e.scouter_name,
          points: {
            auto: score.auto,
            teleop: score.teleop,
            endgame: score.endgame,
            total: score.total,
            fouls_given_to_opponent: score.foulsGiven,
          },
          timestamp: e.created_at,
        };
      }),
    };

    downloadBlob(
      JSON.stringify(payload, null, 2),
      `${eventCode}_${season.id}_scouting_data.json`,
      'application/json',
    );
  };

  return (
    <>
      <Button variant="secondary" onClick={exportCSV}>
        <Download className="w-4 h-4 mr-2" />
        CSV
      </Button>
      <Button variant="secondary" onClick={exportJSON}>
        <FileJson className="w-4 h-4 mr-2" />
        JSON
      </Button>
    </>
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
