import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { EventProvider, useEvent } from '@/contexts/EventContext';

/**
 * `setEventSeason` against the RLS behaviour it actually has to survive.
 *
 * Postgres row-level security does not raise on a rejected UPDATE — the
 * statement simply matches zero rows and returns cleanly. Without reading back
 * what changed, a scout gets a "Season switched" toast for a write the database
 * refused. These cases drive the real provider, so they catch drift in it.
 */

type UpdateResult = { data: unknown[] | null; error: { message: string } | null };

const state = vi.hoisted(() => ({
  updateResult: { data: [] as unknown[] | null, error: null } as UpdateResult,
  /** What the server holds. A successful update writes here, as a real one would. */
  storedSeason: 'biobuzz',
  /** Calls recorded as [method, ...args] so assertions can read the chain. */
  calls: [] as unknown[][],
}));

vi.mock('@/integrations/supabase/client', () => {
  // `loadEvents` runs after every switch and is authoritative, so the mock has
  // to answer with whatever the server now holds — otherwise a successful
  // switch would appear to roll straight back.
  const selectEvents = () => ({
    eq: () => ({
      order: async () => ({
        data: [{
          id: 'e1', code: 'USAZCMP', name: 'Arizona Championship',
          season_id: state.storedSeason, archived: false,
        }],
        error: null,
      }),
    }),
  });

  return {
    supabase: {
      from: (table: string) => ({
        select: (cols?: string) => {
          state.calls.push(['select', table, cols]);
          return selectEvents();
        },
        update: (patch: Record<string, unknown>) => {
          state.calls.push(['update', table, patch]);
          return {
            eq: (col: string, val: unknown) => {
              state.calls.push(['eq', col, val]);
              return {
                select: (cols: string) => {
                  state.calls.push(['update.select', cols]);
                  const { data } = state.updateResult;
                  // A write that actually landed changes what the server holds.
                  if (data && data.length > 0) {
                    state.storedSeason = (patch.season_id as string) ?? state.storedSeason;
                  }
                  return Promise.resolve(state.updateResult);
                },
              };
            },
          };
        },
      }),
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: () => {},
    },
  };
});

let lastError: Error | null | undefined;

function Harness() {
  const { currentEvent, setEventSeason } = useEvent();
  return (
    <div>
      <span data-testid="season">{currentEvent?.seasonId ?? 'none'}</span>
      <button
        onClick={async () => { lastError = (await setEventSeason('decode')).error; }}
      >
        switch
      </button>
    </div>
  );
}

const mount = async () => {
  render(<EventProvider><Harness /></EventProvider>);
  await waitFor(() => expect(screen.getByTestId('season')).toHaveTextContent('biobuzz'));
};

const clickSwitch = async () => {
  await act(async () => { screen.getByText('switch').click(); });
};

beforeEach(() => {
  lastError = undefined;
  state.calls = [];
  state.storedSeason = 'biobuzz';
  state.updateResult = { data: [], error: null };
  localStorage.setItem(
    'cipher_current_event',
    JSON.stringify({ id: 'e1', code: 'USAZCMP', name: 'Arizona Championship', seasonId: 'biobuzz' }),
  );
});

describe('EventContext.setEventSeason', () => {
  it('succeeds and updates local state when the row comes back changed', async () => {
    state.updateResult = { data: [{ code: 'USAZCMP', season_id: 'decode' }], error: null };
    await mount();
    await clickSwitch();

    expect(lastError).toBeNull();
    await waitFor(() => expect(screen.getByTestId('season')).toHaveTextContent('decode'));
  });

  it('reports a failure when RLS silently matched zero rows', async () => {
    // What a non-admin actually gets back from Postgres: no error, no rows.
    state.updateResult = { data: [], error: null };
    await mount();
    await clickSwitch();

    expect(lastError).toBeInstanceOf(Error);
    expect(lastError!.message).toMatch(/admin/i);
  });

  it('leaves the local season untouched when the write was refused', async () => {
    state.updateResult = { data: [], error: null };
    await mount();
    await clickSwitch();

    expect(screen.getByTestId('season')).toHaveTextContent('biobuzz');
  });

  it('treats a null payload as a failure too', async () => {
    state.updateResult = { data: null, error: null };
    await mount();
    await clickSwitch();

    expect(lastError).toBeInstanceOf(Error);
  });

  it('passes a genuine database error straight through', async () => {
    state.updateResult = { data: null, error: { message: 'connection reset' } };
    await mount();
    await clickSwitch();

    expect(lastError!.message).toBe('connection reset');
  });

  it('reads the row back rather than trusting the write', async () => {
    state.updateResult = { data: [{ code: 'USAZCMP', season_id: 'decode' }], error: null };
    await mount();
    await clickSwitch();

    expect(state.calls).toContainEqual(['update', 'events', { season_id: 'decode' }]);
    expect(state.calls).toContainEqual(['eq', 'code', 'USAZCMP']);
    // The select is the whole point — without it there is nothing to check.
    expect(state.calls.some(([m]) => m === 'update.select')).toBe(true);
  });
});
