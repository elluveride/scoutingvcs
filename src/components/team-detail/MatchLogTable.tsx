import React, { useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import { MessageSquare } from 'lucide-react';
import { useSeason } from '@/hooks/useSeason';
import { tableColumns } from '@/seasons/fields';
import { scoreEntry } from '@/lib/seasonScoring';

/**
 * One logged match. Only the columns every season shares are named; the scoring
 * columns come from the active game's config.
 */
interface MatchLogEntry {
  match_number: number;
  auto_fouls_minor: number;
  auto_fouls_major?: number;
  defense_rating: number;
  penalty_status: string;
  notes?: string;
  [column: string]: unknown;
}

interface MatchLogTableProps {
  entries: MatchLogEntry[];
}

export function MatchLogTable({ entries }: MatchLogTableProps) {
  const season = useSeason();
  const columns = useMemo(() => tableColumns(season), [season]);

  if (entries.length === 0) return null;

  return (
    <div className="data-card overflow-hidden">
      <h3 className="font-display text-lg mb-4">Match Log</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Match</TableHead>
              {columns.map((col) => (
                <TableHead key={col.key} className="font-semibold text-center" title={col.label}>
                  {col.uniqueShort}
                </TableHead>
              ))}
              <TableHead className="font-semibold text-center" title="Minor / major fouls">Fouls</TableHead>
              <TableHead className="font-semibold text-center">Def</TableHead>
              <TableHead className="font-semibold text-center" title={`Total points (${season.name})`}>Pts</TableHead>
              <TableHead className="font-semibold text-center">Pen</TableHead>
              <TableHead className="font-semibold text-center">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.match_number}>
                <TableCell className="font-mono font-semibold">M{entry.match_number}</TableCell>

                {columns.map((col) => {
                  const value = entry[col.key];
                  return (
                    <TableCell key={col.key} className="text-center">
                      {col.type === 'bool' ? (
                        <span className={value ? 'text-primary font-semibold' : 'text-muted-foreground'}>
                          {value ? 'YES' : '—'}
                        </span>
                      ) : col.type === 'enum' ? (
                        <span className="capitalize text-xs">
                          {String(value ?? '').replace(/_/g, ' ') || '—'}
                        </span>
                      ) : (
                        Number(value ?? 0)
                      )}
                    </TableCell>
                  );
                })}

                <TableCell className="text-center">
                  <span className="text-warning">{entry.auto_fouls_minor}</span>
                  /
                  <span className="text-destructive">{entry.auto_fouls_major ?? 0}</span>
                </TableCell>
                <TableCell className="text-center font-mono">{entry.defense_rating}</TableCell>
                <TableCell className="text-center font-mono font-semibold">
                  {scoreEntry(season, entry).total}
                </TableCell>
                <TableCell className="text-center capitalize text-xs">
                  {entry.penalty_status === 'none' ? '—' : entry.penalty_status.replace(/_/g, ' ')}
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
