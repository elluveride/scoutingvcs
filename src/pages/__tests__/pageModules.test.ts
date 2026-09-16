import { describe, it, expect, vi, beforeAll } from 'vitest';

/**
 * Import smoke test.
 *
 * Pages used to read their field config at module scope (`findEnum('endgame_return')!`),
 * so a season that did not define that field threw a TypeError the moment the
 * route was imported — a blank screen, with nothing in the type checker to catch
 * it. These assertions are cheap and close that whole class of bug.
 */

beforeAll(() => {
  // The pages import the Supabase client at module scope; no network happens
  // during import, but the client needs its env vars to construct.
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-anon-key');
});

const PAGES = [
  'MatchScout',
  'PitScout',
  'QRTransfer',
  'SeasonSetup',
  'Dashboard',
  'MatchPlanner',
  'DataSharing',
  'EventSelect',
  'Spreadsheet',
  'TeamDetail',
  'TeamCompare',
  'PitDisplay',
] as const;

describe('page modules import under the active season', () => {
  it.each(PAGES)('%s', async (name) => {
    const mod = await import(`../${name}.tsx`);
    expect(typeof mod.default).toBe('function');
  });

  it('the season switch button and QR card import too', async () => {
    const button = await import('@/components/season/SwitchSeasonButton');
    const card = await import('@/components/scout/EntryQRCard');
    expect(typeof button.SwitchSeasonButton).toBe('function');
    expect(typeof card.EntryQRCard).toBe('function');
  });
});
