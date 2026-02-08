import React from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import { MessageSquare } from 'lucide-react';

interface MatchLogEntry {
  match_number: number;
  auto_scored_close: number;
  auto_scored_far: number;
  teleop_scored_close: number;
  teleop_scored_far: number;
  auto_fouls_minor: number;
  on_launch_line: boolean;
  defense_rating: number;
  endgame_return: string;
  penalty_status: string;
  notes?: string;
}

interface MatchLogTableProps {
  entries: MatchLogEntry[];
}

export function MatchLogTable({ entries }: MatchLogTableProps) {
  if (entries.length === 0) return null;

  return (
    <div className="data-card overflow-hidden">
      <h3 className="font-display text-lg mb-4">Match Log</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Match</TableHead>
              <TableHead className="font-semibold text-center">Auto C</TableHead>
              <TableHead className="font-semibold text-center">Auto F</TableHead>
              <TableHead className="font-semibold text-center">Tel C</TableHead>
              <TableHead className="font-semibold text-center">Tel F</TableHead>
              <TableHead className="font-semibold text-center">Fouls</TableHead>
              <TableHead className="font-semibold text-center">Line</TableHead>
              <TableHead className="font-semibold text-center">Def</TableHead>
              <TableHead className="font-semibold text-center">End</TableHead>
              <TableHead className="font-semibold text-center">Pen</TableHead>
              <TableHead className="font-semibold text-center">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.match_number}>
                <TableCell className="font-mono font-semibold">M{entry.match_number}</TableCell>
                <TableCell className="text-center">{entry.auto_scored_close}</TableCell>
                <TableCell className="text-center">{entry.auto_scored_far}</TableCell>
                <TableCell className="text-center">{entry.teleop_scored_close}</TableCell>
                <TableCell className="text-center">{entry.teleop_scored_far}</TableCell>
                <TableCell className="text-center text-warning">{entry.auto_fouls_minor}</TableCell>
                <TableCell className="text-center">
                  <span className={entry.on_launch_line ? 'text-primary font-semibold' : 'text-muted-foreground'}>
                    {entry.on_launch_line ? 'ON' : 'OFF'}
                  </span>
                </TableCell>
                <TableCell className="text-center font-mono">{entry.defense_rating}</TableCell>
                <TableCell className="text-center capitalize text-xs">
                  {entry.endgame_return.replace('_', ' ')}
                </TableCell>
                <TableCell className="text-center capitalize text-xs">
                  {entry.penalty_status === 'none' ? '—' : entry.penalty_status.replace('_', ' ')}
                </TableCell>
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
