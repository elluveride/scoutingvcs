import { openDB, IDBPDatabase } from 'idb';

export interface OfflineMatchEntry {
  localId: string;
  event_code: string;
  team_number: number;
  match_number: number;
  scouter_id: string;
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
  notes: string;
  created_at: string;
  /** 0 = not synced, 1 = synced (IDB indexes don't support booleans) */
  synced: 0 | 1;
}

/** Pit entry queued while offline. Mirrors the `pit_entries` row plus an optional pending photo. */
export interface OfflinePitEntry {
  /** `pit:{event}:{team}` — re-saving the same team offline replaces the queued copy. */
  localId: string;
  event_code: string;
  team_number: number;
  team_name: string;
  drive_type: string;
  scores_motifs: boolean;
  scores_artifacts: boolean;
  scores_depot: boolean;
  has_autonomous: boolean;
  auto_consistency: string;
  reliable_auto_leave: string;
  preferred_start: string;
  endgame_consistency: string;
  auto_paths: unknown;
  /** Bucket-relative storage path (or null when the photo was removed). */
  robot_photo_url: string | null;
  last_edited_by: string;
  last_edited_at: string;
  /** Photo bytes captured offline; uploaded to `robot_photo_url` during sync. */
  photo_blob?: Blob | null;
  /** When true, the previous photo at `remove_photo_path` is deleted during sync. */
  remove_photo_path?: string | null;
  created_at: string;
  synced: 0 | 1;
}

export interface CachedPitRow {
  event_code: string;
  team_number: number;
  [key: string]: unknown;
}

interface ScoutingDB {
  matchQueue: {
    key: string;
    value: OfflineMatchEntry;
    indexes: { 'by-synced': number; 'by-event': string };
  };
  pitQueue: {
    key: string;
    value: OfflinePitEntry;
    indexes: { 'by-synced': number; 'by-event': string };
  };
  cachedMatches: {
    key: string;
    value: {
      eventCode: string;
      matches: unknown[];
      cachedAt: string;
    };
  };
  cachedEntries: {
    key: string;
    value: {
      eventCode: string;
      entries: unknown[];
      cachedAt: string;
    };
  };
  cachedPitEntries: {
    key: string;
    value: {
      eventCode: string;
      entries: CachedPitRow[];
      cachedAt: string;
    };
  };
}

/** Fired on `window` whenever the offline queues change, so UI counters can refresh immediately. */
export const QUEUE_CHANGED_EVENT = 'scouting-queue-changed';

function notifyQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
  }
}

let dbPromise: Promise<IDBPDatabase<ScoutingDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ScoutingDB>('decode-scouting', 4, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('matchQueue')) {
            const store = db.createObjectStore('matchQueue', { keyPath: 'localId' });
            store.createIndex('by-synced', 'synced');
            store.createIndex('by-event', 'event_code');
          }
          if (!db.objectStoreNames.contains('cachedMatches')) {
            db.createObjectStore('cachedMatches', { keyPath: 'eventCode' });
          }
          if (!db.objectStoreNames.contains('cachedEntries')) {
            db.createObjectStore('cachedEntries', { keyPath: 'eventCode' });
          }
        }
        if (oldVersion < 3) {
          // Migrate boolean synced → numeric 0/1 for IDB index compatibility
          const store = transaction.objectStore('matchQueue');
          store.openCursor().then(function migrateCursor(cursor) {
            if (!cursor) return;
            const entry = cursor.value as OfflineMatchEntry & { synced: unknown };
            if (typeof entry.synced === 'boolean') {
              entry.synced = entry.synced ? 1 : 0;
              cursor.update(entry as OfflineMatchEntry);
            }
            return cursor.continue().then(migrateCursor);
          });
        }
        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains('pitQueue')) {
            const store = db.createObjectStore('pitQueue', { keyPath: 'localId' });
            store.createIndex('by-synced', 'synced');
            store.createIndex('by-event', 'event_code');
          }
          if (!db.objectStoreNames.contains('cachedPitEntries')) {
            db.createObjectStore('cachedPitEntries', { keyPath: 'eventCode' });
          }
        }
      },
    });
  }
  return dbPromise;
}

/*──────────────── match queue ────────────────*/

// Queue a match entry for later sync
export async function queueMatchEntry(entry: Omit<OfflineMatchEntry, 'localId' | 'synced' | 'created_at'>) {
  const db = await getDb();
  const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const full: OfflineMatchEntry = {
    ...entry,
    localId,
    synced: 0,
    created_at: new Date().toISOString(),
  };
  await db.put('matchQueue', full);
  notifyQueueChanged();
  return full;
}

// Get all unsynced entries
export async function getUnsyncedEntries(): Promise<OfflineMatchEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex('matchQueue', 'by-synced', 0);
}

// Mark entry as synced
export async function markSynced(localId: string) {
  const db = await getDb();
  const entry = await db.get('matchQueue', localId);
  if (entry) {
    entry.synced = 1;
    await db.put('matchQueue', entry);
  }
}

// Get all locally stored entries for an event
export async function getLocalEntries(eventCode: string): Promise<OfflineMatchEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex('matchQueue', 'by-event', eventCode);
}

/*──────────────── pit queue ────────────────*/

export function pitQueueId(eventCode: string, teamNumber: number) {
  return `pit:${eventCode}:${teamNumber}`;
}

/** Queue (or replace) a pit entry for later sync. */
export async function queuePitEntry(entry: Omit<OfflinePitEntry, 'localId' | 'synced' | 'created_at'>) {
  const db = await getDb();
  const full: OfflinePitEntry = {
    ...entry,
    localId: pitQueueId(entry.event_code, entry.team_number),
    synced: 0,
    created_at: new Date().toISOString(),
  };
  await db.put('pitQueue', full);
  notifyQueueChanged();
  return full;
}

export async function getUnsyncedPitEntries(): Promise<OfflinePitEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex('pitQueue', 'by-synced', 0);
}

/** Pending (unsynced) copy of a specific team's pit entry, if any. */
export async function getQueuedPitEntry(eventCode: string, teamNumber: number): Promise<OfflinePitEntry | undefined> {
  const db = await getDb();
  const entry = await db.get('pitQueue', pitQueueId(eventCode, teamNumber));
  return entry && entry.synced === 0 ? entry : undefined;
}

export async function markPitSynced(localId: string) {
  const db = await getDb();
  const entry = await db.get('pitQueue', localId);
  if (entry) {
    entry.synced = 1;
    // Drop the blob once uploaded so IndexedDB doesn't keep megabytes around.
    entry.photo_blob = null;
    await db.put('pitQueue', entry);
  }
}

/*──────────────── status ────────────────*/

// Get total counts across both queues
export async function getQueueStatus() {
  const db = await getDb();
  const [matches, pits] = await Promise.all([db.getAll('matchQueue'), db.getAll('pitQueue')]);
  const matchPending = matches.filter((e) => e.synced === 0).length;
  const pitPending = pits.filter((e) => e.synced === 0).length;
  return {
    total: matches.length + pits.length,
    pending: matchPending + pitPending,
    matchPending,
    pitPending,
  };
}

/*──────────────── caches ────────────────*/

// Cache match schedule for offline use
export async function cacheMatchSchedule(eventCode: string, matches: unknown[]) {
  const db = await getDb();
  await db.put('cachedMatches', { eventCode, matches, cachedAt: new Date().toISOString() });
}

export async function getCachedMatchSchedule(eventCode: string) {
  const db = await getDb();
  return db.get('cachedMatches', eventCode);
}

// Cache scouting entries for offline viewing
export async function cacheEntries(eventCode: string, entries: unknown[]) {
  const db = await getDb();
  await db.put('cachedEntries', { eventCode, entries, cachedAt: new Date().toISOString() });
}

export async function getCachedEntries(eventCode: string) {
  const db = await getDb();
  return db.get('cachedEntries', eventCode);
}

/** Cache the event's pit entries so Pit Scout can load existing data offline. */
export async function cachePitEntries(eventCode: string, entries: CachedPitRow[]) {
  const db = await getDb();
  await db.put('cachedPitEntries', { eventCode, entries, cachedAt: new Date().toISOString() });
}

export async function getCachedPitEntries(eventCode: string) {
  const db = await getDb();
  return db.get('cachedPitEntries', eventCode);
}

/** Merge one row into the cached pit entries for its event (used after local saves). */
export async function upsertCachedPitEntry(row: CachedPitRow) {
  const db = await getDb();
  const existing = await db.get('cachedPitEntries', row.event_code);
  const entries = (existing?.entries ?? []).filter((e) => e.team_number !== row.team_number);
  entries.push(row);
  await db.put('cachedPitEntries', { eventCode: row.event_code, entries, cachedAt: new Date().toISOString() });
}

/*──────────────── housekeeping ────────────────*/

// Clear synced entries older than 7 days
export async function cleanupOldEntries() {
  const db = await getDb();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const matches = await db.getAll('matchQueue');
  for (const entry of matches) {
    if (entry.synced === 1 && new Date(entry.created_at).getTime() < cutoff) {
      await db.delete('matchQueue', entry.localId);
    }
  }
  const pits = await db.getAll('pitQueue');
  for (const entry of pits) {
    if (entry.synced === 1 && new Date(entry.created_at).getTime() < cutoff) {
      await db.delete('pitQueue', entry.localId);
    }
  }
}
