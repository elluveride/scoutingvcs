import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Stethoscope } from 'lucide-react';

type Step = { label: string; ok: boolean; detail: string };

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Checks the public discovery chain Claude follows to connect, step by step. */
export function ConnectionCheck({ serverUrl }: { serverUrl: string }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const out: Step[] = [];
    let issuer = '';
    try {
      const prm = await getJson(`${serverUrl}/.well-known/oauth-protected-resource`);
      issuer = String((prm.authorization_servers as string[] | undefined)?.[0] ?? '');
      out.push({ label: 'Server sign-in info', ok: prm.resource === serverUrl && !!issuer, detail: issuer || 'No sign-in server listed' });
    } catch (e) {
      out.push({ label: 'Server sign-in info', ok: false, detail: `Not reachable (${(e as Error).message}) — republish the app` });
    }
    if (issuer) {
      try {
        const as = await getJson(`${issuer}/.well-known/oauth-authorization-server`);
        out.push({ label: 'Sign-in server', ok: as.issuer === issuer && !!as.authorization_endpoint && !!as.token_endpoint, detail: String(as.issuer ?? '') });
        out.push({ label: 'Self-registration for Claude', ok: !!as.registration_endpoint, detail: as.registration_endpoint ? 'Enabled' : 'Missing' });
      } catch (e) {
        out.push({ label: 'Sign-in server', ok: false, detail: (e as Error).message });
      }
    }
    try {
      const local = await getJson(`${window.location.origin}/.well-known/oauth-protected-resource`);
      out.push({ label: 'App domain pointer', ok: local.resource === serverUrl, detail: String(local.resource ?? '') });
    } catch (e) {
      out.push({ label: 'App domain pointer', ok: false, detail: (e as Error).message });
    }
    setSteps(out);
    setRunning(false);
  };

  const allOk = steps?.every((s) => s.ok);
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Can Claude connect?</p>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={run} disabled={running}>
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5" />}
          Run check
        </Button>
      </div>
      {steps && (
        <>
          <ul className="space-y-1">
            {steps.map((s) => (
              <li key={s.label} className="flex items-start gap-2 text-xs">
                {s.ok ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" /> : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                <span className="font-medium">{s.label}</span>
                <span className="text-muted-foreground truncate">{s.detail}</span>
              </li>
            ))}
          </ul>
          <p className={`text-xs font-medium ${allOk ? 'text-success' : 'text-destructive'}`}>
            {allOk ? 'Ready — Claude can find the server and its sign-in page.' : 'Not ready — fix the red items, then republish.'}
          </p>
        </>
      )}
    </div>
  );
}
