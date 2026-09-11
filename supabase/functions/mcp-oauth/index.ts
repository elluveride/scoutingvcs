// OAuth bridge for the Apex Scout MCP server.
//
// The MCP server (src/lib/mcp) trusts JWTs issued by Supabase Auth. Supabase
// mints those, but it does not offer dynamic client registration or an
// authorization endpoint a third-party MCP client can drive. This function adds
// both, and hands back a genuine Supabase session, so the token a client ends up
// holding is one the MCP server already accepts. No custom token format.
//
// Routes (relative to /functions/v1/mcp-oauth):
//   GET  /.well-known/oauth-authorization-server   RFC 8414 metadata
//   GET  /.well-known/openid-configuration         same document
//   GET  /authorize                                302 → APP_URL/mcp/consent
//   POST /register                                 RFC 7591 registration
//   POST /token                                    authorization_code (PKCE) + refresh_token
//   POST /revoke                                   RFC 7009 revocation
//
// Authorization codes are minted by the consent page through the
// `mcp_create_auth_code` RPC, running as the signed-in user. This function only
// ever sees hashes of codes and refresh tokens.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FN = "mcp-oauth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/*──────────────── small helpers ────────────────*/

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

const oauthError = (error: string, description: string, status = 400) =>
  json({ error, error_description: description }, status);

function appUrl(): string {
  return (Deno.env.get("APP_URL") || "https://scoutingvcs.lovable.app").replace(/\/+$/, "");
}

function supabaseUrl(): string {
  return (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
}

function functionsBase(): string {
  const explicit = Deno.env.get("FUNCTIONS_URL");
  if (explicit) return explicit.replace(/\/+$/, "");
  return `${supabaseUrl()}/functions/v1`;
}

function admin() {
  return createClient(supabaseUrl(), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** PKCE S256: base64url(SHA-256(verifier)) */
async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** Constant-time compare for equal-length hex/base64 strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function routePath(req: Request): string {
  const path = new URL(req.url).pathname
    .replace(/^\/functions\/v1/, "")
    .replace(new RegExp(`^/${FN}`), "");
  return path.replace(/\/+$/, "") || "/";
}

/** Accept JSON or form-encoded bodies (clients differ). */
async function readBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const obj = await req.json();
      if (!obj || typeof obj !== "object") return {};
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, v == null ? "" : typeof v === "string" ? v : JSON.stringify(v)]),
      );
    }
    return Object.fromEntries(new URLSearchParams(await req.text()).entries());
  } catch {
    return {};
  }
}

function isAllowedRedirect(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:") return true;
  // Loopback redirects are how native and CLI clients receive the code.
  if (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) return true;
  // Custom schemes (cursor://, vscode://) are legitimate for desktop clients.
  return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && !["http:", "javascript:", "data:", "file:"].includes(u.protocol);
}

function metadata() {
  const base = `${functionsBase()}/${FN}`;
  return {
    issuer: base,
    authorization_endpoint: `${appUrl()}/mcp/consent`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    revocation_endpoint: `${base}/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    service_documentation: `${appUrl()}/docs`,
  };
}

/*──────────────── client authentication ────────────────*/

interface McpClientRow {
  client_id: string;
  client_secret_hash: string | null;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
}
type ClientAuth = { ok: true; client: McpClientRow } | { ok: false; error: Response };

async function authenticateClient(
  req: Request,
  body: Record<string, string>,
  db: ReturnType<typeof admin>,
): Promise<ClientAuth> {
  let clientId = body.client_id || "";
  let clientSecret = body.client_secret || "";

  const basic = (req.headers.get("Authorization") || "").match(/^Basic\s+(.+)$/i);
  if (basic) {
    try {
      const [id, secret] = atob(basic[1]).split(":");
      clientId = decodeURIComponent(id || "");
      clientSecret = decodeURIComponent(secret || "");
    } catch {
      /* malformed header; fall back to the body values */
    }
  }

  if (!clientId) return { ok: false, error: oauthError("invalid_client", "client_id is required", 401) };
  const { data } = await db.from("mcp_clients").select("*").eq("client_id", clientId).maybeSingle();
  const client = data as McpClientRow | null;
  if (!client) return { ok: false, error: oauthError("invalid_client", "Unknown client", 401) };

  if (client.client_secret_hash) {
    if (!clientSecret) return { ok: false, error: oauthError("invalid_client", "client_secret is required", 401) };
    if (!safeEqual(await sha256Hex(clientSecret), client.client_secret_hash)) {
      return { ok: false, error: oauthError("invalid_client", "Invalid client credentials", 401) };
    }
  }
  return { ok: true, client };
}

/*──────────────── Supabase session minting ────────────────*/

interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Mint a fresh Supabase session for a user, server-side.
 *
 * `generateLink` produces a one-time token without sending any email; verifying
 * it yields a normal session. That keeps the resulting access token a genuine
 * Supabase JWT (`iss` = the project's auth URL, `aud` = "authenticated"), which
 * is exactly what the MCP server validates.
 */
async function mintSessionForUser(db: ReturnType<typeof admin>, userId: string): Promise<SupabaseSession> {
  const { data: userRes, error: userErr } = await db.auth.admin.getUserById(userId);
  if (userErr || !userRes?.user?.email) {
    throw new Error("Could not resolve the user's email to mint a session");
  }

  const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: userRes.user.email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(linkErr?.message || "Could not generate a session token");
  }

  // Verify on an anon client so the response carries a user session rather than
  // the service-role context.
  const anon = createClient(supabaseUrl(), Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyErr || !verified?.session) {
    throw new Error(verifyErr?.message || "Could not establish a session");
  }

  return {
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
    expires_in: verified.session.expires_in ?? 3600,
  };
}

/** Exchange a Supabase refresh token for a new session, straight through GoTrue. */
async function refreshSupabaseSession(refreshToken: string): Promise<SupabaseSession> {
  const resp = await fetch(`${supabaseUrl()}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!resp.ok) throw new Error("Supabase refused the refresh token");
  const body = await resp.json();
  if (!body?.access_token || !body?.refresh_token) throw new Error("Malformed refresh response");
  return { access_token: body.access_token, refresh_token: body.refresh_token, expires_in: body.expires_in ?? 3600 };
}

/*──────────────── handler ────────────────*/

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const path = routePath(req);

  try {
    // ── discovery ──
    if (
      req.method === "GET" &&
      (path === "/.well-known/oauth-authorization-server" ||
        path === "/.well-known/openid-configuration" ||
        path === "/")
    ) {
      return json(metadata());
    }

    // ── authorize: hand off to the in-app consent screen ──
    if (req.method === "GET" && path === "/authorize") {
      const target = new URL(`${appUrl()}/mcp/consent`);
      new URL(req.url).searchParams.forEach((v, k) => target.searchParams.set(k, v));
      return new Response(null, { status: 302, headers: { ...corsHeaders, Location: target.toString() } });
    }

    // ── dynamic client registration ──
    if (req.method === "POST" && path === "/register") {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return oauthError("invalid_client_metadata", "Body must be JSON");
      }
      const redirectUris: unknown = body.redirect_uris;
      if (
        !Array.isArray(redirectUris) ||
        redirectUris.length === 0 ||
        !redirectUris.every((u) => typeof u === "string" && isAllowedRedirect(u))
      ) {
        return oauthError(
          "invalid_redirect_uri",
          "redirect_uris must be a non-empty array of https, loopback http, or custom-scheme URLs",
        );
      }
      const authMethod = typeof body.token_endpoint_auth_method === "string" ? body.token_endpoint_auth_method : "none";
      if (!["none", "client_secret_post", "client_secret_basic"].includes(authMethod)) {
        return oauthError("invalid_client_metadata", "Unsupported token_endpoint_auth_method");
      }
      const grantTypes: string[] =
        Array.isArray(body.grant_types) && body.grant_types.length
          ? body.grant_types.filter((g: unknown) => typeof g === "string")
          : ["authorization_code", "refresh_token"];
      if (grantTypes.some((g) => !["authorization_code", "refresh_token"].includes(g))) {
        return oauthError("invalid_client_metadata", "Only authorization_code and refresh_token are supported");
      }

      const clientName = (typeof body.client_name === "string" && body.client_name.trim().slice(0, 120)) || "MCP client";
      const clientId = `mcp_${randomToken(16)}`;
      const clientSecret = authMethod === "none" ? null : randomToken(32);

      const { error } = await admin().from("mcp_clients").insert({
        client_id: clientId,
        client_secret_hash: clientSecret ? await sha256Hex(clientSecret) : null,
        client_name: clientName,
        client_uri: typeof body.client_uri === "string" ? body.client_uri.slice(0, 500) : null,
        logo_uri: typeof body.logo_uri === "string" ? body.logo_uri.slice(0, 500) : null,
        redirect_uris: redirectUris,
        grant_types: grantTypes,
        token_endpoint_auth_method: authMethod,
      });
      if (error) return oauthError("server_error", "Could not register client", 500);

      return json(
        {
          client_id: clientId,
          ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
          client_id_issued_at: Math.floor(Date.now() / 1000),
          client_name: clientName,
          redirect_uris: redirectUris,
          grant_types: grantTypes,
          response_types: ["code"],
          token_endpoint_auth_method: authMethod,
        },
        201,
      );
    }

    // ── token ──
    if (req.method === "POST" && path === "/token") {
      const body = await readBody(req);
      const db = admin();
      const auth = await authenticateClient(req, body, db);
      if (!auth.ok) return auth.error;
      const client = auth.client;

      if (body.grant_type === "authorization_code") {
        const { code, code_verifier: verifier, redirect_uri: redirectUri } = body;
        if (!code) return oauthError("invalid_request", "code is required");
        if (!verifier) return oauthError("invalid_request", "code_verifier is required (PKCE)");

        const { data: row } = await db
          .from("mcp_auth_codes")
          .select("*")
          .eq("code_hash", await sha256Hex(code))
          .maybeSingle();
        if (!row || row.client_id !== client.client_id) {
          return oauthError("invalid_grant", "Invalid authorization code");
        }
        if (row.used_at) {
          // Replay: revoke everything this client holds for the user (RFC 6749 §4.1.2).
          await db
            .from("mcp_grants")
            .update({ revoked_at: new Date().toISOString() })
            .eq("client_id", client.client_id)
            .eq("user_id", row.user_id)
            .is("revoked_at", null);
          return oauthError("invalid_grant", "Authorization code already used");
        }
        if (new Date(row.expires_at).getTime() < Date.now()) {
          return oauthError("invalid_grant", "Authorization code expired");
        }
        if (redirectUri && redirectUri !== row.redirect_uri) {
          return oauthError("invalid_grant", "redirect_uri mismatch");
        }
        if (!safeEqual(await pkceChallenge(verifier), row.code_challenge)) {
          return oauthError("invalid_grant", "PKCE verification failed");
        }

        await db.from("mcp_auth_codes").update({ used_at: new Date().toISOString() }).eq("code_hash", row.code_hash);

        let session: SupabaseSession;
        try {
          session = await mintSessionForUser(db, row.user_id);
        } catch (e) {
          console.error("session mint failed", e);
          return oauthError("server_error", "Could not issue a session for this user", 500);
        }

        await db.from("mcp_grants").insert({
          client_id: client.client_id,
          user_id: row.user_id,
          refresh_token_hash: await sha256Hex(session.refresh_token),
          last_used_at: new Date().toISOString(),
        });
        db.from("mcp_clients")
          .update({ last_used_at: new Date().toISOString() })
          .eq("client_id", client.client_id)
          .then(() => undefined, () => undefined);

        return json({
          access_token: session.access_token,
          token_type: "Bearer",
          expires_in: session.expires_in,
          refresh_token: session.refresh_token,
        });
      }

      if (body.grant_type === "refresh_token") {
        const refresh = body.refresh_token;
        if (!refresh) return oauthError("invalid_request", "refresh_token is required");

        const hash = await sha256Hex(refresh);
        const { data: grant } = await db
          .from("mcp_grants")
          .select("*")
          .eq("refresh_token_hash", hash)
          .maybeSingle();

        // Refreshing through this endpoint is what makes revocation effective:
        // a revoked grant simply stops being renewable.
        if (!grant || grant.client_id !== client.client_id) {
          return oauthError("invalid_grant", "Unknown refresh token");
        }
        if (grant.revoked_at) {
          return oauthError("invalid_grant", "This connection was revoked");
        }

        let session: SupabaseSession;
        try {
          session = await refreshSupabaseSession(refresh);
        } catch {
          return oauthError("invalid_grant", "Refresh token is no longer valid");
        }

        await db
          .from("mcp_grants")
          .update({
            refresh_token_hash: await sha256Hex(session.refresh_token),
            last_used_at: new Date().toISOString(),
          })
          .eq("id", grant.id);

        return json({
          access_token: session.access_token,
          token_type: "Bearer",
          expires_in: session.expires_in,
          refresh_token: session.refresh_token,
        });
      }

      return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token");
    }

    // ── revoke ──
    if (req.method === "POST" && path === "/revoke") {
      const body = await readBody(req);
      const db = admin();
      const auth = await authenticateClient(req, body, db);
      if (!auth.ok) return auth.error;

      if (body.token) {
        await db
          .from("mcp_grants")
          .update({ revoked_at: new Date().toISOString() })
          .eq("client_id", auth.client.client_id)
          .eq("refresh_token_hash", await sha256Hex(body.token))
          .is("revoked_at", null);
      }
      // RFC 7009: always 200, even for an unknown token.
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    return json({ error: "not_found", error_description: `No route for ${req.method} ${path}` }, 404);
  } catch (e) {
    console.error("mcp-oauth error", e);
    return oauthError("server_error", "An internal error occurred", 500);
  }
});
