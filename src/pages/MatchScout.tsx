import React, { useState, useEffect, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';

import { AppLayout } from '@/components/layout/AppLayout';
import { IntegerStepper } from '@/components/ui/integer-stepper';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFTCMatches } from '@/hooks/useFTCMatches';
import { useFTCRankings } from '@/hooks/useFTCRankings';
import { useOnlineStatus } from '@/hooks/useOfflineSync';
import { useSeason } from '@/hooks/useSeason';
import { queueMatchEntry } from '@/lib/offlineDb';
import { scoreEntry } from '@/lib/seasonScoring';
import { validateMatchScoutForm } from '@/lib/matchScoutValidation';
import {
  matchFields, countersForPhase, togglesForPhase, enumsForPhase, foulCounters, emptyRecord,
} from '@/seasons/fields';

import { MatchInfoSection } from '@/components/match-scout/MatchInfoSection';
import { PitSection } from '@/components/match-scout/PitSection';
import { OptionSelector } from '@/components/match-scout/OptionSelector';
import { EntryQRCard } from '@/components/scout/EntryQRCard';
import {
  Loader2, Save, RotateCcw, Bot, Gamepad2, Flag, AlertTriangle, Pencil, Crosshair,
  WifiOff, QrCode, Calculator,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

type FieldValue = number | boolean | string;
type ScoutForm = Record<string, FieldValue>;

const PHASES = [
  { id: 'auto', title: 'Autonomous', icon: Bot, variant: 'blue' as const },
  { id: 'teleop', title: 'TeleOp', icon: Gamepad2, variant: 'red' as const },
  { id: 'endgame', title: 'Endgame', icon: Flag, variant: undefined },
] as const;

export default function MatchScout() {
  const { user, profile, isApproved } = useAuth();
  const { currentEvent } = useEvent();
  const season = useSeason();

  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { matches, loading: matchesLoading, refetch: refetchMatches } = useFTCMatches();
  const { getTeamName } = useFTCRankings();
  const isOnline = useOnlineStatus();

  const isAdmin = profile?.role === 'admin';
  const editId = searchParams.get('edit');

  // Every scored field of the active season, and the blank entry it implies.
  // Rebuilt when the event's season changes, so a switch reshapes the form
  // without a reload.
  const fields = useMemo(() => matchFields(season), [season]);
  const blankForm = useMemo(
    () => emptyRecord(fields.filter((f) => f.key !== 'team_number' && f.key !== 'match_number')),
    [fields],
  );

  const [matchType, setMatchType] = useState<'Q' | 'P'>('Q');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [teamNumber, setTeamNumber] = useState('');
  const [matchNumber, setMatchNumber] = useState('');
  const [editingEntry, setEditingEntry] = useState<{ id: string; scouterId: string } | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [form, setForm] = useState<ScoutForm>(blankForm);
  const [saving, setSaving] = useState(false);
  /** The row just saved, held so the scout can hand it over by QR. */
  const [savedRow, setSavedRow] = useState<Record<string, unknown> | null>(null);

  useEffect(() => { setForm(blankForm); }, [blankForm]);

  const set = (key: string, value: FieldValue) => setForm((f) => ({ ...f, [key]: value }));
  const numberAt = (key: string) => (typeof form[key] === 'number' ? (form[key] as number) : 0);
  const boolAt = (key: string) => form[key] === true;
  const stringAt = (key: string) => (typeof form[key] === 'string' ? (form[key] as string) : '');

  const handleMatchTypeChange = (type: 'Q' | 'P') => {
    setMatchType(type);
    setSelectedPosition('');
    refetchMatches(type);
  };

  const handlePositionSelect = (position: string, team: number) => {
    setSelectedPosition(position);
    setTeamNumber(team.toString());
  };

  useEffect(() => {
    if (editId && isAdmin && currentEvent) {
      loadEntryForEdit(editId);
    }
  }, [editId, isAdmin, currentEvent]);

  const loadEntryForEdit = async (id: string) => {
    setLoadingEdit(true);
    const { data, error } = await supabase
      .from('match_entries')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data && !error) {
      const row = data as Record<string, unknown>;
      setTeamNumber(String(row.team_number ?? ''));
      setMatchNumber(String(row.match_number ?? ''));
      setForm(
        Object.fromEntries(
          Object.entries(blankForm).map(([key, fallback]) => [
            key,
            (row[key] ?? fallback) as FieldValue,
          ]),
        ),
      );
      setEditingEntry({ id: data.id, scouterId: data.scouter_id });
    } else {
      toast({ title: 'Error', description: 'Could not load entry for editing.', variant: 'destructive' });
      setSearchParams({});
    }
    setLoadingEdit(false);
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (!currentEvent) return <Navigate to="/event-select" replace />;

  const resetForm = () => {
    setMatchType('Q');
    setSelectedPosition('');
    setTeamNumber('');
    setMatchNumber('');
    setForm(blankForm);
    setEditingEntry(null);
    setSavedRow(null);
    setSearchParams({});
  };

  /** Live point total for what is on screen — the scout's own sanity check. */
  const liveScore = scoreEntry(season, form);

  const validation = validateMatchScoutForm({ matchNumber, teamNumber });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isApproved) {
      toast({
        title: 'Account Pending',
        description: 'Your account must be approved to submit scouting data.',
        variant: 'destructive',
      });
      return;
    }

    if (!validation.valid) {
      toast({
        title: 'Missing Information',
        description: `Needs ${validation.missing.join(', ').toLowerCase()}.`,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const entryData = {
      ...form,
      notes: stringAt('notes').trim(),
      event_code: currentEvent.code,
      team_number: parseInt(teamNumber, 10),
      match_number: parseInt(matchNumber, 10),
    };

    let error: unknown;

    if (editingEntry && isAdmin) {
      const { error: updateError } = await supabase
        .from('match_entries')
        .update(entryData as never)
        .eq('id', editingEntry.id);
      error = updateError;
    } else if (!isOnline) {
      try {
        await queueMatchEntry({
          ...entryData,
          notes: String(entryData.notes ?? ''),
          scouter_id: user.id,
        });
        setSaving(false);
        setSavedRow(entryData);
        toast({
          title: 'Saved Offline',
          description: `Match ${matchNumber} queued — sync on reconnect, or hand it over by QR.`,
        });
        return;
      } catch (e) {
        error = e;
      }
    } else {
      const { error: upsertError } = await supabase.from('match_entries').upsert(
        { ...entryData, scouter_id: user.id } as never,
        { onConflict: 'event_code,team_number,match_number,scouter_id' },
      );
      error = upsertError;
    }

    setSaving(false);

    if (error) {
      toast({
        title: 'Error',
        description:
          (error instanceof Error ? error.message : (error as { message?: string })?.message) ||
          'Failed to save match data.',
        variant: 'destructive',
      });
      return;
    }

    setSavedRow(entryData);
    toast({
      title: editingEntry ? 'Updated!' : 'Saved!',
      description: `Match ${matchNumber} for Team ${teamNumber} ${editingEntry ? 'updated' : 'saved'} — ${liveScore.total} pts.`,
    });
  };

  if (loadingEdit) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const fouls = foulCounters(season);

  return (
    <AppLayout>
      {/* `alliance-swap` flips every red/blue element on this page to follow the
          selected alliance theme (see index.css). */}
      <div className="alliance-swap">
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl tracking-wide text-glow">
            {editingEntry ? 'Edit Entry' : 'Match Scout'}
          </h1>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-primary/40 bg-primary/10 text-primary">
            {season.name}
          </span>
        </div>
        <p className="text-sm text-muted-foreground font-mono mt-1">{currentEvent.name}</p>
        {teamNumber && getTeamName(parseInt(teamNumber, 10)) && (
          <p className="text-sm text-primary font-mono mt-1">{getTeamName(parseInt(teamNumber, 10))}</p>
        )}
      </div>

      {editingEntry && (
        <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2">
          <Pencil className="w-4 h-4 text-warning" />
          <span className="text-sm font-mono">Editing existing entry</span>
          <Button variant="ghost" size="sm" className="ml-auto h-8" onClick={resetForm}>Cancel</Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <PitSection title="Match Info" icon={Crosshair}>
          <MatchInfoSection
            matchType={matchType}
            matchNumber={matchNumber}
            selectedPosition={selectedPosition}
            teamNumber={teamNumber}
            matches={matches}
            loading={matchesLoading}
            onMatchTypeChange={handleMatchTypeChange}
            onMatchNumberChange={setMatchNumber}
            onPositionSelect={handlePositionSelect}
            onTeamNumberChange={setTeamNumber}
            onRefresh={() => refetchMatches(matchType)}
          />
        </PitSection>

        {/* One section per phase, built from the season config. A new game needs
            no edits here — only a new file under src/seasons. */}
        {PHASES.map(({ id, title, icon, variant }) => {
          const counters = countersForPhase(season, id);
          const toggles = togglesForPhase(season, id);
          const enums = enumsForPhase(season, id);
          if (counters.length === 0 && toggles.length === 0 && enums.length === 0) return null;

          return (
            <PitSection key={id} title={title} icon={icon} variant={variant}>
              {counters.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {counters.map((c) => (
                    <IntegerStepper
                      key={c.key}
                      value={numberAt(c.key)}
                      onChange={(v) => set(c.key, v)}
                      label={c.label}
                      min={c.min ?? 0}
                      max={c.max ?? 999}
                    />
                  ))}
                </div>
              )}

              {toggles.length > 0 && (
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${counters.length > 0 ? 'mt-4' : ''}`}>
                  {toggles.map((t) => (
                    <ToggleButton
                      key={t.key}
                      value={boolAt(t.key)}
                      onChange={(v) => set(t.key, v)}
                      label={t.label}
                      onLabel="YES"
                      offLabel="NO"
                      invertColors={t.destructive}
                    />
                  ))}
                </div>
              )}

              {enums.map((e) => {
                // Numeric enums (defense 0–3) are stored as integers.
                const numeric = e.options.every((o) => /^\d+$/.test(o.value));
                return (
                  <div key={e.key} className={counters.length > 0 || toggles.length > 0 ? 'mt-4' : ''}>
                    <OptionSelector
                      label={e.label}
                      options={e.options.map((o) => ({
                        value: numeric ? parseInt(o.value, 10) : o.value,
                        label: o.label,
                        sublabel: o.sublabel,
                        color: o.color,
                      }))}
                      value={numeric ? numberAt(e.key) : stringAt(e.key)}
                      onChange={(v) => set(e.key, v as FieldValue)}
                      columns={4}
                    />
                  </div>
                );
              })}

              {/* Hints live below the controls so the grid stays tidy. */}
              {[...counters, ...toggles].some((f) => f.hint) && (
                <div className="mt-3 space-y-0.5">
                  {[...counters, ...toggles].filter((f) => f.hint).map((f) => (
                    <p key={f.key} className="text-[11px] font-mono text-muted-foreground">
                      {f.label}: {f.hint}
                    </p>
                  ))}
                </div>
              )}
            </PitSection>
          );
        })}

        {fouls.length > 0 && (
          <PitSection title="Fouls" icon={AlertTriangle} variant="warning">
            <div className="grid grid-cols-2 gap-4">
              {fouls.map((c) => (
                <IntegerStepper
                  key={c.key}
                  value={numberAt(c.key)}
                  onChange={(v) => set(c.key, v)}
                  label={c.label}
                  min={c.min ?? 0}
                  max={c.max ?? 99}
                />
              ))}
            </div>
            <p className="text-[11px] font-mono text-muted-foreground mt-3">
              Worth {liveScore.foulsGiven} pts to the opposing alliance.
            </p>
          </PitSection>
        )}

        <PitSection title="Notes" icon={Pencil}>
          <Textarea
            value={stringAt('notes')}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Optional observations — e.g. robot disconnected, gripper broke, alliance blocked..."
            className="min-h-[80px] bg-background border-border font-mono text-sm resize-none"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground mt-1">{stringAt('notes').length}/500</p>
        </PitSection>

        {/* Running total — catches a mis-tapped stepper before it reaches the DB. */}
        <PitSection title="This Match" icon={Calculator}>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Auto', value: liveScore.auto },
              { label: 'TeleOp', value: liveScore.teleop },
              { label: 'Endgame', value: liveScore.endgame },
              { label: 'Total', value: liveScore.total },
            ].map((cell) => (
              <div key={cell.label} className="bg-muted/40 rounded-md p-2.5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{cell.label}</p>
                <p className="font-display text-xl">{cell.value}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground mt-2 text-center">
            Priced with {season.name} point values.
          </p>
        </PitSection>

        {!validation.valid || !isApproved ? (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div className="text-xs font-mono">
              <span className="text-warning font-semibold">Before saving:</span>
              <span className="text-muted-foreground">
                {' '}needs {[...validation.missing, ...(isApproved ? [] : ['account approval'])]
                  .join(', ')
                  .toLowerCase()}.
              </span>
            </div>
          </div>
        ) : null}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
            className="flex-1 h-14 text-base gap-2 font-mono"
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </Button>
          <Button
            type="submit"
            className="flex-1 h-14 text-base gap-2 font-display bg-primary text-primary-foreground hover:bg-primary/90 bg-glow"
            disabled={saving || !isApproved || !validation.valid}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" />
              : !isOnline ? <WifiOff className="w-5 h-5" />
              : <Save className="w-5 h-5" />}
            {isOnline ? 'Save Match' : 'Save Offline'}
          </Button>
        </div>

        {/* Hand-off by QR: the scout's phone shows it, the lead's phone reads it. */}
        <div className="pb-8">
          {savedRow ? (
            <EntryQRCard
              season={season}
              kind="match"
              eventCode={currentEvent.code}
              rows={[savedRow]}
              title="Hand Off This Entry"
              caption={`Team ${savedRow.team_number} · Match ${savedRow.match_number} · ${liveScore.total} pts`}
              onDismiss={resetForm}
            />
          ) : (
            <p className="flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground">
              <QrCode className="w-3.5 h-3.5" />
              Save to get a QR code for handing this entry to the lead device.
            </p>
          )}
        </div>
      </form>
      </div>
    </AppLayout>
  );
}
