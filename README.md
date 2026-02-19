# DECODE Scouting

FTC scouting app built for team 12841. Collects match and pit data at events, with offline-first support for venues with no internet.

## Features

- **Match Scouting** — Track auto, teleop, endgame stats per team per match
- **Pit Scouting** — Record robot specs, drivetrain, capabilities
- **Dashboard** — Weighted team rankings with customizable scoring
- **Team Compare** — Side-by-side stat comparison with radar charts
- **Live Stats** — FTC API integration for real-time rankings and match schedules
- **Scouter Assignments** — Admins assign scouts to specific matches/positions
- **QR Transfer** — Offline data transfer between devices via QR codes with duplicate detection
- **Data Export** — CSV export for spreadsheet analysis
- **Bug Reporting** — In-app bug reports visible to admins

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Lovable Cloud (Supabase) — auth, database, edge functions, storage
- **Offline:** IndexedDB (PWA) + QR Transfer for zero-internet events

## Getting Started

```bash
npm install
npm run dev
```

## Offline Strategy

### PWA Offline Mode (Automatic)
The app is a PWA. When offline, scouting submissions are queued in IndexedDB and auto-sync when internet returns. The offline indicator at the bottom of the screen shows pending entry count.

### QR Transfer (Zero-Internet Events)
For events with no internet at all:
1. Scouters collect data on their phones (saved locally)
2. After matches, scouters go to **QR Transfer → Send Data** to display QR codes
3. A central "hub" device scans QR codes via **QR Transfer → Receive Data**
4. The scanner flags duplicate entries with a **DUP** badge and skips them on import
5. The hub syncs imported data to the cloud when internet is available

## Project Structure

```
src/
  components/     # Reusable UI components
  contexts/       # React contexts (Auth, Event, Alliance)
  hooks/          # Custom hooks
  pages/          # Route pages
  lib/            # Utilities, offline DB
  types/          # TypeScript types
supabase/
  functions/      # Edge functions (FTC API, notifications)
```

## Roles

- **Admin** — Full access, manages users, events, scouter assignments, views bug reports
- **Scout** — Submits match/pit data for their assigned team/event

## Deployment

Published at [scoutingvcs.lovable.app](https://scoutingvcs.lovable.app)
