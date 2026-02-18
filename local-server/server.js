/**
 * DECODE Scouting — Local Offline Server
 *
 * Run on a Windows laptop acting as event hub.
 *   1. npm install
 *   2. npm start
 *
 * Scouter phones connect via Bluetooth PAN.
 * Listens on 0.0.0.0:3000 so any device on the local network can reach it.
 */

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const PORT = 3000;

// ── Database ────────────────────────────────────────────────────────────
const dbPath = path.join(__dirname, 'scouting.db');
const db = new Database(dbPath);

// WAL mode for better concurrent reads while writing
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id         TEXT PRIMARY KEY,
    payload    TEXT    NOT NULL,
    synced     INTEGER DEFAULT 0,
    created_at TEXT    DEFAULT (datetime('now'))
  );
`);

// Prepared statements (faster than ad-hoc queries)
const upsertStmt = db.prepare(`
  INSERT OR REPLACE INTO entries (id, payload, synced, created_at)
  VALUES (@id, @payload, 0, datetime('now'))
`);

const unsyncedStmt = db.prepare(`
  SELECT id, payload, created_at, synced FROM entries WHERE synced = 0
`);

const markSyncedStmt = db.prepare(`
  UPDATE entries SET synced = 1 WHERE id = @id
`);

const allStmt = db.prepare(`SELECT * FROM entries ORDER BY created_at DESC`);
const countStmt = db.prepare(`SELECT COUNT(*) as total FROM entries`);
const unsyncedCountStmt = db.prepare(`SELECT COUNT(*) as total FROM entries WHERE synced = 0`);

// ── Express ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Root route — friendly landing page so "cannot GET /" doesn't confuse people
app.get('/', (_req, res) => {
  const total = countStmt.get().total;
  const unsynced = unsyncedCountStmt.get().total;
  res.send(`
    <!DOCTYPE html>
    <html><head><title>DECODE Local Server</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e0e0e0; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 2rem; max-width: 480px; width: 90%; }
      h1 { margin: 0 0 0.5rem; color: #22c55e; font-size: 1.4rem; }
      .stat { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #222; }
      .stat:last-child { border: none; }
      .label { color: #888; } .value { color: #fff; font-weight: 600; }
      .ok { color: #22c55e; } .warn { color: #f59e0b; }
      a { color: #60a5fa; }
      .endpoints { margin-top: 1rem; font-size: 0.85rem; color: #888; }
      .endpoints code { background: #222; padding: 2px 6px; border-radius: 4px; color: #ccc; }
    </style></head><body>
    <div class="card">
      <h1>✅ DECODE Local Server Running</h1>
      <div class="stat"><span class="label">Total Entries</span><span class="value">${total}</span></div>
      <div class="stat"><span class="label">Unsynced</span><span class="value ${unsynced > 0 ? 'warn' : 'ok'}">${unsynced}</span></div>
      <div class="stat"><span class="label">Status</span><span class="value ok">Online</span></div>
      <div class="endpoints">
        <p><strong>API:</strong></p>
        <p><code>GET /api/health</code> · <code>GET /api/all</code> · <code>GET /api/export-csv</code></p>
        <p><code>POST /api/submit</code> · <code>POST /api/mark-synced</code></p>
      </div>
    </div>
    </body></html>
  `);
});

// Live dashboard — auto-refreshing web UI
app.get('/api/dashboard', (_req, res) => {
  const rows = allStmt.all().slice(0, 50);
  const total = countStmt.get().total;
  const unsynced = unsyncedCountStmt.get().total;

  const tableRows = rows.map((r) => {
    let parsed = {};
    try { parsed = JSON.parse(r.payload); } catch {}
    return `<tr>
      <td>${r.id}</td>
      <td>${parsed.team_number ?? '—'}</td>
      <td>${parsed.match_number ?? '—'}</td>
      <td class="${r.synced ? 'ok' : 'warn'}">${r.synced ? '✓' : '✗'}</td>
      <td>${r.created_at}</td>
    </tr>`;
  }).join('');

  res.send(`<!DOCTYPE html><html><head><title>DECODE Dashboard</title>
<meta http-equiv="refresh" content="5">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #09090b; color: #e4e4e7; padding: 1.5rem; }
  h1 { font-size: 1.3rem; color: #22c55e; margin-bottom: 1rem; }
  .stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .stat-card { background: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 1rem 1.5rem; min-width: 140px; }
  .stat-card .label { font-size: 0.75rem; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-card .value { font-size: 1.8rem; font-weight: 700; margin-top: 0.25rem; }
  .ok { color: #22c55e; } .warn { color: #f59e0b; } .err { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; background: #18181b; border-radius: 10px; overflow: hidden; }
  th { text-align: left; padding: 0.6rem 1rem; background: #27272a; color: #a1a1aa; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 0.5rem 1rem; border-top: 1px solid #27272a; font-size: 0.85rem; font-family: monospace; }
  .actions { margin-bottom: 1.5rem; display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
  .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid #27272a; background: #18181b; color: #e4e4e7; font-size: 0.85rem; cursor: pointer; text-decoration: none; }
  .btn:hover { background: #27272a; }
  .btn-primary { background: #22c55e; color: #000; border-color: #22c55e; font-weight: 600; }
  .btn-primary:hover { background: #16a34a; }
  .btn-sync { background: #3b82f6; color: #fff; border-color: #3b82f6; font-weight: 600; }
  .btn-sync:hover { background: #2563eb; }
  .btn-sync:disabled { opacity: 0.5; cursor: not-allowed; }
  .sync-log { margin-top: 1rem; background: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 1rem; max-height: 200px; overflow-y: auto; font-size: 0.8rem; font-family: monospace; display: none; }
  .sync-log .line { padding: 2px 0; } .sync-log .line.err { color: #ef4444; }
  .refresh-note { font-size: 0.7rem; color: #52525b; margin-top: 1rem; }
  .empty { color: #52525b; padding: 2rem; text-align: center; }
</style></head><body>
  <h1>📡 DECODE Local Server Dashboard</h1>
  <div class="stats">
    <div class="stat-card"><div class="label">Total Entries</div><div class="value">${total}</div></div>
    <div class="stat-card"><div class="label">Unsynced</div><div class="value ${unsynced > 0 ? 'warn' : 'ok'}">${unsynced}</div></div>
    <div class="stat-card"><div class="label">Synced</div><div class="value ok">${total - unsynced}</div></div>
  </div>
  <div class="actions">
    <a class="btn btn-primary" href="/api/export-csv">⬇ Export CSV</a>
    <button class="btn btn-sync" id="syncBtn" onclick="syncToCloud()" ${unsynced === 0 ? 'disabled' : ''}>☁ Sync to Cloud (${unsynced})</button>
    <a class="btn" href="/api/health">Health Check</a>
    <a class="btn" href="/api/dashboard">↻ Refresh Now</a>
  </div>
  <div class="sync-log" id="syncLog"></div>
  ${rows.length === 0
    ? '<div class="empty">No entries yet. Scouters will appear here once they submit data.</div>'
    : `<table>
    <thead><tr><th>ID</th><th>Team</th><th>Match</th><th>Synced</th><th>Time</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>`}
  <p class="refresh-note">Auto-refreshes every 5 s · Sync requires SUPABASE_URL &amp; SUPABASE_ANON_KEY env vars on server</p>
  <script>
    async function syncToCloud() {
      var pwd = prompt('Enter admin password:');
      if (!pwd) return;
      var btn = document.getElementById('syncBtn');
      var log = document.getElementById('syncLog');
      btn.disabled = true; btn.textContent = '⏳ Syncing...';
      log.style.display = 'block';
      log.innerHTML = '<div class="line">Starting cloud sync...</div>';
      try {
        var res = await fetch('/api/sync-to-cloud', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Password': pwd },
          body: JSON.stringify({})
        });
        var data = await res.json();
        if (!data.ok) {
          log.innerHTML += '<div class="line err">Error: ' + (data.error || 'Unknown') + '</div>';
        } else {
          log.innerHTML += '<div class="line ok">✓ ' + data.synced + ' synced</div>';
          if (data.errors > 0) log.innerHTML += '<div class="line err">✗ ' + data.errors + ' failed</div>';
          if (data.details) data.details.forEach(function(d) {
            log.innerHTML += '<div class="line ' + (d.ok ? 'ok' : 'err') + '">' + (d.ok ? '✓' : '✗') + ' ' + d.id + '</div>';
          });
        }
      } catch (e) {
        log.innerHTML += '<div class="line err">Network error: ' + e.message + '</div>';
      }
      btn.textContent = '☁ Sync to Cloud';
      setTimeout(function() { location.reload(); }, 2000);
    }
  </script>
</body></html>`);
});

// Health check
app.get('/api/health', (_req, res) => {
  const total = countStmt.get().total;
  const unsynced = unsyncedCountStmt.get().total;
  res.json({ ok: true, total, unsynced, timestamp: new Date().toISOString() });
});

// POST /api/sync-to-cloud — push unsynced entries to Supabase from the dashboard
app.post('/api/sync-to-cloud', async (req, res) => {
  try {
    // Admin password check
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (ADMIN_PASSWORD) {
      const provided = req.headers['x-admin-password'] || req.body?.password;
      if (provided !== ADMIN_PASSWORD) {
        return res.status(401).json({ ok: false, error: 'Invalid admin password.' });
      }
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(400).json({
        ok: false,
        error: 'SUPABASE_URL and SUPABASE_ANON_KEY env vars must be set. Run: set SUPABASE_URL=... && set SUPABASE_ANON_KEY=... before starting the server.',
      });
    }

    const rows = unsyncedStmt.all();
    if (rows.length === 0) {
      return res.json({ ok: true, synced: 0, errors: 0, details: [] });
    }

    console.log(`[SYNC] Starting cloud sync for ${rows.length} entries...`);
    const details = [];
    const successIds = [];
    let errorCount = 0;

    for (const entry of rows) {
      const payload = typeof entry.payload === 'string' ? JSON.parse(entry.payload) : entry.payload;
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/match_entries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify(payload),
        });
        if (r.ok) {
          successIds.push(entry.id);
          details.push({ id: entry.id, ok: true });
        } else {
          errorCount++;
          const errText = await r.text();
          details.push({ id: entry.id, ok: false, error: `${r.status} ${errText}` });
        }
      } catch (e) {
        errorCount++;
        details.push({ id: entry.id, ok: false, error: e.message });
      }
    }

    // Mark synced
    if (successIds.length > 0) {
      const markMany = db.transaction((idList) => {
        for (const id of idList) markSyncedStmt.run({ id });
      });
      markMany(successIds);
    }

    console.log(`[SYNC] Done: ${successIds.length} synced, ${errorCount} errors`);
    res.json({ ok: true, synced: successIds.length, errors: errorCount, details });
  } catch (err) {
    console.error('[SYNC ERROR]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});


app.post('/api/submit', (req, res) => {
  try {
    const { id, payload } = req.body;

    if (!id || payload === undefined) {
      return res.status(400).json({ ok: false, error: 'Missing id or payload' });
    }

    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

    upsertStmt.run({ id, payload: payloadStr });

    console.log(`[SUBMIT] ${id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[SUBMIT ERROR]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/unsynced — laptop admin fetches entries that haven't been pushed to cloud
app.get('/api/unsynced', (_req, res) => {
  try {
    const rows = unsyncedStmt.all();
    res.json(rows);
  } catch (err) {
    console.error('[UNSYNCED ERROR]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/mark-synced — after successful cloud push, mark entries done
app.post('/api/mark-synced', (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ ok: false, error: 'ids must be a non-empty array' });
    }

    const markMany = db.transaction((idList) => {
      for (const id of idList) {
        markSyncedStmt.run({ id });
      }
    });

    markMany(ids);

    console.log(`[MARK-SYNCED] ${ids.length} entries`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[MARK-SYNCED ERROR]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/all — view everything (admin / debug)
app.get('/api/all', (_req, res) => {
  try {
    const rows = allStmt.all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/export-csv — quick CSV dump for spreadsheets
app.get('/api/export-csv', (_req, res) => {
  try {
    const rows = allStmt.all();
    if (rows.length === 0) {
      return res.status(200).send('No data');
    }

    // Parse first payload to get column headers
    const samplePayload = JSON.parse(rows[0].payload);
    const payloadKeys = Object.keys(samplePayload);
    const headers = ['id', ...payloadKeys, 'synced', 'created_at'];

    const csvRows = [headers.join(',')];

    for (const row of rows) {
      const p = JSON.parse(row.payload);
      const values = [
        row.id,
        ...payloadKeys.map((k) => {
          const v = p[k];
          return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v ?? '';
        }),
        row.synced,
        row.created_at,
      ];
      csvRows.push(values.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=scouting-data.csv');
    res.send(csvRows.join('\n'));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────
function getNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const results = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        results.push({ name, address: addr.address });
      }
    }
  }
  return results;
}

// ── Start ───────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const ips = getNetworkIPs();

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   DECODE Scouting — Local Server Running             ║');
  console.log('╠═══════════════════════════════════════════════════════╣');

  if (ips.length === 0) {
    console.log('║                                                       ║');
    console.log('║   ⚠  No network interfaces found!                    ║');
    console.log('║   Make sure Bluetooth PAN is enabled.                 ║');
  } else {
    console.log('║                                                       ║');
    console.log('║   Your server addresses:                              ║');
    for (const ip of ips) {
      const url = `http://${ip.address}:${PORT}`;
      const line = `   ${url}  (${ip.name})`;
      console.log(`║${line.padEnd(55)}║`);
    }
  }

  console.log('║                                                       ║');
  console.log('║   In the app: Profile → Server Mode → Local           ║');
  console.log('║   Paste the Bluetooth PAN address above.              ║');
  console.log('║                                                       ║');
  console.log('║   Data stored in scouting.db (SQLite)                 ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
});
