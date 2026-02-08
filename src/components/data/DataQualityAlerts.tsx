import React from 'react';
import { AlertTriangle, Copy, Search, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MatchRow {
  id: string;
  match_number: number;
  team_number: number;
  scouter_id: string;
  scouter_name: string;
}

interface FTCMatch {
  matchNumber: number;
  teams: { teamNumber: number; station: string }[];
}

interface DataQualityAlertsProps {
  entries: MatchRow[];
  ftcMatches?: FTCMatch[];
}

interface QualityIssue {
  type: 'duplicate' | 'missing' | 'info';
  severity: 'warning' | 'error' | 'info';
  message: string;
  detail?: string;
}

export function DataQualityAlerts({ entries, ftcMatches }: DataQualityAlertsProps) {
  const issues = React.useMemo(() => {
    const problems: QualityIssue[] = [];

    // 1. Duplicate detection: same team + match by same scouter
    const entryKeys = new Map<string, MatchRow[]>();
    entries.forEach(e => {
      const key = `${e.match_number}-${e.team_number}-${e.scouter_id}`;
      const existing = entryKeys.get(key) || [];
      existing.push(e);
      entryKeys.set(key, existing);
    });

    entryKeys.forEach((dupes, key) => {
      if (dupes.length > 1) {
        problems.push({
          type: 'duplicate',
          severity: 'error',
          message: `Duplicate: Match ${dupes[0].match_number}, Team ${dupes[0].team_number}`,
          detail: `${dupes.length} entries by ${dupes[0].scouter_name}`,
        });
      }
    });

    // 2. Missing data: matches in FTC schedule with no scouting data
    if (ftcMatches && ftcMatches.length > 0) {
      const scoutedKeys = new Set(
        entries.map(e => `${e.match_number}-${e.team_number}`)
      );

      ftcMatches.forEach(match => {
        match.teams.forEach(team => {
          const key = `${match.matchNumber}-${team.teamNumber}`;
          if (!scoutedKeys.has(key)) {
            problems.push({
              type: 'missing',
              severity: 'warning',
              message: `Missing: Match ${match.matchNumber}, Team ${team.teamNumber}`,
              detail: `No scouting data for ${team.station}`,
            });
          }
        });
      });
    }

    // 3. Over-scouted detection: multiple scouters for same team+match (info, not error)
    const teamMatchKeys = new Map<string, string[]>();
    entries.forEach(e => {
      const key = `${e.match_number}-${e.team_number}`;
      const scouters = teamMatchKeys.get(key) || [];
      if (!scouters.includes(e.scouter_name)) {
        scouters.push(e.scouter_name);
      }
      teamMatchKeys.set(key, scouters);
    });

    teamMatchKeys.forEach((scouters, key) => {
      if (scouters.length > 1) {
        const [match, team] = key.split('-');
        problems.push({
          type: 'info' as const,
          severity: 'info',
          message: `Over-scouted: Match ${match}, Team ${team}`,
          detail: `Scouted by: ${scouters.join(', ')}`,
        });
      }
    });

    return problems;
  }, [entries, ftcMatches]);

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span className="font-mono">All data looks clean — no issues detected</span>
      </div>
    );
  }

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
        <Search className="w-4 h-4" />
        <span>Data Quality: {errors.length} errors, {warnings.length} missing, {infos.length} over-scouted</span>
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-card p-3">
        {issues.map((issue, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-start gap-2 px-3 py-2 rounded-lg text-xs",
              issue.severity === 'error' && "bg-destructive/10 text-destructive",
              issue.severity === 'warning' && "bg-warning/10 text-warning",
              issue.severity === 'info' && "bg-primary/10 text-primary",
            )}
          >
            {issue.severity === 'error' && <Copy className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
            {issue.severity === 'warning' && <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
            {issue.severity === 'info' && <Search className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
            <div>
              <div className="font-mono font-medium">{issue.message}</div>
              {issue.detail && (
                <div className="text-muted-foreground mt-0.5">{issue.detail}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
