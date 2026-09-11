import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, ShieldAlert, Bot, Check, UserCog } from 'lucide-react';
import apexBadge from '@/assets/apex-scout-badge.png';
import { parseConsentRequest, buildRedirect, GRANT_SUMMARY, type ConsentRequest } from '@/lib/mcpConsent';

interface ClientInfo {
  client_id: string;
  client_name: string;
  client_uri: string | null;
  logo_uri: string | null;
  redirect_uris: unknown;
}

/**
 * OAuth authorization screen for MCP clients (Claude, Cursor, and friends).
 *
 * 1. Not signed in → remember this URL, bounce to /auth, come back after login.
 * 2. Show who is asking, verified against the client's registered redirect URIs.
 * 3. Allow → `mcp_create_auth_code` mints a single-use PKCE code as this user,
 *    then we redirect to the client with ?code&state.
 *    Deny → redirect with error=access_denied.
 */
export default function McpConsent() {
  const location = useLocation();
  const { user, profile, loading, isApproved, needsProfile } = useAuth();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parsed = useMemo(() => parseConsentRequest(new URLSearchParams(location.search)), [location.search]);
  const request: ConsentRequest | null = 'error' in parsed ? null : parsed;

  useEffect(() => {
    if (!user || !request) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('mcp_get_client', { _client_id: request.clientId });
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setClientError('This app is not registered with Apex Scout. Ask it to connect again so it can register.');
        return;
      }
      const c = data[0] as ClientInfo;
      const uris = Array.isArray(c.redirect_uris) ? (c.redirect_uris as unknown[]) : [];
      // Guards against a link that points a legitimate client at someone else's server.
      if (!uris.includes(request.redirectUri)) {
        setClientError('The return address in this request does not match what the app registered, so it was blocked.');
        return;
      }
      setClient(c);
    })();
    return () => { cancelled = true; };
  }, [user, request]);

  if (loading) {
    return (
      <Shell>
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
      </Shell>
    );
  }

  if (!user) {
    try {
      sessionStorage.setItem('mcp_consent_return', `${location.pathname}${location.search}`);
    } catch {
      /* private mode: the user can retry from the client after signing in */
    }
    return <Navigate to="/auth" replace />;
  }

  if (needsProfile) return <Navigate to="/complete-profile" replace />;

  if ('error' in parsed) {
    return (
      <Shell>
        <Header icon={ShieldAlert} tone="destructive" title="Invalid connection request" />
        <p className="text-sm text-muted-foreground">{parsed.error}</p>
        <p className="text-xs text-muted-foreground">
          Go back to the app that sent you here and start the connection again.
        </p>
      </Shell>
    );
  }

  const deny = () => {
    window.location.assign(
      buildRedirect(request!.redirectUri, {
        error: 'access_denied',
        error_description: 'The user denied the request',
        state: request!.state,
      }),
    );
  };

  const allow = async () => {
    if (!request) return;
    setBusy(true);
    setSubmitError(null);
    const { data: code, error } = await supabase.rpc('mcp_create_auth_code', {
      _client_id: request.clientId,
      _redirect_uri: request.redirectUri,
      _code_challenge: request.codeChallenge,
      _code_challenge_method: request.codeChallengeMethod,
      _resource: request.resource,
    });
    if (error || !code) {
      setBusy(false);
      setSubmitError(error?.message || 'Could not create an authorization code.');
      return;
    }
    window.location.assign(buildRedirect(request.redirectUri, { code, state: request.state }));
  };

  const host = (() => {
    try {
      return new URL(request!.redirectUri).host;
    } catch {
      return request!.redirectUri;
    }
  })();

  return (
    <Shell>
      <Header icon={ShieldCheck} tone="primary" title="Connect an AI agent" />

      {clientError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive mb-1">Request blocked</p>
          <p className="text-muted-foreground">{clientError}</p>
        </div>
      ) : !client ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-muted/20 p-4 flex items-center gap-3">
            {client.logo_uri ? (
              <img src={client.logo_uri} alt="" className="w-10 h-10 rounded-lg object-cover bg-muted" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold truncate">{client.client_name}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">{client.client_uri || host}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            <b className="text-foreground">{client.client_name}</b> wants to use Apex Scout as{' '}
            <b className="text-foreground">{profile?.name}</b>
            {profile?.teamNumber ? <> of team {profile.teamNumber}</> : null}. It will be able to:
          </p>

          <ul className="space-y-2">
            {GRANT_SUMMARY.map((g) => (
              <li key={g.title} className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5">
                <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{g.title}</p>
                  <p className="text-xs text-muted-foreground">{g.detail}</p>
                </div>
              </li>
            ))}
          </ul>

          {!isApproved && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm flex items-start gap-2">
              <UserCog className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <span>Your account is still pending approval. An admin must approve you before an agent can connect.</span>
            </div>
          )}

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button type="button" variant="outline" className="h-12" onClick={deny} disabled={busy}>
              Deny
            </Button>
            <Button type="button" className="h-12" onClick={allow} disabled={busy || !isApproved}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Allow'}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            You can disconnect it later under Profile → Connected Agents.
          </p>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase tracking-wider">
          <img src={apexBadge} alt="" className="w-6 h-6 rounded" />
          Apex Scout
        </div>
        {children}
      </div>
    </div>
  );
}

function Header({ icon: Icon, tone, title }: { icon: React.ElementType; tone: 'primary' | 'destructive'; title: string }) {
  return (
    <h1 className="font-display text-xl flex items-center gap-2">
      <Icon className={tone === 'primary' ? 'w-5 h-5 text-primary' : 'w-5 h-5 text-destructive'} />
      {title}
    </h1>
  );
}
