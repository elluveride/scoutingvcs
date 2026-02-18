# DECODE Scouting

FTC scouting app built for team 12841. Collects match and pit data at events, with offline-first support for venues with no internet.

## Features

- **Match Scouting** — Track auto, teleop, endgame stats per team per match
- **Pit Scouting** — Record robot specs, drivetrain, capabilities
- **Dashboard** — Weighted team rankings with customizable scoring
- **Team Compare** — Side-by-side stat comparison with radar charts
- **Live Stats** — FTC API integration for real-time rankings and match schedules
- **Scouter Assignments** — Admins assign scouts to specific matches/positions
- **QR Transfer** — Offline data transfer between devices via QR codes
- **Data Export** — CSV export for spreadsheet analysis
- **Bug Reporting** — In-app bug reports visible to admins

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Lovable Cloud (Supabase) — auth, database, edge functions, storage
- **Offline:** IndexedDB (PWA) + optional local Node.js server for zero-internet events

## Getting Started

```bash
npm install
npm run dev
```

## Local Server (Offline Events)

For events with no internet, a local Node.js server can be run on a laptop. Scouter phones connect via Bluetooth PAN or USB tethering.

See [`local-server/README.md`](local-server/README.md) for full setup instructions.

### Quick Start

```bash
cd local-server
npm install
ADMIN_PASSWORD=your-password npm start
```

### Important: HTTPS ↔ HTTP Limitation

The published PWA runs on HTTPS. Browsers block HTTP requests from HTTPS pages (mixed content). This means:

- **Test Connection** in the app settings won't work from the cloud-hosted preview
- To verify the local server, open `http://<server-ip>:3000/api/health` directly in the phone browser
- Match submissions work when the phone accesses the app via HTTP on the local network

## Project Structure

```
src/
  components/     # Reusable UI components
  contexts/       # React contexts (Auth, Event, Alliance, ServerMode)
  hooks/          # Custom hooks
  pages/          # Route pages
  lib/            # Utilities, offline DB, local server API
  types/          # TypeScript types
local-server/     # Node.js offline event server
supabase/
  functions/      # Edge functions (FTC API, notifications)
```

## Roles

- **Admin** — Full access, manages users, events, scouter assignments, views bug reports
- **Scout** — Submits match/pit data for their assigned team/event

## Deployment

Published at [scoutingvcs.lovable.app](https://scoutingvcs.lovable.app)
