import React, { useState, useEffect } from 'react';
import { useServerMode } from '@/contexts/ServerModeContext';
import { checkLocalServerHealth } from '@/lib/localServerApi';
import { PitSection } from '@/components/match-scout/PitSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Server, Cloud, Wifi, WifiOff, Loader2, Zap, AlertTriangle, ExternalLink } from 'lucide-react';

const isSecureContext = typeof window !== 'undefined' && window.location.protocol === 'https:';

export function ServerModeSettings() {
  const { mode, localUrl, setMode, setLocalUrl } = useServerMode();
  const [healthStatus, setHealthStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [healthInfo, setHealthInfo] = useState('');

  // Auto-check health when switching to local mode or changing URL
  useEffect(() => {
    if (mode !== 'local') {
      setHealthStatus('idle');
      return;
    }

    const timer = setTimeout(() => {
      testConnection();
    }, 500);

    return () => clearTimeout(timer);
  }, [mode, localUrl]);

  const testConnection = async () => {
    if (isSecureContext) {
      setHealthStatus('error');
      setHealthInfo('Cannot test from HTTPS. Open the health URL directly in your browser to verify.');
      return;
    }
    setHealthStatus('checking');
    const result = await checkLocalServerHealth(localUrl.replace(/\/+$/, ''));
    if (result.ok) {
      setHealthStatus('ok');
      setHealthInfo(`Connected — ${result.total} entries, ${result.unsynced} unsynced`);
    } else {
      setHealthStatus('error');
      setHealthInfo(result.error || 'Cannot reach server');
    }
  };

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

        {/* Local Mode Settings */}
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
                placeholder="http://192.168.44.1:3000"
                className="h-12 font-mono bg-background border-border"
              />
            </div>

            {/* Test Connection Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={testConnection}
              disabled={healthStatus === 'checking'}
            >
              {healthStatus === 'checking' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Test Connection
            </Button>

            {/* Health Status */}
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
                {healthStatus === 'ok' && healthInfo}
                {healthStatus === 'error' && healthInfo}
                {healthStatus === 'idle' && 'Cloud mode active'}
              </span>
            </div>

            {/* HTTPS Warning */}
            {isSecureContext && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs font-mono border bg-warning/10 border-warning/30 text-warning">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">HTTPS blocks local connections</p>
                  <p className="mt-1 text-muted-foreground">
                    Browsers block HTTP requests from HTTPS pages. Test Connection won't work from this preview.
                    Verify your server by opening the health URL directly:
                  </p>
                  <a
                    href={`${localUrl.replace(/\/+$/, '')}/api/health`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-primary hover:underline"
                  >
                    {localUrl.replace(/\/+$/, '')}/api/health
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <p className="mt-1 text-muted-foreground">
                    Submissions still work when your phone is on the local network and accesses the app via HTTP.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-mono font-semibold">
                Connection Options:
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                <strong>Bluetooth PAN (recommended):</strong> Pair phone with laptop via Bluetooth.
                Set laptop Bluetooth adapter IP to 192.168.44.1. Default URL works automatically.
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                <strong>USB Tethering (fallback):</strong> Connect phone to laptop via USB cable.
                Enable USB Tethering on phone. Check laptop&apos;s new network adapter IP and update the URL above.
              </p>
            </div>
          </div>
        )}
      </div>
    </PitSection>
  );
}
