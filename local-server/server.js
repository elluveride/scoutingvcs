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

// Health check
app.get('/api/health', (_req, res) => {
  const total = countStmt.get().total;
  const unsynced = unsyncedCountStmt.get().total;
  res.json({ ok: true, total, unsynced, timestamp: new Date().toISOString() });
});

// POST /api/submit — scouter devices post match data here
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
