import React from 'react';
import { Wifi, WifiOff, RefreshCw, CloudUpload } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { isOnline, pendingCount, syncing, syncNow } = useOfflineSync();

  // Don't show anything if online and no pending
  if (isOnline && pendingCount === 0 && !syncing) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-mono shadow-lg border transition-all',
        isOnline
          ? 'bg-card border-primary/30 text-foreground'
          : 'bg-destructive/20 border-destructive/40 text-destructive'
      )}
    >
      {isOnline ? (
        <Wifi className="w-4 h-4 text-primary" />
      ) : (
        <WifiOff className="w-4 h-4" />
      )}

      {!isOnline && (
        <span>Offline Mode</span>
      )}

      {pendingCount > 0 && (
        <span className="flex items-center gap-1">
          <CloudUpload className="w-3.5 h-3.5" />
          {pendingCount} pending
        </span>
      )}

      {syncing && (
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
      )}

      {isOnline && pendingCount > 0 && !syncing && (
        <button
          onClick={syncNow}
          className="text-primary hover:underline text-xs"
        >
          Sync Now
        </button>
      )}
    </div>
  );
}
