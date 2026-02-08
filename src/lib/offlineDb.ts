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
  created_at: string;
  /** 0 = not synced, 1 = synced (IDB indexes don't support booleans) */
  synced: 0 | 1;
}

interface ScoutingDB {
  matchQueue: {
    key: string;
    value: OfflineMatchEntry;
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
}

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ScoutingDB>('decode-scouting', 3, {
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
            const entry = cursor.value;
            if (typeof entry.synced === 'boolean') {
              entry.synced = entry.synced ? 1 : 0;
              cursor.update(entry);
            }
            return cursor.continue().then(migrateCursor);
          });
        }
      },
    });
  }
  return dbPromise;
}

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

// Get total counts
export async function getQueueStatus() {
  const db = await getDb();
  const all = await db.getAll('matchQueue');
  const unsynced = all.filter(e => e.synced === 0);
  return { total: all.length, pending: unsynced.length };
}

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

// Clear synced entries older than 7 days
export async function cleanupOldEntries() {
  const db = await getDb();
  const all = await db.getAll('matchQueue');
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const entry of all) {
    if (entry.synced === 1 && new Date(entry.created_at).getTime() < cutoff) {
      await db.delete('matchQueue', entry.localId);
    }
  }
}
