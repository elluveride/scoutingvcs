import { describe, it, expect } from 'vitest';
import { parseConsentRequest, buildRedirect } from '@/lib/mcpConsent';

const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'; // 43 chars, base64url

const base = () =>
  new URLSearchParams({
    response_type: 'code',
    client_id: 'mcp_abc',
    redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
    state: 'xyz',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

describe('parseConsentRequest', () => {
  it('accepts a well-formed PKCE request', () => {
    const r = parseConsentRequest(base());
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.clientId).toBe('mcp_abc');
    expect(r.state).toBe('xyz');
    expect(r.codeChallengeMethod).toBe('S256');
  });

  it('requires PKCE with S256', () => {
    const noChallenge = base();
    noChallenge.delete('code_challenge');
    expect(parseConsentRequest(noChallenge)).toHaveProperty('error');

    const plain = base();
    plain.set('code_challenge_method', 'plain');
    expect(parseConsentRequest(plain)).toHaveProperty('error');

    const malformed = base();
    malformed.set('code_challenge', 'too-short');
    expect(parseConsentRequest(malformed)).toHaveProperty('error');
  });

  it('allows http only for loopback redirects', () => {
    const local = base();
    local.set('redirect_uri', 'http://localhost:3000/callback');
    expect(parseConsentRequest(local)).not.toHaveProperty('error');

    const remote = base();
    remote.set('redirect_uri', 'http://evil.example/callback');
    expect(parseConsentRequest(remote)).toHaveProperty('error');
  });

  it('rejects dangerous redirect schemes and fragments', () => {
    const js = base();
    js.set('redirect_uri', 'javascript:alert(1)');
    expect(parseConsentRequest(js)).toHaveProperty('error');

    const frag = base();
    frag.set('redirect_uri', 'https://app.example/cb#nope');
    expect(parseConsentRequest(frag)).toHaveProperty('error');
  });

  it('rejects non-code response types and missing client_id', () => {
    const token = base();
    token.set('response_type', 'token');
    expect(parseConsentRequest(token)).toHaveProperty('error');

    const noClient = base();
    noClient.delete('client_id');
    expect(parseConsentRequest(noClient)).toHaveProperty('error');
  });

  it('drops an over-long state rather than forwarding it', () => {
    const long = base();
    long.set('state', 'x'.repeat(3000));
    const r = parseConsentRequest(long);
    expect('error' in r ? null : r.state).toBeNull();
  });
});

describe('buildRedirect', () => {
  it('appends code and state, skips nullish, keeps existing params', () => {
    const url = buildRedirect('https://app.example/cb?keep=1', { code: 'abc', state: null, error: undefined });
    const u = new URL(url);
    expect(u.searchParams.get('keep')).toBe('1');
    expect(u.searchParams.get('code')).toBe('abc');
    expect(u.searchParams.has('state')).toBe(false);
    expect(u.searchParams.has('error')).toBe(false);
  });

  it('carries the state back on denial', () => {
    const url = buildRedirect('https://app.example/cb', { error: 'access_denied', state: 'xyz' });
    const u = new URL(url);
    expect(u.searchParams.get('error')).toBe('access_denied');
    expect(u.searchParams.get('state')).toBe('xyz');
  });
});
