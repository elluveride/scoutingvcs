

# DECODE Scouting — Native Mobile App MVP Specification

This document specifies a native mobile app (React Native / Expo or Flutter) that connects to the **same Supabase backend** as the existing web app at `scoutingvcs.lovable.app`. Both apps share authentication, database, storage, and edge functions.

---

## 1. Backend Connection Details

### Supabase Project
- **URL:** `https://aigdnfpfcixaeyxaefmt.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZ2RuZnBmY2l4YWV5eGFlZm10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5ODgyOTAsImV4cCI6MjA4NTU2NDI5MH0.x2XJUFIvdqcXZ0no-zFBs5tLQg4ATK8tuNisw7D3QFw`
- **Auth:** Supabase Auth (email/password + Google OAuth + Apple OAuth)
- Use the Supabase client SDK for your platform (`@supabase/supabase-js` for React Native, `supabase_flutter` for Flutter)

### Edge Functions (invoke via Supabase SDK `functions.invoke()`)
All require `Authorization: Bearer <session_jwt>` header (SDK handles this automatically).

| Function | Method | Body | Returns |
|---|---|---|---|
| `ftc-rankings` | POST | `{ eventCode: string, includeScores?: boolean }` | `{ rankings: TeamRanking[], matchScores?: MatchScore[], season, eventCode }` |
| `ftc-matches` | POST | `{ eventCode: string, matchType: "Q" \| "P" }` | `{ matches: { matchNumber, positions: { teamNumber, position, surrogate }[] }[] }` |
| `ftc-events-sync` | POST | `{}` (admin only) | `{ season, totalCached, activeToday, autoCreated, ... }` |

---

## 2. Database Schema (All Tables — Exact Column Names)

### `profiles`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | uuid PK | — | Matches `auth.users.id` |
| `name` | text NOT NULL | — | Display name |
| `role` | enum `app_role` (`admin`, `scout`) | `'scout'` | Legacy column, **actual** admin check uses `user_roles` table |
| `status` | enum `user_status` (`pending`, `approved`, `rejected`) | `'pending'` | Must be `approved` to submit data |
| `team_number` | integer | NULL | FTC team number (1–99999) |
| `event_code` | text | NULL | Currently unused in web app |
| `team_number_changed_at` | timestamptz | NULL | — |
| `created_at` | timestamptz | `now()` | — |
| `updated_at` | timestamptz | `now()` | — |

**RLS:** Users can see own profile + profiles with same `team_number` + allied teams (12841↔2844). Admins see all.

### `user_roles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `user_id` | uuid NOT NULL | FK to `auth.users(id)` |
| `role` | enum `app_role` | `admin` or `scout` |

**Admin check:** Use RPC `is_admin(user_id)` or query this table. **Never trust the `profiles.role` column alone** — `user_roles` is authoritative.

### `events`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | uuid PK | auto-generated | — |
| `code` | text NOT NULL | — | FTC event code (e.g., `USMIACMP`) |
| `name` | text NOT NULL | — | Human-readable name |
| `archived` | boolean | `false` | Hidden from selection when true |
| `created_by` | uuid | NULL | — |
| `created_at` | timestamptz | `now()` | — |

**RLS:** Authenticated users can see non-archived events. Admins see all + CRUD.

### `ftc_events_cache`
| Column | Type | Notes |
|---|---|---|
| `code` | text PK | FTC event code |
| `name` | text | — |
| `date_start` | date | — |
| `date_end` | date | — |
| `season` | integer | e.g. 2025 |
| `team_numbers` | jsonb | Array of team numbers registered, e.g. `[12841, 2844]` |
| `city`, `state_prov`, `country` | text (nullable) | — |
| `last_synced` | timestamptz | — |

**RLS:** Read-only for authenticated users. Written by edge function with service role.

### `match_entries`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | uuid PK | auto-generated | — |
| `event_code` | text NOT NULL | — | — |
| `team_number` | integer NOT NULL | — | Team being scouted |
| `match_number` | integer NOT NULL | — | — |
| `scouter_id` | uuid NOT NULL | — | The user who scouted |
| `auto_scored_close` | integer | 0 | — |
| `auto_scored_far` | integer | 0 | — |
| `auto_fouls_minor` | integer | 0 | Used as "total fouls" |
| `auto_fouls_major` | integer | 0 | Always 0 in current UI |
| `on_launch_line` | boolean | false | — |
| `teleop_scored_close` | integer | 0 | — |
| `teleop_scored_far` | integer | 0 | — |
| `teleop_depot` | integer | 0 | Currently unused |
| `defense_rating` | integer | 0 | 0–3 scale |
| `endgame_return` | enum `endgame_return_status` | `'not_returned'` | Values: `not_returned`, `partial`, `full`, `lift` |
| `penalty_status` | enum `penalty_status` | `'none'` | Values: `none`, `dead`, `yellow_card`, `red_card` |
| `auto_pattern_matches` | integer | 0 | Unused |
| `teleop_pattern_matches` | integer | 0 | Unused |
| `motif` | text | `'PPG'` | Unused |
| `notes` | text | `''` | Free text, max 500 chars |
| `created_at` | timestamptz | `now()` | — |

**Unique constraint:** `(event_code, team_number, match_number, scouter_id)` — used for upsert.

**RLS (SELECT):** Admins + privileged teams (12841, 2844) see all. Others see only entries where `scouter_id` belongs to same team or allied team.

**RLS (INSERT):** User must have `status = 'approved'` in profiles.

### `pit_entries`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | uuid PK | auto-generated | — |
| `event_code` | text NOT NULL | — | — |
| `team_number` | integer NOT NULL | — | Team being scouted |
| `team_name` | text NOT NULL | — | — |
| `drive_type` | enum `drive_type` | `'tank'` | Values: `tank`, `mecanum`, `swerve`, `other` |
| `scores_motifs` | boolean | false | — |
| `scores_artifacts` | boolean | false | — |
| `scores_depot` | boolean | false | — |
| `has_autonomous` | boolean | false | — |
| `auto_consistency` | enum `consistency_level` | `'low'` | Values: `low`, `medium`, `high` |
| `reliable_auto_leave` | enum `auto_leave_status` | `'no'` | Values: `yes`, `sometimes`, `no` |
| `preferred_start` | text | `'close'` | `close` or `far` |
| `endgame_consistency` | enum `consistency_level` | `'low'` | — |
| `auto_paths` | jsonb | `'[]'` | Array of drawn path objects (see below) |
| `robot_photo_url` | text | NULL | Storage path in `robot-photos` bucket |
| `last_edited_by` | uuid | NULL | — |
| `last_edited_at` | timestamptz | `now()` | — |

**Unique constraint:** `(event_code, team_number)` — used for upsert.

**RLS:** Same team-scoped visibility as `match_entries`.

### `auto_paths` JSON structure
```json
[
  {
    "id": "uuid-string",
    "side": "red" | "blue",
    "label": "Path Name",
    "points": [{ "x": 0.0, "y": 0.0 }, ...],
    "markers": [{ "x": 0.0, "y": 0.0, "type": "motif" | "artifact" | "park" }, ...]
  }
]
```
Points are normalized 0–1 coordinates on a field image.

### `dashboard_configs`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | uuid PK | auto-generated | — |
| `team_number` | integer NOT NULL | — | — |
| `event_code` | text NOT NULL | — | — |
| `config_index` | integer | 0 | 0 or 1 (two ranking lists) |
| `list_name` | text | `'List'` | — |
| `weights` | jsonb | `'[]'` | Array of `SortWeight` objects |
| `updated_by` | uuid | NULL | — |
| `updated_at` | timestamptz | `now()` | — |

**Unique constraint:** `(team_number, event_code, config_index)`

### `SortWeight` JSON structure
```json
{ "id": "autoClose", "label": "Auto Close", "weight": 3, "enabled": true }
```
Valid weight IDs: `autoClose`, `autoFar`, `autoTotal`, `launchLine`, `teleopClose`, `teleopFar`, `defense`, `lift`, `fullReturn`, `fouls`, `penalties`, `variance`, `apiRank`, `apiQualAvg`, `apiWinRate`

### `scouter_assignments`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `event_code` | text NOT NULL | — |
| `match_number` | integer NOT NULL | — |
| `team_number` | integer NOT NULL | Team the scouter will observe |
| `position` | text NOT NULL | e.g. `"B1"`, `"R2"` |
| `scouter_id` | uuid NOT NULL | Assigned user |
| `created_by` | uuid NOT NULL | Admin who created it |
| `created_at` | timestamptz | — |

### `bug_reports`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `user_id` | uuid NOT NULL | Reporter |
| `page_url` | text NOT NULL | Screen/page identifier |
| `description` | text NOT NULL | — |
| `status` | text | `'open'` or `'resolved'` |
| `resolved_by`, `resolved_at` | uuid/timestamptz | — |
| `created_at` | timestamptz | — |

### `team_change_requests`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `user_id` | uuid NOT NULL | — |
| `current_team_number` | integer NOT NULL | — |
| `requested_team_number` | integer NOT NULL | — |
| `reason` | text NOT NULL | — |
| `status` | text | `'pending'`, `'approved'`, `'rejected'` |
| `reviewed_by`, `reviewed_at` | uuid/timestamptz | — |
| `created_at` | timestamptz | — |

---

## 3. Database RPC Functions (call via `supabase.rpc()`)

| Function | Args | Returns | Notes |
|---|---|---|---|
| `create_profile_for_signup` | `_user_id: uuid, _name: text, _team_number: integer` | void | SECURITY DEFINER. Call immediately after `auth.signUp()` |
| `is_admin` | `_user_id: uuid` | boolean | — |
| `has_role` | `_user_id: uuid, _role: app_role` | boolean | — |
| `is_privileged_team` | `_user_id: uuid` | boolean | True if team 12841 or 2844 |
| `is_allied_team` | `team_a: integer, team_b: integer` | boolean | True if 12841↔2844 |
| `get_my_team_number` | — | integer | Returns calling user's team_number |

---

## 4. Storage

### Bucket: `robot-photos` (private)
- Path format: `{team_number}/{event_code}_{team_number}.{ext}`
- Access: Use `supabase.storage.from('robot-photos').createSignedUrl(path, 3600)` for 1-hour URLs
- Upload: `supabase.storage.from('robot-photos').upload(path, file, { upsert: true })`

---

## 5. Authentication Flow

### Signup
1. Call `supabase.auth.signUp({ email, password, options: { data: { name } } })`
2. Immediately call `supabase.rpc('create_profile_for_signup', { _user_id: user.id, _name: name, _team_number: teamNumber })`
3. User receives email verification link
4. After verification + login, profile `status` will be `'pending'`
5. Admin must approve the user (set `status = 'approved'`) before they can submit data

### Login
- `supabase.auth.signInWithPassword({ email, password })`

### OAuth (Google/Apple)
- The web app uses `lovable.auth.signInWithOAuth()` which is web-specific. For native apps, use the Supabase SDK's native OAuth flow (`supabase.auth.signInWithOAuth({ provider: 'google' })`) with deep linking.
- After OAuth login, if no profile exists, redirect to a "Complete Profile" screen to collect `name` and `team_number`, then insert into `profiles`.

### Password Reset
1. `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'your-app-deep-link://reset-password' })`
2. Handle the deep link, extract `access_token` and `refresh_token`
3. Call `supabase.auth.updateUser({ password: newPassword })`

### Session State
- Listen to `supabase.auth.onAuthStateChange()` for session changes
- Fetch profile on each auth state change: `supabase.from('profiles').select('*').eq('id', user.id).single()`
- Check admin status: profile.role === 'admin' OR query user_roles table

### First User Auto-Approval
- The first user to sign up is automatically set to `status: 'approved'` and `role: 'admin'` by a database trigger (`auto_approve_first_user`). This also inserts into `user_roles`.

---

## 6. Screens & Features

### 6.1 Auth Screen
- Email/password login + signup forms
- Signup requires: email, password (min 8 chars), name, team number (1–99999)
- Google and Apple OAuth buttons
- "Forgot Password" flow
- After signup: show "Check your email for verification" message

### 6.2 Complete Profile (OAuth only)
- Shown if user is authenticated but has no profile row
- Collects: name, team number
- Calls `create_profile_for_signup` RPC

### 6.3 Approval Gate
- If `profile.status !== 'approved'`, show a "Your account is pending approval" message on all protected screens
- If `status === 'rejected'`, show "Your account was rejected"

### 6.4 Event Selection
- Query: `supabase.from('events').select('*').eq('archived', false).order('created_at', { ascending: false })`
- Query `ftc_events_cache` to show team badges: events where `team_numbers` jsonb array contains user's team number should be prioritized
- Admin can create new events (code + name validated against FTC API via cache)
- Persist selected event locally (equivalent to `localStorage` in web)
- Listen for realtime changes: `supabase.channel('events_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, callback)`

### 6.5 Match Scout
**The primary scouting form.** Fields:

- **Match Info:**
  - Match type toggle: Qual (Q) / Playoff (P)
  - Match number (integer input)
  - Position selector from FTC schedule (call `ftc-matches` edge function)
  - Team number (auto-filled from position or manual entry)

- **Autonomous section:**
  - `auto_scored_close`: integer stepper (0+)
  - `auto_scored_far`: integer stepper (0+)
  - `on_launch_line`: boolean toggle (default true)

- **TeleOp section:**
  - `teleop_scored_close`: integer stepper (0+)
  - `teleop_scored_far`: integer stepper (0+)
  - `defense_rating`: 4-option selector (0=None, 1=Partial, 2=Bad, 3=Good)

- **Endgame section:**
  - `endgame_return`: 4-option selector (`not_returned`, `partial`, `full`, `lift`)
  - `penalty_status`: 4-option selector (`none`, `dead`, `yellow_card`, `red_card`)

- **Fouls:** integer stepper for `auto_fouls_minor`

- **Notes:** textarea, max 500 chars

- **Submit:** Upsert to `match_entries` with `onConflict: 'event_code,team_number,match_number,scouter_id'`

**Offline behavior:**
- If offline, queue entry to local storage (SQLite/equivalent of IndexedDB)
- Show "Save Offline" button text
- Auto-sync when back online (upsert each queued entry)

**Edit mode (admin only):** Load existing entry by ID, update in place.

### 6.6 Pit Scout
**Robot capabilities form per team.**

- Team number input + "Load" button to fetch existing data
- Team name (auto-filled from FTC API rankings or editable)
- Drive type: `tank`, `mecanum`, `swerve`, `other`
- Boolean toggles: `scores_motifs`, `scores_artifacts`, `scores_depot`, `has_autonomous`
- `auto_consistency`: `low`, `medium`, `high`
- `reliable_auto_leave`: `yes`, `sometimes`, `no`
- `preferred_start`: `close` or `far`
- `endgame_consistency`: `low`, `medium`, `high`
- Robot photo: camera capture or gallery upload → `robot-photos` storage bucket
- Auto paths: drawable field map (canvas where user draws paths on a field image, stores as JSON points)
- Upsert on `(event_code, team_number)`

### 6.7 Dashboard (Team Rankings)
- Fetches all `match_entries` for current event
- **Team-scoped filtering:** Only show entries where `scouter_id` belongs to user's own team (or allied team 12841↔2844). To implement:
  1. Fetch all entries for event
  2. Get distinct `scouter_id` values
  3. Fetch profiles for those IDs to get `team_number`
  4. Filter entries where scouter's team = my team OR allied team
- **"All Teams" toggle:** Switch to include all entries regardless of scouter team
- **Deduplication:** Group by `(team_number, match_number)`, keep only the most recent entry per group (by `created_at`)
- **Stats calculation per team:**
  - `avgAutoClose`, `avgAutoFar`, `autoTotalAvg` (sum of close+far)
  - `avgTeleopClose`, `avgTeleopFar`, `teleopTotalAvg`
  - `avgFoulsMinor`, `avgFoulsMajor`
  - `onLaunchLinePercent` (% of matches)
  - `avgDefense`
  - `liftPercent`, `fullReturnPercent`, `partialReturnPercent`
  - `penaltyRate` (% of matches with non-`none` penalty)
  - `varianceScore` (std dev of auto total)
- **Weighted scoring:** Two configurable ranking lists. Each weight has `id`, `label`, `weight` (float), `enabled` (bool). Score formula per weight ID:

```
autoClose:    avgAutoClose * weight
autoFar:      avgAutoFar * weight
autoTotal:    autoTotalAvg * weight
launchLine:   (onLaunchLinePercent / 100) * weight * 10
teleopClose:  avgTeleopClose * weight
teleopFar:    avgTeleopFar * weight
defense:      avgDefense * weight * 10
lift:         (liftPercent / 100) * weight * 10
fullReturn:   (fullReturnPercent / 100) * weight * 10
fouls:        avgFoulsMinor * weight  (typically negative)
penalties:    (penaltyRate / 100) * weight * 10  (typically negative)
variance:     varianceScore * weight  (typically negative)
apiRank:      ((totalTeams - rank + 1) / totalTeams) * weight * 10
apiQualAvg:   (qualAverage / 100) * weight * 10
apiWinRate:   (winRate / 100) * weight * 10
```

- Admin can edit weights (sliders -10 to +10, toggle enable/disable) and rename lists
- Configs auto-save to `dashboard_configs` table (debounced 1.5s)
- Non-admins see read-only configs set by their team's admin
- Display: ranked list of team cards showing team number, name, score, matches played

### 6.8 Team Detail
- Navigate from dashboard → tap team card
- Query param: `?team={teamNumber}`
- Loads `match_entries` for that team at current event (same team-scoped filtering + deduplication as dashboard)
- Loads `pit_entries` for auto paths
- **Stats display:** Same calculated stats as dashboard but for single team
- **Charts (use native charting library):**
  - Line chart: auto + teleop scoring trends across matches
  - Bar chart: per-match breakdown
  - Radar chart: normalized capabilities
- **Match log table:** All match entries with expandable rows showing details + notes
- **Auto paths viewer:** Render drawn paths on field image

### 6.9 Team Compare
- Multi-select teams (up to 6)
- Side-by-side stat comparison table
- Radar chart overlay
- Uses same team-scoped filtering

### 6.10 Spreadsheet View
- Tabular view of all match entries
- Columns: Match #, Team #, Team Name, Auto Close, Auto Far, TeleOp Close, TeleOp Far, Defense, Endgame, Penalty, Fouls, Notes
- Sortable + filterable by team, match, scouter
- Team name from FTC API rankings data

### 6.11 Live Stats
- Official FTC rankings from `ftc-rankings` edge function
- Shows: rank, team number, team name, W/L/T, qual average, ranking points
- Pull-to-refresh

### 6.12 Match Planner
- Uses FTC match schedule from `ftc-matches` edge function
- Lets user enter 4 alliance team numbers
- Shows upcoming match breakdown with team stats from scouting data
- Alliance vs opponent comparison

### 6.13 Scouter Assignments (Admin only)
- Fetch team scouters: `profiles` where `team_number = my_team AND status = 'approved'`
- Fetch FTC match schedule
- Auto-assign or manually assign scouters to matches/positions
- Save to `scouter_assignments` table
- Non-admin scouters see their assignments as read-only

### 6.14 QR Transfer
**Critical for offline-first events.**

- **Send mode:** Generate QR codes from local match entries
  - Compact format: `{ d: [{ t: teamNum, m: matchNum, ac, af, tc, tf, ll, dr, er, ps, f }, ...] }`
  - Chunk to max ~1800 bytes per QR code
  - Show QR codes sequentially with "Next" button

- **Receive mode:** Scan QR codes using device camera
  - Parse JSON, validate with Zod schema:
    ```
    CompactEntrySchema = { t: int, m: int, ac: int, af: int, tc: int, tf: int, ll: bool, dr: int, er: string, ps: string, f: int }
    QRPayloadSchema = { d: CompactEntry[] }
    ```
  - **Duplicate detection:** Before import, check if `(event_code, team_number, match_number)` already exists in cloud
  - Flag duplicates with "DUP" badge, skip on import
  - Import: upsert to `match_entries` with `scouter_id = current_user.id`

### 6.15 Admin Panel
- **User management:** List all profiles, approve/reject pending users, toggle admin role (insert/delete `user_roles`)
- **Team change requests:** Review pending requests, approve (update profile's `team_number`) or reject
- **Bug reports:** View all, mark as resolved, delete
- **Event sync:** Trigger `ftc-events-sync` edge function

### 6.16 Profile Settings
- View/edit name
- Request team number change (inserts into `team_change_requests`)
- Alliance color toggle (blue/red) — persisted locally, affects UI theming
- Sign out

### 6.17 Bug Report
- Floating button on all screens
- Submits: `page_url` (current screen name), `description`, `user_id`

---

## 7. Offline Sync Strategy

### Local Database (SQLite or equivalent)
Mirror the IndexedDB structure from the web app:

**Table: `matchQueue`**
| Column | Type |
|---|---|
| `localId` | text PK (timestamp + random) |
| `event_code` | text |
| `team_number` | integer |
| `match_number` | integer |
| `scouter_id` | text (uuid) |
| `auto_scored_close` | integer |
| `auto_scored_far` | integer |
| `auto_fouls_minor` | integer |
| `auto_fouls_major` | integer |
| `on_launch_line` | integer (0/1) |
| `teleop_scored_close` | integer |
| `teleop_scored_far` | integer |
| `defense_rating` | integer |
| `endgame_return` | text |
| `penalty_status` | text |
| `notes` | text |
| `created_at` | text (ISO 8601) |
| `synced` | integer (0 or 1) |

### Sync Logic
1. When online and entry is submitted: upsert directly to Supabase `match_entries`
2. When offline: insert into local `matchQueue` with `synced = 0`
3. On connectivity change (offline → online): sync all `synced = 0` entries
4. Periodic sync every 30 seconds when online
5. For each unsynced entry: `supabase.from('match_entries').upsert([data], { onConflict: 'event_code,team_number,match_number,scouter_id' })`
6. On success: set `synced = 1`
7. Show pending count in UI (offline indicator bar)
8. Clean up synced entries older than 7 days

### Cached Data
- Cache match schedules locally for offline viewing
- Cache scouting entries for offline dashboard/team detail

---

## 8. Data Visibility Rules (CRITICAL)

### Team-Scoped Filtering (Client-Side)
RLS already enforces some restrictions, but the privileged teams (12841, 2844) can see all data via RLS. The **client must additionally filter** to prevent data skew:

1. Fetch the user's `team_number` from their profile
2. For all match entry queries, also fetch `profiles.team_number` for each unique `scouter_id`
3. **Default filter:** Only show entries where scouter's team = user's team OR is allied (12841↔2844 mutual)
4. **"All Teams" toggle:** Optionally bypass the filter

### Alliance Partnership
Teams 12841 and 2844 have a hardcoded alliance:
- They can see each other's scouted data
- Implemented via `is_allied_team(team_a, team_b)` DB function
- Client-side: `(myTeam === 12841 && scouterTeam === 2844) || (myTeam === 2844 && scouterTeam === 12841)`

---

## 9. External APIs

### FTC API (via Edge Functions only — never call directly from client)
- Base URL: `https://ftc-api.firstinspires.org/v2.0`
- Auth: Basic auth with `FTC_API_USERNAME` and `FTC_API_TOKEN` (stored as Supabase secrets)
- Endpoints used:
  - `GET /` → current season
  - `GET /{season}/rankings/{eventCode}` → team rankings
  - `GET /{season}/schedule/{eventCode}/{tournamentLevel}/hybrid` → match schedule
  - `GET /{season}/scores/{eventCode}/qual` → match scores
  - `GET /{season}/events` → all events for season
  - `GET /{season}/events?teamNumber={n}` → events for a team

### Team Name Resolution
- Team names come from the `ftc-rankings` edge function response (`teamName` field)
- Display `"{teamNumber} — {teamName}"` everywhere a team number appears

---

## 10. Realtime Subscriptions

Subscribe to these for live updates:

```
supabase.channel('events_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, callback)
  .subscribe()
```

Optional but recommended:
- `match_entries` changes (for live dashboard updates)
- `scouter_assignments` changes

---

## 11. Theming

- Dark theme by default
- Alliance color toggle: Blue (default) or Red
- Blue theme: primary = cyan/blue tones
- Red theme: primary = red tones
- Applied via CSS class `alliance-blue` or `alliance-red` on root

---

## 12. Navigation Structure

```text
Auth (unauthenticated)
├── Login
├── Signup
├── Forgot Password
└── Complete Profile (OAuth)

Main (authenticated + approved)
├── Event Select
├── Match Scout
├── Pit Scout
├── Dashboard
│   └── Team Detail (drill-down)
├── Team Compare
├── Live Stats
├── Match Planner
├── Spreadsheet
├── QR Transfer (Send / Receive)
├── Scouter Assignments
├── Profile Settings
├── Admin (admin only)
│   ├── User Management
│   ├── Team Change Requests
│   ├── Bug Reports
│   └── Event Sync
└── Bug Report (modal/sheet)
```

---

## 13. Key Sync Considerations for Cross-Platform

1. **Same auth system:** Both apps use the same Supabase Auth. A user logged into the web app and the mobile app simultaneously will share the same data.
2. **Same database:** All reads/writes go to the same tables. No separate mobile tables.
3. **Same edge functions:** Call identically via Supabase SDK.
4. **Conflict resolution:** The upsert on `(event_code, team_number, match_number, scouter_id)` means the latest write wins. Both platforms use the same constraint.
5. **QR codes are cross-platform:** QR generated on web can be scanned on mobile and vice versa. The compact JSON format is identical.
6. **Dashboard configs are team-scoped:** When an admin changes weights on web, the mobile app will see the same configs on next load.
7. **Offline queues are device-local:** IndexedDB (web) and SQLite (mobile) are separate. They sync independently to the same cloud tables. The upsert constraint prevents duplicates.

---

## 14. Validation Rules

### Match Entry Validation (Zod schema from web app)
```
team_number: integer, 1–99999
match_number: integer, 1–999
auto_scored_close: integer, 0–100
auto_scored_far: integer, 0–100
auto_fouls_minor: integer, 0–50
auto_fouls_major: integer, 0–50
on_launch_line: boolean
teleop_scored_close: integer, 0–200
teleop_scored_far: integer, 0–200
defense_rating: integer, 0–5
endgame_return: enum [not_returned, partial, full, lift]
penalty_status: enum [none, dead, yellow_card, red_card]
```

### QR Compact Entry Validation
```
t: integer, 1–99999  (team_number)
m: integer, 1–999    (match_number)
ac: integer, 0–100   (auto_scored_close)
af: integer, 0–100   (auto_scored_far)
tc: integer, 0–200   (teleop_scored_close)
tf: integer, 0–200   (teleop_scored_far)
ll: boolean           (on_launch_line)
dr: integer, 0–5     (defense_rating)
er: string            (endgame_return)
ps: string            (penalty_status)
f: integer, 0–50     (fouls)
```

### Import Limits
- Max file size: 5MB
- Max entries per import: 500

