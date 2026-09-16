import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useFTCRankings } from '@/hooks/useFTCRankings';
import { useOnlineStatus } from '@/hooks/useOfflineSync';
import {
  queuePitEntry,
  getQueuedPitEntry,
  cachePitEntries,
  getCachedPitEntries,
  upsertCachedPitEntry,
  type CachedPitRow,
} from '@/lib/offlineDb';
import { compressImage } from '@/lib/imageCompress';
import { ROBOT_PHOTO_BUCKET, robotPhotoPath, storagePathFromStored } from '@/lib/pitPhoto';
import { normalizePaths, pathsForSave, type DrawnPath } from '@/lib/autoPaths';
import { PitSection } from '@/components/match-scout/PitSection';
import { OptionSelector } from '@/components/match-scout/OptionSelector';
import { DrawableFieldMap } from '@/components/pit-scout/DrawableFieldMap';
import {
  Loader2, Save, Search, Wrench, Bot, Flag, User, Camera, X, Image as ImageIcon, Map,
  WifiOff, AlertTriangle, CheckCircle2, Circle, Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DriveType, ConsistencyLevel, AutoLeaveStatus } from '@/types/scouting';
import { useSeason } from '@/hooks/useSeason';
import { EntryQRCard } from '@/components/scout/EntryQRCard';
import type { SeasonConfig } from '@/seasons/types';

type PitRow = Tables<'pit_entries'>;

interface PitForm {
  teamName: string;
  driveType: DriveType;
  /** Keyed by the active season's capability column names. */
  caps: Record<string, boolean>;
  autoConsistency: ConsistencyLevel;
  reliableAutoLeave: AutoLeaveStatus;
  preferredStart: 'close' | 'far';
  endgameConsistency: ConsistencyLevel;
  autoPaths: DrawnPath[];
}

interface PhotoState {
  /** Storage path currently saved in the DB for this team (null if none). */
  savedPath: string | null;
  /** What to show in the <img>. Signed URL for saved photos, object URL for new captures. */
  previewUrl: string | null;
  /** Newly captured/compressed bytes waiting to be uploaded on save. */
  pendingBlob: Blob | null;
  /** User removed the saved photo; delete it on save. */
  removed: boolean;
}

const emptyForm = (season: SeasonConfig): PitForm => ({
  teamName: '',
  driveType: 'tank',
  caps: Object.fromEntries(season.pit.capabilities.map((c) => [c.key, false])),
  autoConsistency: 'low',
  reliableAutoLeave: 'no',
  preferredStart: 'close',
  endgameConsistency: 'low',
  autoPaths: [],
});

const emptyPhoto = (): PhotoState => ({ savedPath: null, previewUrl: null, pendingBlob: null, removed: false });

function rowToForm(row: CachedPitRow | PitRow, season: SeasonConfig): PitForm {
  const r = row as Record<string, unknown>;
  return {
    teamName: (r.team_name as string) ?? '',
    driveType: (r.drive_type as DriveType) ?? 'tank',
    caps: Object.fromEntries(season.pit.capabilities.map((c) => [c.key, !!r[c.key]])),
    autoConsistency: (r.auto_consistency as ConsistencyLevel) ?? 'low',
    reliableAutoLeave: (r.reliable_auto_leave as AutoLeaveStatus) ?? 'no',
    preferredStart: (r.preferred_start as 'close' | 'far') === 'far' ? 'far' : 'close',
    endgameConsistency: (r.endgame_consistency as ConsistencyLevel) ?? 'low',
    autoPaths: normalizePaths(r.auto_paths as Json),
  };
}

function parseTeam(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n >= 1 && n <= 99999 ? n : null;
}

export default function PitScout() {
  const { user, isApproved } = useAuth();
  const { currentEvent } = useEvent();
  const { toast } = useToast();
  const { rankings } = useFTCRankings();
  const isOnline = useOnlineStatus();
  const season = useSeason();

  const [teamNumber, setTeamNumber] = useState('');
  /** Team whose data is currently in the form. Save is blocked until the typed team matches. */
  const [loadedTeam, setLoadedTeam] = useState<number | null>(null);
  const [form, setForm] = useState<PitForm>(() => emptyForm(season));
  const [photo, setPhoto] = useState<PhotoState>(emptyPhoto);
  const [dirty, setDirty] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [lastEditInfo, setLastEditInfo] = useState<string | null>(null);
  const [loadedFrom, setLoadedFrom] = useState<'cloud' | 'cache' | 'queue' | 'new' | null>(null);
  const [eventTeams, setEventTeams] = useState<number[]>([]);
  const [scoutedTeams, setScoutedTeams] = useState<Set<number>>(new Set());
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  /** The row just saved, held so the scout can hand it over by QR. */
  const [savedRow, setSavedRow] = useState<Record<string, unknown> | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const eventCode = currentEvent?.code ?? '';
  const parsedTeam = parseTeam(teamNumber);
  const teamMismatch = parsedTeam !== null && loadedTeam !== null && parsedTeam !== loadedTeam;
  const needsLoad = parsedTeam !== null && loadedTeam !== parsedTeam;

  const patch = useCallback((changes: Partial<PitForm>) => {
    setForm((f) => ({ ...f, ...changes }));
    setDirty(true);
  }, []);

  // A season switch reshapes the capability list. Re-key the form so the
  // toggles on screen are the ones that get saved, keeping any answer the two
  // games have in common rather than silently writing every capability false.
  useEffect(() => {
    setForm((f) => ({
      ...f,
      caps: Object.fromEntries(season.pit.capabilities.map((c) => [c.key, !!f.caps[c.key]])),
    }));
  }, [season]);

  /*──────────────── event-wide data (team list + scouted set + offline cache) ────────────────*/
  const refreshEventData = useCallback(async () => {
    if (!eventCode) return;
    if (navigator.onLine) {
      const [pitRes, cacheRes] = await Promise.all([
        supabase.from('pit_entries').select('*').eq('event_code', eventCode),
        supabase.from('ftc_events_cache').select('team_numbers').eq('code', eventCode).maybeSingle(),
      ]);
      if (pitRes.data) {
        await cachePitEntries(eventCode, pitRes.data as unknown as CachedPitRow[]);
        setScoutedTeams(new Set(pitRes.data.map((r) => r.team_number)));
      }
      const nums = Array.isArray(cacheRes.data?.team_numbers)
        ? (cacheRes.data.team_numbers as unknown[]).filter((n): n is number => typeof n === 'number')
        : [];
      if (nums.length) setEventTeams([...nums].sort((a, b) => a - b));
    } else {
      const cached = await getCachedPitEntries(eventCode);
      if (cached) setScoutedTeams(new Set(cached.entries.map((r) => r.team_number)));
    }
  }, [eventCode]);

  useEffect(() => {
    refreshEventData();
  }, [refreshEventData, isOnline]);

  // Fall back to the ranking list for the team chips when the events cache has nothing.
  useEffect(() => {
    if (eventTeams.length === 0 && rankings.length > 0) {
      setEventTeams(rankings.map((r) => r.teamNumber).sort((a, b) => a - b));
    }
  }, [rankings, eventTeams.length]);

  /*──────────────── unsaved-changes guard ────────────────*/
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Revoke object URLs when replaced/unmounted.
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const setPreviewObjectUrl = (blob: Blob | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    return url;
  };

  /*──────────────── load ────────────────*/
  const loadTeam = useCallback(async (teamNum: number, opts: { force?: boolean } = {}) => {
    if (!eventCode) return;
    if (dirty && loadedTeam !== null && loadedTeam !== teamNum && !opts.force) {
      const ok = window.confirm(`You have unsaved changes for team ${loadedTeam}. Discard them and load team ${teamNum}?`);
      if (!ok) return;
    }

    setLoading(true);
    setTeamNumber(String(teamNum));
    setForm(emptyForm(season));
    setPhoto(emptyPhoto());
    setPreviewObjectUrl(null);
    setExistingId(null);
    setLastEditInfo(null);
    setDirty(false);
    setSavedRow(null);

    let source: typeof loadedFrom = 'new';
    let row: CachedPitRow | PitRow | null = null;

    // 1. A pending offline save always wins (it's the newest thing the scout did).
    const queued = await getQueuedPitEntry(eventCode, teamNum);
    if (queued) {
      row = queued as unknown as CachedPitRow;
      source = 'queue';
      if (queued.photo_blob) {
        setPhoto({ savedPath: queued.robot_photo_url, previewUrl: setPreviewObjectUrl(queued.photo_blob), pendingBlob: queued.photo_blob, removed: false });
      }
    }

    // 2. Cloud when online, otherwise the offline cache.
    if (!row) {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('pit_entries')
          .select('*')
          .eq('event_code', eventCode)
          .eq('team_number', teamNum)
          .maybeSingle();
        if (!error && data) {
          row = data;
          source = 'cloud';
        } else if (error) {
          const cached = await getCachedPitEntries(eventCode);
          const hit = cached?.entries.find((e) => e.team_number === teamNum);
          if (hit) { row = hit; source = 'cache'; }
          toast({ title: 'Could not reach the cloud', description: hit ? 'Loaded the cached copy instead.' : error.message, variant: 'destructive' });
        }
      } else {
        const cached = await getCachedPitEntries(eventCode);
        const hit = cached?.entries.find((e) => e.team_number === teamNum);
        if (hit) { row = hit; source = 'cache'; }
      }
    }

    if (row) {
      const loaded = rowToForm(row, season);
      setForm(loaded);
      const r = row as Partial<PitRow>;
      if (r.id) setExistingId(r.id);

      // Photo: stored value may be a bare path (new) or a signed/public URL (legacy).
      const path = storagePathFromStored(r.robot_photo_url ?? null);
      if (path && source !== 'queue') {
        setPhoto((p) => ({ ...p, savedPath: path }));
        if (navigator.onLine) {
          const { data: signed } = await supabase.storage.from(ROBOT_PHOTO_BUCKET).createSignedUrl(path, 3600);
          if (signed?.signedUrl) setPhoto((p) => ({ ...p, previewUrl: signed.signedUrl }));
        }
      } else if (source === 'queue') {
        setPhoto((p) => ({ ...p, savedPath: (r.robot_photo_url as string | null) ?? null }));
      }

      if (r.last_edited_by && navigator.onLine && source === 'cloud') {
        const { data: editor } = await supabase.from('profiles').select('name').eq('id', r.last_edited_by).maybeSingle();
        const when = r.last_edited_at ? new Date(r.last_edited_at).toLocaleString() : '';
        setLastEditInfo(`Last edited by ${editor?.name || 'Unknown'}${when ? ` on ${when}` : ''}`);
      } else if (source === 'queue') {
        setLastEditInfo('Saved offline on this device — will sync when online.');
      } else if (source === 'cache') {
        setLastEditInfo('Loaded from the offline cache.');
      }
    } else {
      // New team: pre-fill the name from official rankings, then from any prior pit entry.
      const apiTeam = rankings.find((r) => r.teamNumber === teamNum);
      if (apiTeam?.teamName) {
        setForm((f) => ({ ...f, teamName: apiTeam.teamName }));
      } else if (navigator.onLine) {
        const { data: prior } = await supabase
          .from('pit_entries')
          .select('team_name')
          .eq('team_number', teamNum)
          .order('last_edited_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (prior?.team_name) setForm((f) => ({ ...f, teamName: prior.team_name }));
      }
    }

    setLoadedFrom(source);
    setLoadedTeam(teamNum);
    setLoading(false);
  }, [eventCode, dirty, loadedTeam, rankings, toast, season]);

  const handleLoadClick = () => {
    if (parsedTeam === null) {
      toast({ title: 'Invalid team number', description: 'Enter a team number between 1 and 99999.', variant: 'destructive' });
      return;
    }
    loadTeam(parsedTeam);
  };

  /*──────────────── photo ────────────────*/
  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
      toast({ title: 'Invalid file', description: 'Please choose an image.', variant: 'destructive' });
      return;
    }
    setUploadingPhoto(true);
    try {
      const blob = await compressImage(file);
      setPhoto((p) => ({ ...p, pendingBlob: blob, removed: false, previewUrl: setPreviewObjectUrl(blob) }));
      setDirty(true);
    } catch (err) {
      toast({
        title: 'Could not read photo',
        description: err instanceof Error ? err.message : 'Try a JPEG or PNG.',
        variant: 'destructive',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = () => {
    setPreviewObjectUrl(null);
    setPhoto((p) => ({ ...p, pendingBlob: null, previewUrl: null, removed: !!p.savedPath }));
    setDirty(true);
  };

  /*──────────────── save ────────────────*/
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentEvent) return;

    if (!isApproved) {
      toast({ title: 'Account Pending', description: 'Your account must be approved to submit scouting data.', variant: 'destructive' });
      return;
    }
    if (parsedTeam === null) {
      toast({ title: 'Invalid team number', description: 'Enter a team number between 1 and 99999.', variant: 'destructive' });
      return;
    }
    if (needsLoad) {
      toast({ title: 'Load the team first', description: `Press Load to switch to team ${parsedTeam} before saving.`, variant: 'destructive' });
      return;
    }
    const teamName = form.teamName.trim();
    if (!teamName) {
      toast({ title: 'Missing team name', description: 'Please enter the team name.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const photoPath = robotPhotoPath(currentEvent.code, parsedTeam);
    const nextPhotoPath = photo.pendingBlob ? photoPath : photo.removed ? null : photo.savedPath;
    const removePath = photo.removed && photo.savedPath && photo.savedPath !== nextPhotoPath ? photo.savedPath : null;

    const row = {
      event_code: currentEvent.code,
      team_number: parsedTeam,
      team_name: teamName,
      drive_type: form.driveType,
      // Capability columns are whatever the active season declares.
      ...Object.fromEntries(season.pit.capabilities.map((c) => [c.key, !!form.caps[c.key]])),
      auto_consistency: form.autoConsistency,
      reliable_auto_leave: form.reliableAutoLeave,
      preferred_start: form.preferredStart,
      endgame_consistency: form.endgameConsistency,
      auto_paths: pathsForSave(form.autoPaths) as unknown as Json,
      robot_photo_url: nextPhotoPath,
      last_edited_by: user.id,
      last_edited_at: new Date().toISOString(),
    };

    try {
      if (!navigator.onLine) {
        await queuePitEntry({ ...row, photo_blob: photo.pendingBlob, remove_photo_path: removePath });
        await upsertCachedPitEntry(row as unknown as CachedPitRow);
        setScoutedTeams((s) => new Set(s).add(parsedTeam));
        setDirty(false);
        setLoadedFrom('queue');
        setLastEditInfo('Saved offline on this device — will sync when online.');
        setSavedRow(row);
        toast({
          title: 'Saved Offline',
          description: `Pit data for Team ${parsedTeam} queued — sync on reconnect, or hand it over by QR.`,
        });
        return;
      }

      // Upload first: the row has to point at an object that exists.
      if (photo.pendingBlob) {
        const { error: upErr } = await supabase.storage
          .from(ROBOT_PHOTO_BUCKET)
          .upload(photoPath, photo.pendingBlob, { upsert: true, contentType: 'image/jpeg' });
        if (upErr) throw new Error(`Photo upload failed: ${upErr.message}`);
      }

      const result = await supabase
        .from('pit_entries')
        .upsert(row, { onConflict: 'event_code,team_number' })
        .select('id')
        .single();
      if (result.error) throw new Error(result.error.message);

      // Delete the replaced object only after the row that referenced it is saved.
      if (removePath) {
        await supabase.storage.from(ROBOT_PHOTO_BUCKET).remove([removePath]);
      }

      if (result.data?.id) setExistingId(result.data.id);
      await upsertCachedPitEntry(row as unknown as CachedPitRow);
      setScoutedTeams((s) => new Set(s).add(parsedTeam));
      setPhoto({ savedPath: nextPhotoPath, previewUrl: photo.previewUrl, pendingBlob: null, removed: false });
      setDirty(false);
      setLoadedFrom('cloud');
      setLastEditInfo(`Last edited by you on ${new Date().toLocaleString()}`);
      setSavedRow(row);
      toast({ title: 'Saved!', description: `Pit data for Team ${parsedTeam} saved.` });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  /*──────────────── derived UI bits ────────────────*/
  const capabilityToggles = season.pit.capabilities;

  // Option lists follow the active season, so a switch reshapes the form without a reload.
  const driveOptions = useMemo(
    () => season.pit.driveOptions.map((o) => ({ value: o.value as DriveType, label: o.label })),
    [season],
  );
  const consistencyOptions = useMemo(
    () => season.pit.consistencyOptions.map((o) => ({ value: o.value as ConsistencyLevel, label: o.label })),
    [season],
  );
  const autoLeaveOptions = useMemo(
    () => season.pit.autoLeaveOptions.map((o) => ({ value: o.value as AutoLeaveStatus, label: o.label })),
    [season],
  );
  const preferredStartOptions = useMemo(
    () => season.pit.preferredStartOptions.map((o) => ({ value: o.value as 'close' | 'far', label: o.label })),
    [season],
  );

  const remainingTeams = useMemo(
    () => eventTeams.filter((t) => !scoutedTeams.has(t)),
    [eventTeams, scoutedTeams],
  );

  if (!user) return <Navigate to="/auth" replace />;
  if (!currentEvent) return <Navigate to="/event-select" replace />;

  const issues: string[] = [];
  if (!teamNumber) issues.push('team number');
  else if (parsedTeam === null) issues.push('valid team number');
  else if (needsLoad) issues.push(`Load for team ${parsedTeam}`);
  if (loadedTeam !== null && !form.teamName.trim()) issues.push('team name');
  if (!isApproved) issues.push('account approval');
  const canSave = issues.length === 0 && !saving && !loading;

  return (
    <AppLayout>
      {/* `alliance-swap` flips every red/blue element on this page to follow the
          selected alliance theme (see index.css). */}
      <div className="alliance-swap">
        <PageHeader
          title="Pit Scouting"
          description={`Record team capabilities and robot info — ${season.name}`}
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Team picker */}
          <PitSection title="Find Team" icon={Search}>
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="teamNumber">Team Number</Label>
                <Input
                  id="teamNumber"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99999}
                  value={teamNumber}
                  onChange={(e) => setTeamNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLoadClick();
                    }
                  }}
                  onBlur={() => {
                    // Auto-load when the scout taps away from the box with a new team typed.
                    if (parsedTeam !== null && parsedTeam !== loadedTeam && !loading) loadTeam(parsedTeam);
                  }}
                  placeholder="e.g., 12841"
                  className="h-14 text-xl font-mono"
                />
              </div>
              <Button
                type="button"
                variant={needsLoad ? 'default' : 'secondary'}
                onClick={handleLoadClick}
                disabled={parsedTeam === null || loading}
                className="h-14 px-6"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Load'}
              </Button>
            </div>

            {teamMismatch && (
              <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                <span>
                  The form still shows <b>team {loadedTeam}</b>. Press <b>Load</b> to switch to team {parsedTeam}.
                </span>
              </div>
            )}

            {lastEditInfo && !teamMismatch && (
              <p className={cn(
                'text-sm mt-3 px-3 py-2 rounded flex items-center gap-2',
                loadedFrom === 'queue' ? 'bg-warning/10 text-warning' : 'bg-muted/50 text-muted-foreground',
              )}>
                {loadedFrom === 'queue' && <WifiOff className="w-4 h-4 shrink-0" />}
                {lastEditInfo}
              </p>
            )}

            {loadedTeam !== null && loadedFrom === 'new' && !teamMismatch && (
              <p className="text-sm mt-3 px-3 py-2 rounded bg-primary/10 text-primary flex items-center gap-2">
                <Circle className="w-3 h-3" /> No pit data yet for team {loadedTeam} — you're the first.
              </p>
            )}

            {eventTeams.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="pit-counter-label">Teams at this event</span>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    {scoutedTeams.size}/{eventTeams.length} scouted{remainingTeams.length > 0 ? ` • ${remainingTeams.length} left` : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {eventTeams.map((t) => {
                    const done = scoutedTeams.has(t);
                    const active = loadedTeam === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => loadTeam(t)}
                        className={cn(
                          'px-2.5 py-1.5 rounded-md text-xs font-mono border transition-all touch-manipulation min-h-[36px] inline-flex items-center gap-1',
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : done
                              ? 'border-success/40 bg-success/10 text-success'
                              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
                        )}
                        title={done ? 'Pit scouted' : 'Not scouted yet'}
                      >
                        {done ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3 opacity-50" />}
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </PitSection>

          <fieldset disabled={loadedTeam === null || loading} className="space-y-4 disabled:opacity-60">
            {/* Team Info */}
            <PitSection title="Team Info" icon={User} variant="blue">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="teamName">Team Name</Label>
                  <Input
                    id="teamName"
                    value={form.teamName}
                    onChange={(e) => patch({ teamName: e.target.value })}
                    placeholder="e.g., Robotics Eagles"
                    className="h-14"
                    maxLength={80}
                  />
                </div>
                <OptionSelector
                  label="Drive Type"
                  options={driveOptions}
                  value={form.driveType}
                  onChange={(v) => patch({ driveType: v })}
                  columns={4}
                />
              </div>
            </PitSection>

            {/* Capabilities */}
            <PitSection title="Capabilities" icon={Wrench}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {capabilityToggles.map((cap) => (
                  <ToggleButton
                    key={cap.key}
                    value={form.caps[cap.key]}
                    onChange={(v) => patch({ caps: { ...form.caps, [cap.key]: v } })}
                    label={cap.label}
                  />
                ))}
              </div>
            </PitSection>

            {/* Autonomous */}
            <PitSection title="Autonomous" icon={Bot} variant="blue">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <OptionSelector
                  label="Autonomous Consistency"
                  options={consistencyOptions}
                  value={form.autoConsistency}
                  onChange={(v) => patch({ autoConsistency: v })}
                  columns={3}
                />
                <OptionSelector
                  label="Reliable Auto Leave"
                  options={autoLeaveOptions}
                  value={form.reliableAutoLeave}
                  onChange={(v) => patch({ reliableAutoLeave: v })}
                  columns={3}
                />
                <OptionSelector
                  label="Preferred Start"
                  options={preferredStartOptions}
                  value={form.preferredStart}
                  onChange={(v) => patch({ preferredStart: v })}
                  columns={2}
                />
              </div>
              <div className="space-y-2">
                <span className="pit-counter-label flex items-center gap-2">
                  <Map className="w-3.5 h-3.5" /> Autonomous Paths
                </span>
                <DrawableFieldMap
                  paths={form.autoPaths}
                  onChange={(paths) => patch({ autoPaths: paths })}
                  disabled={loadedTeam === null}
                />
              </div>
            </PitSection>

            {/* Endgame */}
            <PitSection title="Endgame" icon={Flag} variant="red">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <OptionSelector
                  label="Endgame Consistency"
                  options={consistencyOptions}
                  value={form.endgameConsistency}
                  onChange={(v) => patch({ endgameConsistency: v })}
                  columns={3}
                />
              </div>
            </PitSection>

            {/* Robot Photo */}
            <PitSection title="Robot Photo" icon={Camera}>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoFile} className="hidden" />
              <input ref={galleryInputRef} type="file" accept="image/*,.heic,.heif" onChange={handlePhotoFile} className="hidden" />
              {photo.previewUrl ? (
                <div className="relative w-full max-w-md">
                  <img
                    src={photo.previewUrl}
                    alt={`Team ${loadedTeam ?? ''} robot`}
                    className="w-full rounded-lg border border-border object-cover"
                  />
                  {photo.pendingBlob && (
                    <span className="absolute bottom-2 left-2 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-warning text-warning-foreground">
                      Not uploaded yet — save to upload
                    </span>
                  )}
                  <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2" onClick={removePhoto} aria-label="Remove photo">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-28 flex flex-col gap-2 border-dashed"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={uploadingPhoto || loadedTeam === null}
                  >
                    {uploadingPhoto ? <Loader2 className="w-8 h-8 animate-spin" /> : <Camera className="w-8 h-8 text-muted-foreground" />}
                    <span className="text-muted-foreground">Take photo</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-28 flex flex-col gap-2 border-dashed"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={uploadingPhoto || loadedTeam === null}
                  >
                    {uploadingPhoto ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8 text-muted-foreground" />}
                    <span className="text-muted-foreground">Choose from gallery</span>
                  </Button>
                  {photo.removed && (
                    <p className="sm:col-span-2 text-xs text-warning font-mono flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" /> Photo will be deleted when you save.
                    </p>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Photos are downscaled on your device before upload, so they're quick even on venue wifi.
              </p>
            </PitSection>
          </fieldset>

          {/* Validation summary — surfaces missing fields before save */}
          {issues.length > 0 && loadedTeam !== null && (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs font-mono">
                <span className="text-warning font-semibold">Before saving:</span>
                <span className="text-muted-foreground"> needs {issues.join(', ')}.</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 pb-8">
            <Button
              type="submit"
              className="flex-1 h-14 text-lg gap-2 font-display bg-primary text-primary-foreground hover:bg-primary/90 bg-glow"
              disabled={!canSave}
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : !isOnline ? (
                <WifiOff className="w-5 h-5" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {!isOnline ? 'Save Offline' : existingId || loadedFrom === 'queue' ? 'Update Pit Data' : 'Save Pit Data'}
              {dirty && <span className="ml-1 w-2 h-2 rounded-full bg-warning" title="Unsaved changes" />}
            </Button>
          </div>

          {/* Hand-off by QR: the pit scout's phone shows it, the lead's phone reads it.
              The robot photo is not in the payload — it would not fit in a QR code —
              so it uploads on the next sync instead. */}
          <div className="pb-8">
            {savedRow && !dirty && (
              <EntryQRCard
                season={season}
                kind="pit"
                eventCode={currentEvent.code}
                rows={[savedRow]}
                title="Hand Off This Team"
                caption={`Team ${savedRow.team_number} · ${savedRow.team_name}`}
                onDismiss={() => setSavedRow(null)}
              />
            )}
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
