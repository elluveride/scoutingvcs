import React, { useState, useEffect } from 'react';
import { useServerMode } from '@/contexts/ServerModeContext';
import { checkLocalServerHealth } from '@/lib/localServerApi';
import { PitSection } from '@/components/match-scout/PitSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Server, Cloud, Wifi, WifiOff, Loader2 } from 'lucide-react';

export function ServerModeSettings() {
  const { mode, localUrl, setMode, setLocalUrl } = useServerMode();
  const [healthStatus, setHealthStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [healthInfo, setHealthInfo] = useState('');

  // Check health when switching to local mode or changing URL
  useEffect(() => {
    if (mode !== 'local') {
      setHealthStatus('idle');
      return;
    }

    const timer = setTimeout(async () => {
      setHealthStatus('checking');
      const result = await checkLocalServerHealth(localUrl.replace(/\/+$/, ''));
      if (result.ok) {
        setHealthStatus('ok');
        setHealthInfo(`${result.total} total, ${result.unsynced} unsynced`);
      } else {
        setHealthStatus('error');
        setHealthInfo(result.error || 'Cannot reach server');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [mode, localUrl]);

  return (
    <PitSection title="Server Mode" icon={Server}>
      <div className="space-y-4">
        {/* Mode Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('cloud')}
            className={cn(
              'pit-button flex items-center justify-center gap-2 text-sm',
              mode === 'cloud' ? 'pit-button-active' : 'pit-button-muted'
            )}
          >
            <Cloud className="w-4 h-4" />
            Cloud
          </button>
          <button
            type="button"
            onClick={() => setMode('local')}
            className={cn(
              'pit-button flex items-center justify-center gap-2 text-sm',
              mode === 'local' ? 'pit-button-active' : 'pit-button-muted'
            )}
          >
            <Server className="w-4 h-4" />
            Local
          </button>
        </div>

        {mode === 'cloud' && (
          <p className="text-xs text-muted-foreground font-mono">
            Submissions go directly to the cloud database.
          </p>
        )}

        {/* Local URL input */}
        {mode === 'local' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="localUrl" className="text-sm font-mono text-muted-foreground">
                Local Server URL
              </Label>
              <Input
                id="localUrl"
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                placeholder="http://192.168.137.1:3000"
                className="h-12 font-mono bg-background border-border"
              />
            </div>

            {/* Health status */}
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono border',
              healthStatus === 'ok' && 'bg-success/10 border-success/30 text-success',
              healthStatus === 'error' && 'bg-destructive/10 border-destructive/30 text-destructive',
              healthStatus === 'checking' && 'bg-muted border-border text-muted-foreground',
              healthStatus === 'idle' && 'bg-muted border-border text-muted-foreground',
            )}>
              {healthStatus === 'checking' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {healthStatus === 'ok' && <Wifi className="w-3.5 h-3.5" />}
              {healthStatus === 'error' && <WifiOff className="w-3.5 h-3.5" />}
              {healthStatus === 'idle' && <Server className="w-3.5 h-3.5" />}

              <span>
                {healthStatus === 'checking' && 'Checking connection...'}
                {healthStatus === 'ok' && `Connected — ${healthInfo}`}
                {healthStatus === 'error' && healthInfo}
                {healthStatus === 'idle' && 'Cloud mode active'}
              </span>
            </div>

            <p className="text-xs text-muted-foreground font-mono">
              Point this to the laptop running the local server.
              Phones will submit data here instead of the cloud.
            </p>
          </div>
        )}
      </div>
    </PitSection>
  );
}
