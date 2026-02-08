/**
 * DECODE Scouting — Cloud Sync Script
 *
 * Run this on the laptop AFTER the event when internet is available.
 * It fetches unsynced entries from the local server and pushes them
 * to the Supabase cloud database.
 *
 * Usage:
 *   node sync-to-cloud.js
 *
 * Environment variables (set before running):
 *   SUPABASE_URL        — Your Supabase project URL
 *   SUPABASE_ANON_KEY   — Your Supabase anon/public key
 *   LOCAL_SERVER_URL     — Local server URL (default: http://localhost:3000)
 */

const LOCAL_SERVER = process.env.LOCAL_SERVER_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('ERROR: Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  console.error('Example:');
  console.error('  set SUPABASE_URL=https://your-project.supabase.co');
  console.error('  set SUPABASE_ANON_KEY=eyJ...');
  process.exit(1);
}

async function main() {
  console.log('Fetching unsynced entries from local server...');

  // 1. Get unsynced
  const unsyncedRes = await fetch(`${LOCAL_SERVER}/api/unsynced`);
  const unsynced = await unsyncedRes.json();

  if (unsynced.length === 0) {
    console.log('No unsynced entries. All caught up!');
    return;
  }

  console.log(`Found ${unsynced.length} unsynced entries. Pushing to cloud...`);

  const successIds = [];
  let errorCount = 0;

  for (const entry of unsynced) {
    const payload = typeof entry.payload === 'string' ? JSON.parse(entry.payload) : entry.payload;

    // Push to Supabase match_entries via REST API
    const res = await fetch(`${SUPABASE_URL}/rest/v1/match_entries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      successIds.push(entry.id);
      console.log(`  ✓ ${entry.id}`);
    } else {
      errorCount++;
      const errText = await res.text();
      console.error(`  ✗ ${entry.id}: ${res.status} ${errText}`);
    }
  }

  // 2. Mark synced
  if (successIds.length > 0) {
    await fetch(`${LOCAL_SERVER}/api/mark-synced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: successIds }),
    });
  }

  console.log('');
  console.log(`Done! ${successIds.length} synced, ${errorCount} errors.`);
}

main().catch(console.error);
