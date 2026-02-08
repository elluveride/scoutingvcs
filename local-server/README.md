# DECODE Scouting — Local Offline Server

A lightweight Node.js server that runs on a laptop at FTC events.  
Scouter phones submit data here instead of the cloud, ensuring **zero data loss** even with no internet.

> **WiFi hotspots are banned at most FTC events.** This guide uses **Bluetooth PAN** (Personal Area Network), which is allowed.

---

## Quick Start

```bash
cd local-server
npm install
npm start
```

The server starts on `http://0.0.0.0:3000` and **prints all available IP addresses** so you know exactly which one to use.

---

## Bluetooth PAN Setup (Step-by-Step)

### What You Need
- **1 Windows laptop** (the server hub — stays at your pit or with the drive team)
- **Scouter phones** (Android recommended, iOS has limited Bluetooth PAN support)
- All devices paired via Bluetooth

### Phase 1: Prepare the Laptop (Do This Before the Event)

#### 1. Install Node.js
1. Go to [nodejs.org](https://nodejs.org) and install the **LTS** version
2. Open **Command Prompt** (Win + R → type `cmd` → Enter)
3. Verify: `node --version` should print something like `v20.x.x`

#### 2. Install the Server
```bash
cd path\to\decode-scouting\local-server
npm install
```

#### 3. Enable Bluetooth on the Laptop
1. Open **Settings → Bluetooth & devices**
2. Make sure Bluetooth is **ON**
3. Click **"Devices"** (or **"View more devices"**)
4. Scroll down and click **"More Bluetooth settings"** (small link)
5. Go to the **Options** tab
6. ✅ Check **"Allow Bluetooth devices to find this PC"**
7. Click **OK**

#### 4. Enable Bluetooth PAN (Network Access Point)
1. Open **Control Panel** → **Network and Sharing Center**  
   _(Search "network" in Start menu → "View network connections")_
2. On the left, click **"Change adapter settings"**
3. Look for **"Bluetooth Network Connection"**
   - If you don't see it: right-click empty space → check if hidden adapters exist
   - It may only appear after pairing the first phone
4. **Right-click** "Bluetooth Network Connection" → **Properties**
5. Find **"Internet Protocol Version 4 (TCP/IPv4)"** → click **Properties**
6. Select **"Use the following IP address"** and enter:
   - **IP address:** `192.168.44.1`
   - **Subnet mask:** `255.255.255.0`
   - Leave **Default gateway** blank
7. Click **OK** → **OK**

> **Why set a static IP?** Windows auto-assigns random IPs for Bluetooth PAN. A static IP means every scouter always uses the same server address — no hunting for IPs mid-match.

### Phase 2: Pair Each Scouter Phone

Do this for **every phone** that will be scouting:

#### Android Phone Pairing
1. On the **phone**: Settings → Bluetooth → Turn ON → Make discoverable
2. On the **laptop**: Settings → Bluetooth & devices → **Add device** → Bluetooth
3. Select the phone from the list → confirm the pairing code on **both** devices
4. On the **phone** (after pairing):
   - Go to **Settings → Connected devices → Previously connected devices**
   - Tap the **⚙️ gear icon** next to the laptop name
   - Enable **"Internet access"** or **"Network access"** (wording varies by phone)
   - Some phones: Settings → Bluetooth → tap the laptop → toggle **"Internet access sharing"**

#### iOS Phone Pairing (Limited Support)
> ⚠️ **iOS has restricted Bluetooth PAN since iOS 12.** It only works reliably if the laptop shares internet, which is not the goal here. **Android phones are strongly recommended for scouters.**

If you must use iPhones:
1. Pair with the laptop via Bluetooth (Settings → Bluetooth → tap laptop name)
2. You'll likely need to use the phone's **browser** to access the server directly (not the PWA in local mode)
3. Consider using a USB cable connection instead

### Phase 3: Connect Phones to Laptop's Bluetooth PAN

#### On Each Android Phone (After Pairing)
1. Go to **Settings → Bluetooth**
2. Tap the **paired laptop name**
3. The phone should connect and show "Connected" with a network icon
4. Some phones require going to: **Settings → Network → Bluetooth tethering** and enabling it

#### Verify the Connection
On the **phone**, open the browser and navigate to:
```
http://192.168.44.1:3000/api/health
```

You should see:
```json
{"ok": true, "total": 0, "unsynced": 0, "timestamp": "..."}
```

If this works, the Bluetooth PAN connection is solid!

### Phase 4: Configure the Scouting App

On **each scouter phone**:
1. Open the DECODE Scouting app
2. Go to **Profile** (bottom nav or sidebar)
3. Scroll to **Server Mode**
4. Tap **Local**
5. Set the URL to: `http://192.168.44.1:3000`
6. Wait for the green **"Connected"** indicator

### Phase 5: Start the Server at the Event

On the laptop:
```bash
cd local-server
npm start
```

The console will print all available IP addresses. Look for the **Bluetooth Network Connection** entry — that's the one scouters use.

---

## Troubleshooting

### "Cannot reach local server" on phones
1. Make sure the server is running (`npm start`)
2. Check Bluetooth is paired AND connected (not just paired)
3. On Android: try toggling Bluetooth off and on, then reconnect
4. On the laptop: run `ipconfig` in Command Prompt, find the Bluetooth adapter IP
5. Verify with the phone browser: `http://<ip>:3000/api/health`

### Phones keep disconnecting
- Bluetooth PAN can be unstable with many devices. **4-5 phones** is typically the practical limit per laptop
- Keep phones close to the laptop (within ~10m / 30ft)
- Disable Bluetooth battery optimization on Android phones:
  Settings → Apps → Bluetooth → Battery → **Don't restrict**

### Windows Firewall blocking connections
1. Open **Windows Defender Firewall** (search in Start)
2. Click **"Allow an app through firewall"**
3. Click **"Change settings"** → **"Allow another app"**
4. Browse to your Node.js installation (e.g., `C:\Program Files\nodejs\node.exe`)
5. Check both **Private** and **Public**
6. Click **OK**

### Alternative: If Bluetooth PAN Won't Work
If you can't get Bluetooth PAN to work on a specific phone:
1. Use **USB tethering** — connect phone to laptop via USB cable
2. Enable USB tethering on the phone (Settings → Network → USB tethering)
3. The phone will get an IP on the USB network — check `ipconfig` for the new adapter
4. Use the QR Transfer feature in the app as a last resort

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/submit` | Submit a scouting entry |
| `GET` | `/api/unsynced` | Get all unsynced entries |
| `POST` | `/api/mark-synced` | Mark entries as synced |
| `GET` | `/api/health` | Server health + counts |
| `GET` | `/api/all` | All entries (debug) |
| `GET` | `/api/export-csv` | Download CSV export |

## Syncing to Cloud (After the Event)

Once you have internet (hotel, home, etc.):

1. Open `http://localhost:3000/api/unsynced` to see pending data
2. Run the sync script:
   ```bash
   set SUPABASE_URL=https://your-project.supabase.co
   set SUPABASE_ANON_KEY=eyJ...
   node sync-to-cloud.js
   ```
3. Or use the app's admin sync feature

## Data

All data is stored in `scouting.db` (SQLite) in this directory.  
**Back up this file regularly during events!** Copy it to a USB drive between rounds.

## Recommended Event Day Checklist

- [ ] Laptop fully charged + charger plugged in
- [ ] All phones paired and tested BEFORE first match
- [ ] Server running (`npm start`)
- [ ] Each phone showing green "Connected" in Server Mode settings
- [ ] Backup `scouting.db` to USB after every 3-4 matches
- [ ] Have one phone with USB cable as backup
