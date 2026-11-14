import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, Bot, ShieldCheck } from 'lucide-react';

type Details = {
  client?: { name?: string; client_name?: string; redirect_uri?: string } | null;
  redirect_uri?: string;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type Result = { data: Details | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails(id: string): Promise<Result>;
  approveAuthorization(id: string): Promise<Result>;
  denyAuthorization(id: string): Promise<Result>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
const SCOPE_LABELS: Record<string, string> = {
  openid: 'Confirm who you are',
  email: 'Share your email address',
  profile: 'Share your basic profile',
};

export default function OAuthConsent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const id = new URLSearchParams(window.location.search).get('authorization_id');
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!id) { setError('This connection link is missing its authorization ID. Start the connection again from your assistant.'); return; }
    if (!user) {
      const back = window.location.pathname + window.location.search;
      try { sessionStorage.setItem('mcp_consent_return', back); } catch { /* ignore */ }
      navigate(`/auth?next=${encodeURIComponent(back)}`, { replace: true });
      return;
    }
    oauth().getAuthorizationDetails(id).then(({ data, error }) => {
      if (error) { setError(error.message || 'This request expired. Start the connection again.'); return; }
      const redirect = data?.redirect_url ?? data?.redirect_to;
      if (redirect && !data?.client) { window.location.href = redirect; return; }
      setDetails(data);
    }).catch(() => setError('Could not load this connection request.'));
  }, [id, user, loading, navigate]);

  const decide = async (approve: boolean) => {
    if (!id) return;
    setBusy(true);
    const { data, error } = approve ? await oauth().approveAuthorization(id) : await oauth().denyAuthorization(id);
    const redirect = data?.redirect_url ?? data?.redirect_to;
    if (error || !redirect) { setBusy(false); setError(error?.message || 'Something went wrong. Try again.'); return; }
    window.location.href = redirect;
  };

  const name = details?.client?.name ?? details?.client?.client_name ?? 'An assistant';
  const scopes = (details?.scope ?? 'openid email profile').split(/\s+/).filter(Boolean);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-5">
        {error ? (
          <>
            <h1 className="font-display text-xl text-foreground">Connection failed</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </>
        ) : !details ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center"><Bot className="w-5 h-5 text-primary" /></div>
              <h1 className="font-display text-lg text-foreground">Connect {name} to Apex Scout</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {name} will be able to use Apex Scout's tools as <span className="text-foreground">{user?.email}</span>.
            </p>
            <ul className="space-y-1.5 text-sm">
              {scopes.map((s) => <li key={s}>• {SCOPE_LABELS[s] ?? `Additional permission requested: ${s}`}</li>)}
              <li>• Read your team's scouting data and post insights</li>
            </ul>
            <p className="text-xs text-muted-foreground flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0" />This does not bypass your team permissions — it only sees what you can see.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12" disabled={busy} onClick={() => decide(false)}>Cancel connection</Button>
              <Button className="flex-1 h-12" disabled={busy} onClick={() => decide(true)}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve'}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
