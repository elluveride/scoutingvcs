
# Improvements to Make DECODE Perfect for Competition Use

After thoroughly reviewing every page, component, hook, and backend configuration, here are the highest-impact improvements organized by priority. These are focused on real competition-day usability, team coordination, and data reliability.

---

## 1. Match Scouting Notes / Comments Field
**Why:** Scouters frequently observe things that don't fit neatly into numeric fields -- "robot disconnected for 30 seconds", "alliance partner blocked them", "gripper broke mid-match". Right now there's no way to capture qualitative observations.

**What:** Add an optional free-text "Notes" field at the bottom of the Match Scout form. Display it in the Spreadsheet as a tooltip or expandable row, and show it on the Team Detail page.

---

## 2. Scouter Assignment Persistence
**Why:** Currently, scouter assignments are generated in-memory and disappear on page refresh. At a competition, the drive team lead generates assignments at the start of the day, but if any scouter refreshes or their phone restarts, their assignments vanish.

**What:** Save generated assignments to a new `scouter_assignments` database table so they persist across sessions. All team members can then always see their up-to-date assignments.

---

## 3. Spreadsheet Filtering and Sorting
**Why:** As data grows (100+ entries at a large event), the spreadsheet becomes hard to navigate. There's no way to filter by team, match range, or scouter, or to sort columns.

**What:** Add a filter bar above the spreadsheet with:
- Team number filter
- Match number range filter
- Scouter filter (dropdown)
- Clickable column headers for sorting (ascending/descending)

---

## 4. Team Comparison Tool
**Why:** During alliance selection, teams need to quickly compare 2-3 candidates side by side. Currently you have to navigate between individual Team Detail pages and remember the stats.

**What:** Add a "Compare Teams" feature (accessible from the Dashboard or as a new sub-section) that lets you select 2-3 teams and see their stats, charts, and radar profiles side by side in a single view.

---

## 5. Match-by-Match Notes on Team Detail
**Why:** The Team Detail page shows great charts but no per-match context. When reviewing a team before alliance selection, you want to understand *why* their Match 5 score dropped (e.g., "robot tipped over").

**What:** Below the charts on Team Detail, add a match log table showing each match's raw stats plus the notes field from improvement #1. This gives full context when evaluating a team.

---

## 6. Admin Event Code Validation
**Why:** As you saw with the `USMTMI2` error, creating events with invalid FTC codes causes confusing API errors throughout the app (match schedule, rankings, live stats all fail).

**What:** When an admin creates a new event, call the FTC API to verify the event code exists before saving. Show a clear warning if the code isn't found, but still allow creation (some events might not be in the API yet).

---

## 7. Graceful FTC API Error Handling
**Why:** When the FTC API returns errors (invalid event, API down, rate limited), the app currently shows disruptive toast errors on every page that calls the API. This is noisy and confusing for scouters.

**What:** Replace toast errors with inline, non-blocking warning banners. Show the error once where relevant (e.g., in the Match Info section) rather than popping up toasts that stack.

---

## 8. Dark Mode / Light Mode Toggle
**Why:** Competition venues vary wildly in lighting. The current dark-only theme works great in dim pit areas but can be hard to read in brightly-lit gymnasiums, especially on phones with lower-brightness screens.

**What:** Add a theme toggle (dark/light) in Profile Settings using the existing `next-themes` dependency (already installed). The dark industrial theme stays the default, but a clean light mode gives flexibility.

---

## Technical Details

| Improvement | Files Changed | Database Changes | Complexity |
|---|---|---|---|
| 1. Notes field | MatchScout, Spreadsheet, TeamDetail, offlineDb types | Add `notes` column to `match_entries` | Low |
| 2. Assignment persistence | ScouterAssignments page | New `scouter_assignments` table with RLS | Medium |
| 3. Spreadsheet filters | Spreadsheet page only | None | Low |
| 4. Team comparison | New component, Dashboard link | None | Medium |
| 5. Match log on Team Detail | TeamDetail page | None (uses notes from #1) | Low |
| 6. Event code validation | EventSelect page, edge function | None | Low |
| 7. Graceful API errors | useFTCMatches, useFTCRankings hooks | None | Low |
| 8. Light mode | index.css, ProfileSettings, next-themes setup | None | Medium |

### Recommended Build Order
1. Notes field (foundational -- other features reference it)
2. Graceful API error handling (quick win, big UX improvement)
3. Spreadsheet filters (quick win for competition day)
4. Assignment persistence (critical for team coordination)
5. Event code validation (prevents confusion)
6. Match log on Team Detail (leverages notes field)
7. Team comparison tool (high strategy value)
8. Light mode toggle (nice to have)

Each improvement is independent enough to be built and tested one at a time.
