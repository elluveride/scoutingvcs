# Roadmap

- [x] APEX SCOUT wordmark logo (PMS 293 blue), replace favicon + splash/PWA icons
- [x] PitDisplay: use real FTC rankings instead of "last scored + 1" fallback
- [x] Agent integrations (MCP server) with Supabase OAuth — `mcp-oauth` deployed,
      `/mcp/consent` wired, tables live. Publish to refresh the `/mcp` manifest.
- [x] Weekly Wednesday housekeeping scheduled (match archive 09:00 UTC,
      agent-insight purge 09:30, MCP code purge 09:45)
- [x] Pit Scout collects "Scores Depot"
- [ ] Finish VCS brand pass on authenticated app screens + dashboard (no leftover red)
- [ ] Next-season config + match_entries field change — blocked: the 2026-27 game's
      scoring actions are not defined anywhere in this repo yet. Add
      `src/seasons/<game>.ts` and point `CURRENT_SEASON` at it once known, then
      archive the DECODE entries before changing `match_entries`.
