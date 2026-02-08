# DECODE Scouting — Local Offline Server

A lightweight Node.js server that runs on a laptop at FTC events.  
Scouter phones submit data here instead of the cloud, ensuring **zero data loss** even with no internet.

## Quick Start

```bash
cd local-server
npm install
npm start
```

The server starts on `http://0.0.0.0:3000`.

## Networking Setup

### Option 1: WiFi Hotspot (Recommended)
1. On the laptop, enable **Mobile Hotspot** (Windows Settings → Network → Mobile Hotspot)
2. Connect all scouter phones to the hotspot
3. In the scouting app: Settings → Server Mode → **Local**, URL: `http://<laptop-ip>:3000`
4. The laptop IP is usually `192.168.137.1` when using Windows hotspot

### Option 2: Bluetooth PAN
1. Pair each phone with the laptop via Bluetooth
2. Enable Bluetooth PAN on the laptop
3. Use the Bluetooth PAN IP instead

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/submit` | Submit a scouting entry |
| `GET` | `/api/unsynced` | Get all unsynced entries |
| `POST` | `/api/mark-synced` | Mark entries as synced |
| `GET` | `/api/health` | Server health + counts |
| `GET` | `/api/all` | All entries (debug) |
| `GET` | `/api/export-csv` | Download CSV export |

## Syncing to Cloud

After the event (when internet is available):

1. Open `http://localhost:3000/api/unsynced` to see pending data
2. Use the app's admin sync feature, or manually push entries
3. Call `/api/mark-synced` with the synced IDs

## Data

All data is stored in `scouting.db` (SQLite) in this directory.  
Back up this file regularly during events!
