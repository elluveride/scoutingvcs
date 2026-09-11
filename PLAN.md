# PLAN.md — outstanding work and deployment steps

Last updated: 2026-09-11. The code for everything below is written, typechecked
(`tsc` and `deno check`), unit-tested and building. What remains needs project
credentials or a human decision, so it is recorded here rather than lost.

## 1. Deploy the MCP agent integration (needs Supabase / Lovable access)

Nothing here could be deployed from this machine: there is no `supabase login`
session or access token available, and the MCP server itself is served by Lovable
hosting from `.lovable/mcp/manifest.json`.

Run these once from a machine logged in to the `aigdnfpfcixaeyxaefmt` project:

```bash
npx supabase db push
npx supabase functions deploy mcp-oauth
npx supabase secrets set APP_URL=https://scoutingvcs.lovable.app
```

If the project deploys through Lovable Cloud instead of the CLI, pushing this
branch lets Lovable pick up `supabase/migrations/*` and `supabase/functions/*` on
its next sync. Set `APP_URL` in the Lovable Cloud secrets panel either way, and
publish so the regenerated `/mcp` manifest goes live with the four new tools.

Post-deploy smoke test:

```bash
curl https://aigdnfpfcixaeyxaefmt.supabase.co/functions/v1/mcp-oauth/.well-known/oauth-authorization-server
curl -i -X POST https://aigdnfpfcixaeyxaefmt.supabase.co/functions/v1/mcp-oauth/register \
  -H 'content-type: application/json' \
  -d '{"client_name":"smoke test","redirect_uris":["http://localhost:9999/cb"]}'
```

Then add `https://scoutingvcs.lovable.app/mcp` in Claude or Cursor, approve the
consent screen, ask the agent to call `record_insight`, and watch the card appear
on `/pit-display` without a refresh.

### Decisions to confirm after the first real connection

- [ ] **The grant is all-or-nothing, not scoped.** The MCP tools query Supabase
      with the scout's own token, so RLS is what actually limits an agent: it can
      do exactly what that scout can do. A "read-only" scope would be a promise
      the database does not enforce, so the consent screen states the real access
      instead. If read-only agents are wanted later, that needs a separate
      restricted role, not a scope string.
- [ ] **How the bridge issues tokens.** `mcp-oauth` mints a genuine Supabase
      session for the approved user via the admin API (`generateLink` then
      `verifyOtp`, which sends no email). That keeps the access token a real
      Supabase JWT, which is what the MCP server's configured issuer validates.
      Worth a look from whoever owns the Supabase project before it goes live.
- [ ] **Revocation is refresh-time, not instant.** Disconnecting an agent flips
      `revoked_at`, and the bridge refuses the next refresh. An access token
      already in flight keeps working until it expires, up to an hour. Instant
      revocation would mean killing the user's Supabase sessions, which would
      also sign them out of the web app.
- [ ] The OAuth metadata advertises the bridge as the issuer while the JWT's own
      `iss` is Supabase. Clients do not inspect the token, and the server checks
      `iss` against Supabase, so both ends agree; note it if a strict client ever
      objects.

## 2. Weekly match cleanup — confirm the policy before the first Wednesday

`supabase/migrations/20260911120000_weekly_match_cleanup.sql` schedules
`weekly-match-cleanup` for **Wednesdays 09:00 UTC** (04:00 EST / 05:00 EDT). It
moves every `match_entries` row created in the previous Mon–Sun UTC week into
`match_entries_archive`, logs the run in `maintenance_log`, and hard-deletes
nothing.

- [ ] Decide whether "last week's matches" should key off the event's `date_end`
      (from `ftc_events_cache`) rather than `created_at`. `created_at` was chosen
      because a QR import on Monday night carries the import time, so Saturday's
      data still survives until the *next* Wednesday.
- [ ] Preview the next run: `select cleanup_last_week_matches(true);` (dry run,
      admin only). Undo one: `select restore_archived_matches('USAZCMP');`
- [ ] Optional: surface `maintenance_log` and a restore button in Admin.
- [ ] Three jobs now share the Wednesday window: the match cleanup at :00, the
      MCP code purge at :45, and the agent-insight purge at :30. If pg_cron is
      ever disabled, all three silently skip; check `select * from cron.job;`.

## 3. Pit scouting follow-ups (nice-to-have, not blockers)

- [ ] iPhones may hand the browser a HEIC file. `compressImage` re-encodes
      anything the browser can decode, but on Chrome for iOS that may fail, so
      those users should use "Take photo", which yields JPEG. Consider a
      server-side HEIC convert if it bites.
- [ ] Queued offline photos live in IndexedDB until sync. Each is capped at
      1600 px and roughly 300 KB, but a device with a tiny storage quota could
      still reject a large backlog.
- [ ] `pit_entries.scores_depot` exists in the database but is not in the season
      config's capability list, so it always saves as `false`. Add
      `{ key: 'scores_depot', label: 'Scores Depot' }` to `src/seasons/decode.ts`
      if the strategy team wants it collected.

## 4. Alliance theme — scope decision

The red/blue swap is applied to Match Scout and Pit Scout through the
`.alliance-swap` CSS scope in `src/index.css`, using the VCS brand tokens. The
alliance position picker in Match Scout deliberately keeps true field colors via
`.alliance-true`, so a scout never taps the wrong alliance because the theme
recolored it.

- [ ] Decide whether the swap should extend to Dashboard and Pit Display. Those
      pages show both alliances at once, where swapping would be actively
      confusing, so they were left alone. To opt a page in, wrap its content in
      `<div className="alliance-swap">`.
- [ ] `roadmap.md` still lists "Finish VCS brand pass on authenticated app
      screens (no leftover red)". That pass is not part of this work; the
      alliance red here is FTC field red, which is intentional.

## 5. Pre-existing lint debt (not from this work)

`npm run lint` reports roughly 45 `@typescript-eslint/no-explicit-any` errors and
`react-hooks/exhaustive-deps` warnings across Dashboard, Spreadsheet, Admin,
QRTransfer and others. Every new and touched file is lint-clean, and PitDisplay's
conditional-hook bug was fixed along the way.
