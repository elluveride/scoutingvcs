import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MissingReason =
  | 'no_match_data'
  | 'low_sample'
  | 'no_pit_data'
  | 'no_opr';

const REASON_LABELS: Record<MissingReason, string> = {
  no_match_data: 'no match scouting',
  low_sample: 'low sample (<3 matches)',
  no_pit_data: 'no pit scouting',
  no_opr: 'no official OPR',
};

export interface TeamMissingInputs {
  teamNumber: number;
  reasons: MissingReason[];
  /** Optional extra notes shown after reason list */
  detail?: string;
}

interface Props {
  /** Title shown next to the warning icon */
  title?: string;
  /** Optional one-line explanation under the title */
  description?: string;
  /** Per-team breakdown of what's missing */
  teams: TeamMissingInputs[];
  /** Visual variant: 'warn' for partial data, 'error' for unavailable predictions */
  variant?: 'warn' | 'error' | 'info';
  className?: string;
}

/**
 * Shared missing-data banner used across PitDisplay, MatchPlanner, Dashboard,
 * and any prediction surface. Tells the user *exactly* what scouting inputs
 * are missing per team so they know how to fix it.
 */
export function MissingDataBanner({
  title,
  description,
  teams,
  variant = 'warn',
  className,
}: Props) {
  if (teams.length === 0) return null;

  const tone =
    variant === 'error'
      ? { border: 'border-destructive/40', bg: 'bg-destructive/10', text: 'text-destructive', icon: 'text-destructive' }
      : variant === 'info'
      ? { border: 'border-primary/30', bg: 'bg-primary/10', text: 'text-primary', icon: 'text-primary' }
      : { border: 'border-warning/40', bg: 'bg-warning/10', text: 'text-warning', icon: 'text-warning' };

  const defaultTitle =
    variant === 'error'
      ? 'Prediction unavailable'
      : variant === 'info'
      ? 'Incomplete data'
      : 'Some inputs are missing';

  const Icon = variant === 'info' ? Info : AlertTriangle;

  return (
    <div className={cn('rounded-md border px-3 py-2.5', tone.border, tone.bg, className)}>
      <div className="flex items-start gap-2.5">
        <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', tone.icon)} />
        <div className="min-w-0 flex-1">
          <div className={cn('text-xs font-mono font-semibold', tone.text)}>
            {title ?? defaultTitle}
          </div>
          {description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
          <ul className="mt-1.5 space-y-0.5">
            {teams.map((t) => (
              <li key={t.teamNumber} className="text-[11px] font-mono leading-relaxed">
                <span className={cn('font-semibold', tone.text)}>{t.teamNumber}</span>
                <span className="text-muted-foreground">
                  {' — '}
                  {t.reasons.map((r) => REASON_LABELS[r]).join(', ')}
                  {t.detail ? ` · ${t.detail}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
