import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getUnsyncedEntries, markSynced, getQueueStatus } from '@/lib/offlineDb';
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

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    const status = await getQueueStatus();
    setPendingCount(status.pending);
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncing(true);

    try {
      const unsynced = await getUnsyncedEntries();
      if (unsynced.length === 0) {
        setSyncing(false);
        syncingRef.current = false;
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const entry of unsynced) {
        const { localId, synced, created_at, ...data } = entry;
        const { error } = await supabase.from('match_entries').upsert(
          [data as any],
          { onConflict: 'event_code,team_number,match_number,scouter_id' }
        );

        if (!error) {
          await markSynced(localId);
          successCount++;
        } else {
          errorCount++;
          console.error('Sync error for entry', localId, error);
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

  // Periodic sync every 30 seconds when online
  useEffect(() => {
    refreshCount();
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncNow();
      }
      refreshCount();
    }, 30_000);
    return () => clearInterval(interval);
  }, [syncNow, refreshCount]);

  return { isOnline, pendingCount, syncing, syncNow, refreshCount };
}
