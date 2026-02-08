import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileJson } from 'lucide-react';

interface MatchRow {
  id: string;
  event_code: string;
  match_number: number;
  team_number: number;
  scouter_name: string;
  auto_scored_close: number;
  auto_scored_far: number;
  auto_fouls_minor: number;
  auto_fouls_major: number;
  on_launch_line: boolean;
  teleop_scored_close: number;
  teleop_scored_far: number;
  defense_rating: number;
  endgame_return: string;
  penalty_status: string;
  created_at: string;
}

interface DataExportButtonsProps {
  entries: MatchRow[];
  eventCode: string;
}

export function DataExportButtons({ entries, eventCode }: DataExportButtonsProps) {
  const exportCSV = () => {
    const headers = [
      'Event Code', 'Match #', 'Team #', 'Scouter',
      'Auto Close', 'Auto Far', 'Minor Fouls', 'Major Fouls', 'Launch Line',
      'TeleOp Close', 'TeleOp Far', 'Defense', 'Endgame', 'Penalty', 'Timestamp',
    ];

    const rows = entries.map(e => [
      e.event_code, e.match_number, e.team_number, `"${e.scouter_name}"`,
      e.auto_scored_close, e.auto_scored_far, e.auto_fouls_minor, e.auto_fouls_major,
      e.on_launch_line ? 'ON' : 'OFF',
      e.teleop_scored_close, e.teleop_scored_far, e.defense_rating,
      e.endgame_return, e.penalty_status, new Date(e.created_at).toLocaleString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadBlob(csv, `${eventCode}_scouting_data.csv`, 'text/csv');
  };

  const exportJSON = () => {
    const data = entries.map(e => ({
      event_code: e.event_code,
      match_number: e.match_number,
      team_number: e.team_number,
      scouter: e.scouter_name,
      auto: {
        scored_close: e.auto_scored_close,
        scored_far: e.auto_scored_far,
        fouls_minor: e.auto_fouls_minor,
        fouls_major: e.auto_fouls_major,
        on_launch_line: e.on_launch_line,
      },
      teleop: {
        scored_close: e.teleop_scored_close,
        scored_far: e.teleop_scored_far,
        defense_rating: e.defense_rating,
      },
      endgame: {
        return_status: e.endgame_return,
        penalty_status: e.penalty_status,
      },
      timestamp: e.created_at,
    }));

    downloadBlob(JSON.stringify(data, null, 2), `${eventCode}_scouting_data.json`, 'application/json');
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
