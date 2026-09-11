/**
 * Pure helpers for the MCP OAuth consent page, kept UI-free so they can be tested.
 *
 * The grant is deliberately all-or-nothing rather than scoped. The MCP tools run
 * against Supabase with the scout's own token, so RLS decides what an agent can
 * touch — exactly what that scout can touch in the app. A "read-only" scope
 * would be a claim the database does not actually enforce, so the consent screen
 * states the real access instead.
 */

export interface ConsentRequest {
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  resource: string | null;
}

/** What the agent will be able to do, shown as a list on the consent screen. */
export const GRANT_SUMMARY = [
  {
    title: 'Read your team’s scouting data',
    detail: 'Match entries, pit scouting, rankings and predictions for events your team can see.',
  },
  {
    title: 'Post insights to your Pit Display',
    detail: 'Notes, alerts and predictions it records appear live on the Pit Display for your team.',
  },
  {
    title: 'Nothing beyond your own access',
    detail: 'The agent acts as you. It can never see or change data you could not see or change yourself.',
  },
] as const;

/** Validate the authorization request query string. Returns `{ error }` on any problem. */
export function parseConsentRequest(params: URLSearchParams): ConsentRequest | { error: string } {
  const responseType = params.get('response_type') || 'code';
  if (responseType !== 'code') return { error: 'Only response_type=code is supported.' };

  const clientId = (params.get('client_id') || '').trim();
  if (!clientId) return { error: 'Missing client_id.' };

  const redirectUri = (params.get('redirect_uri') || '').trim();
  if (!redirectUri) return { error: 'Missing redirect_uri.' };
  try {
    const u = new URL(redirectUri);
    if (u.hash) return { error: 'redirect_uri must not contain a fragment.' };
    const isLoopback = u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
    if (u.protocol === 'http:' && !isLoopback) {
      return { error: 'redirect_uri must use https (plain http is only allowed for localhost).' };
    }
    if (['javascript:', 'data:', 'file:'].includes(u.protocol)) {
      return { error: 'Unsupported redirect_uri scheme.' };
    }
  } catch {
    return { error: 'redirect_uri is not a valid URL.' };
  }

  const codeChallenge = (params.get('code_challenge') || '').trim();
  const method = (params.get('code_challenge_method') || 'S256').trim();
  if (!codeChallenge) return { error: 'This client did not send a PKCE code_challenge, which is required.' };
  if (method !== 'S256') return { error: 'Only the S256 PKCE method is supported.' };
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(codeChallenge)) return { error: 'code_challenge is malformed.' };

  const state = params.get('state');
  const resource = params.get('resource');

  return {
    clientId,
    redirectUri,
    state: state && state.length <= 2048 ? state : null,
    codeChallenge,
    codeChallengeMethod: 'S256',
    resource: resource ? resource.slice(0, 500) : null,
  };
}

/** Append query params to a redirect URI, preserving anything already on it. */
export function buildRedirect(redirectUri: string, params: Record<string, string | null | undefined>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) u.searchParams.set(k, v);
  }
  return u.toString();
}
