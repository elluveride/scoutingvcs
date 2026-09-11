import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  getUnsyncedEntries,
  markSynced,
  getQueueStatus,
  getUnsyncedPitEntries,
  markPitSynced,
  cleanupOldEntries,
  QUEUE_CHANGED_EVENT,
} from '@/lib/offlineDb';
import { ROBOT_PHOTO_BUCKET } from '@/lib/pitPhoto';
import { useToast } from '@/hooks/use-toast';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Background sync for the offline queues (match entries + pit entries).
 * Mount this once (it lives in OfflineIndicator); pages should only use
 * `useOnlineStatus` so they don't start duplicate sync loops.
 */
export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const status = await getQueueStatus();
      setPendingCount(status.pending);
    } catch (e) {
      console.error('Queue status failed:', e);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncing(true);

    let successCount = 0;
    let errorCount = 0;

    try {
      // ── match entries ──
      const unsynced = await getUnsyncedEntries();
      for (const entry of unsynced) {
        const { localId, synced: _synced, created_at: _createdAt, ...data } = entry;
        const { error } = await supabase.from('match_entries').upsert(
          [{ ...data, endgame_return: data.endgame_return as never, penalty_status: data.penalty_status as never }],
          { onConflict: 'event_code,team_number,match_number,scouter_id' },
        );
        if (!error) {
          await markSynced(localId);
          successCount++;
        } else {
          errorCount++;
          console.error('Sync error for match entry', localId, error);
        }
      }

      // ── pit entries (photo first, then row) ──
      const pits = await getUnsyncedPitEntries();
      for (const entry of pits) {
        const {
          localId, synced: _s, created_at: _c, photo_blob, remove_photo_path, ...row
        } = entry;
        try {
          if (photo_blob && row.robot_photo_url) {
            const { error: upErr } = await supabase.storage
              .from(ROBOT_PHOTO_BUCKET)
              .upload(row.robot_photo_url, photo_blob, { upsert: true, contentType: 'image/jpeg' });
            if (upErr) throw upErr;
          }
          if (remove_photo_path && remove_photo_path !== row.robot_photo_url) {
            await supabase.storage.from(ROBOT_PHOTO_BUCKET).remove([remove_photo_path]);
          }
          const { error } = await supabase.from('pit_entries').upsert(
            {
              ...row,
              drive_type: row.drive_type as never,
              auto_consistency: row.auto_consistency as never,
              reliable_auto_leave: row.reliable_auto_leave as never,
              endgame_consistency: row.endgame_consistency as never,
              auto_paths: row.auto_paths as Json,
            },
            { onConflict: 'event_code,team_number' },
          );
          if (error) throw error;
          await markPitSynced(localId);
          successCount++;
        } catch (e) {
          errorCount++;
          console.error('Sync error for pit entry', localId, e);
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Sync Complete',
          description: `${successCount} entries synced to cloud.${errorCount > 0 ? ` ${errorCount} failed.` : ''}`,
        });
      }

      if (errorCount > 0) {
        toast({
          title: 'Sync Errors',
          description: `${errorCount} entries failed to sync. Will retry.`,
          variant: 'destructive',
        });
      }
    } catch (e) {
      console.error('Sync failed:', e);
    }

    await refreshCount();
    setSyncing(false);
    syncingRef.current = false;
  }, [toast, refreshCount]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline) {
      syncNow();
    }
  }, [isOnline, syncNow]);

  // Periodic sync every 30 seconds when online; instant counter refresh on queue changes
  useEffect(() => {
    refreshCount();
    cleanupOldEntries().catch(() => undefined);
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncNow();
      }
      refreshCount();
    }, 30_000);
    const onQueueChanged = () => {
      refreshCount();
      if (navigator.onLine) syncNow();
    };
    window.addEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
    return () => {
      clearInterval(interval);
      window.removeEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
    };
  }, [syncNow, refreshCount]);

  return { isOnline, pendingCount, syncing, syncNow, refreshCount };
}
