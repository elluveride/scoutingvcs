-- ─────────────────────────────────────────────────────────────────────────────
-- MCP OAuth bridge
--
-- The MCP server (`src/lib/mcp`) validates Supabase-issued JWTs: its configured
-- issuer is `https://<ref>.supabase.co/auth/v1` with audience `authenticated`.
-- Supabase Auth mints those tokens but does not implement the two things an MCP
-- client needs to get one on its own:
--
--   * RFC 7591 dynamic client registration, and
--   * an authorization endpoint a third-party client may drive.
--
-- The `mcp-oauth` edge function supplies both and hands back a real Supabase
-- session, so the token the client ends up with is one the MCP server already
-- trusts. These tables are its storage.
--
--   mcp_clients     registered MCP clients
--   mcp_auth_codes  single-use PKCE authorization codes, minted by the consent
--                   page as the signed-in user
--   mcp_grants      one row per live connection; revoking flips `revoked_at`,
--                   which blocks the next refresh
--
-- Secrets are only ever stored as SHA-256 hashes.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── clients ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mcp_clients (
  client_id                  text        PRIMARY KEY,
  client_secret_hash         text,  -- NULL = public client (PKCE only)
  client_name                text        NOT NULL,
  client_uri                 text,
  logo_uri                   text,
  redirect_uris              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  grant_types                jsonb       NOT NULL DEFAULT '["authorization_code","refresh_token"]'::jsonb,
  token_endpoint_auth_method text        NOT NULL DEFAULT 'none',
  created_at                 timestamptz NOT NULL DEFAULT now(),
  last_used_at               timestamptz
);
ALTER TABLE public.mcp_clients ENABLE ROW LEVEL SECURITY;
-- No user-facing policies: the app reads clients through mcp_get_client() only.

-- ── authorization codes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mcp_auth_codes (
  code_hash             text        PRIMARY KEY,
  client_id             text        NOT NULL REFERENCES public.mcp_clients (client_id) ON DELETE CASCADE,
  user_id               uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  redirect_uri          text        NOT NULL,
  code_challenge        text        NOT NULL,
  code_challenge_method text        NOT NULL DEFAULT 'S256',
  resource              text,
  expires_at            timestamptz NOT NULL,
  used_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mcp_auth_codes_expires ON public.mcp_auth_codes (expires_at);
ALTER TABLE public.mcp_auth_codes ENABLE ROW LEVEL SECURITY;

-- ── grants (live connections) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mcp_grants (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          text        NOT NULL REFERENCES public.mcp_clients (client_id) ON DELETE CASCADE,
  user_id            uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  refresh_token_hash text        UNIQUE,
  revoked_at         timestamptz,
  last_used_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mcp_grants_user ON public.mcp_grants (user_id, created_at DESC);
ALTER TABLE public.mcp_grants ENABLE ROW LEVEL SECURITY;

-- ── RPCs used by the consent page and the profile screen ────────────────────

-- Public details of a client, for the consent screen.
CREATE OR REPLACE FUNCTION public.mcp_get_client(_client_id text)
RETURNS TABLE (client_id text, client_name text, client_uri text, logo_uri text, redirect_uris jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.client_id, c.client_name, c.client_uri, c.logo_uri, c.redirect_uris
  FROM public.mcp_clients c
  WHERE c.client_id = _client_id
    AND auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.mcp_get_client(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mcp_get_client(text) TO authenticated;

-- Mint an authorization code for the signed-in, approved user. Returns the raw
-- code; only its SHA-256 hash is stored. Single use, expires in 5 minutes.
CREATE OR REPLACE FUNCTION public.mcp_create_auth_code(
  _client_id             text,
  _redirect_uri          text,
  _code_challenge        text,
  _code_challenge_method text DEFAULT 'S256',
  _resource              text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_code   text;
  v_client public.mcp_clients%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_user AND p.status = 'approved') THEN
    RAISE EXCEPTION 'Your account must be approved before connecting an agent';
  END IF;

  SELECT * INTO v_client FROM public.mcp_clients WHERE client_id = _client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown client';
  END IF;
  IF NOT (v_client.redirect_uris ? _redirect_uri) THEN
    RAISE EXCEPTION 'redirect_uri is not registered for this client';
  END IF;
  IF _code_challenge IS NULL OR length(_code_challenge) < 43 OR _code_challenge_method <> 'S256' THEN
    RAISE EXCEPTION 'PKCE (S256) is required';
  END IF;

  v_code := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.mcp_auth_codes
    (code_hash, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, resource, expires_at)
  VALUES
    (encode(extensions.digest(v_code, 'sha256'), 'hex'), _client_id, v_user, _redirect_uri,
     _code_challenge, 'S256', _resource, now() + interval '5 minutes');

  RETURN v_code;
END;
$$;
REVOKE ALL ON FUNCTION public.mcp_create_auth_code(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mcp_create_auth_code(text, text, text, text, text) TO authenticated;

-- The caller's live agent connections, for Profile → Connected Agents.
CREATE OR REPLACE FUNCTION public.mcp_list_my_connections()
RETURNS TABLE (
  id uuid, client_id text, client_name text,
  created_at timestamptz, last_used_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.client_id, c.client_name, g.created_at, g.last_used_at
  FROM public.mcp_grants g
  JOIN public.mcp_clients c ON c.client_id = g.client_id
  WHERE g.user_id = auth.uid()
    AND g.revoked_at IS NULL
  ORDER BY g.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.mcp_list_my_connections() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mcp_list_my_connections() TO authenticated;

-- Revoke one connection, or every connection for a client, for the caller only.
-- The agent's access token keeps working until it expires (at most an hour);
-- the refresh that would extend it is refused.
CREATE OR REPLACE FUNCTION public.mcp_revoke_connection(_grant_id uuid DEFAULT NULL, _client_id text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  UPDATE public.mcp_grants
  SET revoked_at = now()
  WHERE user_id = auth.uid()
    AND revoked_at IS NULL
    AND ((_grant_id IS NOT NULL AND id = _grant_id) OR (_client_id IS NOT NULL AND client_id = _client_id));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.mcp_revoke_connection(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mcp_revoke_connection(uuid, text) TO authenticated;

-- ── housekeeping ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_expired_mcp_codes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_codes integer; v_grants integer;
BEGIN
  DELETE FROM public.mcp_auth_codes WHERE expires_at < now() - interval '1 day';
  GET DIAGNOSTICS v_codes = ROW_COUNT;
  DELETE FROM public.mcp_grants WHERE revoked_at IS NOT NULL AND revoked_at < now() - interval '30 days';
  GET DIAGNOSTICS v_grants = ROW_COUNT;
  INSERT INTO public.maintenance_log (job, rows_affected, details)
  VALUES ('mcp-code-purge', v_codes + v_grants, jsonb_build_object('codes', v_codes, 'grants', v_grants));
  RETURN v_codes + v_grants;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_expired_mcp_codes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_mcp_codes() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-mcp-code-purge') THEN
      PERFORM cron.unschedule('weekly-mcp-code-purge');
    END IF;
    PERFORM cron.schedule('weekly-mcp-code-purge', '45 9 * * 3', $job$ SELECT public.cleanup_expired_mcp_codes(); $job$);
  END IF;
END $$;
