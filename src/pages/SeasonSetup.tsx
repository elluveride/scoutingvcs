import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { useSeason } from '@/hooks/useSeason';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PitSection } from '@/components/match-scout/PitSection';
import { SwitchSeasonButton } from '@/components/season/SwitchSeasonButton';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { SEASON_LIST, seasonById } from '@/seasons';
import type { SeasonConfig } from '@/seasons/types';
import { matchFields, pitFields } from '@/seasons/fields';
import { cn } from '@/lib/utils';
import {
  CalendarRange, CheckCircle2, Bot, Gamepad2, Flag, AlertTriangle,
  Wrench, ListChecks, QrCode, Lock,
} from 'lucide-react';

const PHASE_META = {
  auto: { label: 'Autonomous', icon: Bot },
  teleop: { label: 'TeleOp', icon: Gamepad2 },
  endgame: { label: 'Endgame', icon: Flag },
} as const;

/**
 * Every scored field of a season, grouped by phase, with its point value and
 * an on/off switch. Switched-off fields stop appearing in the scout form,
 * spreadsheet, QR payloads, and ranking for this event.
 */
function ScoringTable({
  season,
  disabled,
  onToggle,
  canEdit,
  savingKey,
}: {
  season: SeasonConfig;
  disabled: string[];
  onToggle: (key: string, enabled: boolean) => void;
  canEdit: boolean;
  savingKey: string | null;
}) {
  const off = new Set(disabled);
  const phases = (['auto', 'teleop', 'endgame'] as const).map((phase) => {
    const counters = season.counters.filter(
      (c) => c.phase === phase && (c.role ?? 'score') === 'score' && c.pointsEach,
    );
    const toggles = season.toggles.filter(
      (t) => t.phase === phase && (t.role ?? 'score') === 'score' && t.pointsEach,
    );
    return { phase, counters, toggles };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {phases.map(({ phase, counters, toggles }) => {
        const { label, icon: Icon } = PHASE_META[phase];
        const rows = [
          ...counters.map((c) => ({ key: c.key, label: c.label, points: `${c.pointsEach} × count` })),
          ...toggles.map((t) => ({ key: t.key, label: t.label, points: `${t.pointsEach} if yes` })),
        ];
        return (
          <div key={phase} className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-primary" />
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
            </div>
            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono">No scored fields.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => {
                  const isOff = off.has(r.key);
                  return (
                    <div
                      key={r.key}
                      className={cn(
                        'flex items-center justify-between gap-2 text-xs font-mono transition-opacity',
                        isOff && 'opacity-50',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Switch
                          checked={!isOff}
                          disabled={!canEdit || savingKey === r.key}
                          onCheckedChange={(v) => onToggle(r.key, v)}
                          aria-label={`${isOff ? 'Enable' : 'Disable'} ${r.label}`}
                          className="shrink-0"
                        />
                        <span className={cn('truncate', isOff && 'line-through')}>{r.label}</span>
                      </div>
                      <span className="shrink-0 font-semibold">{r.points}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SeasonCard({ season, active }: { season: SeasonConfig; active: boolean }) {
  const matchCols = matchFields(season).length;
  const pitCols = pitFields(season).length;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        active ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-muted/10',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg">{season.name}</h3>
            {active && (
              <Badge className="gap-1 bg-primary/15 text-primary border-primary/40" variant="outline">
                <CheckCircle2 className="w-3 h-3" />
                Active
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            season {season.seasonYear}–{String(season.seasonYear + 1).slice(2)} · id <code>{season.id}</code>
          </p>
        </div>
        {!active && <SwitchSeasonButton targetSeasonId={season.id} label={`Use ${season.name}`} />}
      </div>

      {season.summary && <p className="text-sm text-muted-foreground mb-3">{season.summary}</p>}

      <div className="flex flex-wrap gap-2 text-[11px] font-mono text-muted-foreground">
        <span className="px-2 py-1 rounded border border-border bg-muted/40">
          {matchCols} match columns
        </span>
        <span className="px-2 py-1 rounded border border-border bg-muted/40">
          {pitCols} pit columns
        </span>
        <span className="px-2 py-1 rounded border border-border bg-muted/40">
          minor foul {season.points.MINOR_FOUL} · major {season.points.MAJOR_FOUL}
        </span>
      </div>
    </div>
  );
}

export default function SeasonSetup() {
  const { user, isAdmin } = useAuth();
  const { currentEvent } = useEvent();
  const season = useSeason();

  if (!user) return <Navigate to="/auth" replace />;
  if (!currentEvent) return <Navigate to="/event-select" replace />;

  const scoutFields = matchFields(season);
  const capabilities = season.pit.capabilities;

  return (
    <AppLayout>
      <PageHeader
        title="Season Setup"
        description="Which FTC game this event is scouted under, and exactly what that changes"
      />

      <div className="space-y-6 max-w-4xl">
        {/* Current season */}
        <PitSection title="Active Season" icon={CalendarRange}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0">
              <p className="font-display text-2xl text-glow">{season.name}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {currentEvent.name} · {currentEvent.code}
              </p>
            </div>
            {isAdmin && (
              <div className="ml-auto">
                <SwitchSeasonButton />
              </div>
            )}
          </div>

          {!isAdmin && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
              <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs font-mono text-muted-foreground">
                Read-only — only an admin can change the season. Everyone scouting this event
                uses whichever game is active here.
              </p>
            </div>
          )}
        </PitSection>

        {/* Point values */}
        <PitSection title="Scoring" icon={ListChecks} collapsible>
          <p className="text-sm text-muted-foreground mb-3">
            These are the values the Dashboard ranking and the Match Planner prediction run on.
            They come from the season config, so both screens always agree.
          </p>
          <ScoringTable season={season} />

          <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs font-mono">
              <span className="text-warning font-semibold">Fouls: </span>
              <span className="text-muted-foreground">
                minor {season.points.MINOR_FOUL} pts and major {season.points.MAJOR_FOUL} pts, both
                awarded to the <em>opposing</em> alliance — the Planner adds them to the other side's
                score rather than subtracting from yours.
              </span>
            </p>
          </div>
        </PitSection>

        {/* What the scout sees */}
        <PitSection title="Match Scout Fields" icon={ListChecks} collapsible>
          <div className="flex flex-wrap gap-1.5">
            {scoutFields.map((f) => (
              <span
                key={f.key}
                className="px-2 py-1 rounded border border-border bg-muted/30 text-[11px] font-mono text-muted-foreground"
                title={`${f.key} · ${f.type}`}
              >
                {f.label}
              </span>
            ))}
          </div>
        </PitSection>

        <PitSection title="Pit Scout Capabilities" icon={Wrench} collapsible>
          <div className="flex flex-wrap gap-1.5">
            {capabilities.map((c) => (
              <span
                key={c.key}
                className="px-2 py-1 rounded border border-border bg-muted/30 text-[11px] font-mono text-muted-foreground"
                title={c.key}
              >
                {c.label}
              </span>
            ))}
          </div>
        </PitSection>

        {/* QR compatibility */}
        <PitSection title="QR Transfer" icon={QrCode} collapsible>
          <p className="text-sm text-muted-foreground">
            QR codes carry the season id, so a code scouted under a different game is rejected with
            a reason instead of importing the wrong columns. Every device scanning into this event
            must be on <code className="font-mono text-foreground">{season.id}</code>.
          </p>
        </PitSection>

        {/* All registered seasons */}
        <div className="space-y-3">
          <h2 className="font-display text-lg">Available Seasons</h2>
          {SEASON_LIST.map((s) => (
            <SeasonCard key={s.id} season={s} active={s.id === season.id} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
