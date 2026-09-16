import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SwitchSeasonButton } from '@/components/season/SwitchSeasonButton';

const auth = vi.hoisted(() => ({ isAdmin: false }));
const event = vi.hoisted(() => ({
  currentEvent: { id: 'e1', code: 'USAZCMP', name: 'Arizona Championship', seasonId: 'biobuzz' } as
    | { id: string; code: string; name: string; seasonId: string }
    | null,
  setEventSeason: vi.fn(async () => ({ error: null as Error | null })),
}));
const toasts = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[] }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/EventContext', () => ({ useEvent: () => event }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: (t: Record<string, unknown>) => toasts.calls.push(t) }),
}));

const renderButton = (props = {}) =>
  render(
    <MemoryRouter>
      <SwitchSeasonButton {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  auth.isAdmin = false;
  event.currentEvent = { id: 'e1', code: 'USAZCMP', name: 'Arizona Championship', seasonId: 'biobuzz' };
  event.setEventSeason = vi.fn(async () => ({ error: null as Error | null }));
  toasts.calls = [];
});

describe('SwitchSeasonButton — admin gating', () => {
  it('renders nothing at all for a non-admin scout', () => {
    const { container } = renderButton();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a non-admin even when pointed at a specific season', () => {
    const { container } = renderButton({ targetSeasonId: 'decode', label: 'Use DECODE' });
    expect(container).toBeEmptyDOMElement();
  });

  it('gives a non-admin no way to reach the confirmation dialog', () => {
    renderButton();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Switch Season/i)).toBeNull();
  });

  it('renders an enabled button for an admin', () => {
    auth.isAdmin = true;
    renderButton();

    const button = screen.getByRole('button', { name: /Switch Season/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('confirms before switching, and only then calls through', async () => {
    auth.isAdmin = true;
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: /Switch Season/i }));
    expect(await screen.findByText(/Switch Arizona Championship to DECODE/i)).toBeInTheDocument();
    // Opening the dialog must not have changed anything yet.
    expect(event.setEventSeason).not.toHaveBeenCalled();

    // Two controls share the label: the trigger, then the dialog's confirm.
    fireEvent.click(screen.getAllByText('Switch Season')[1]);

    await waitFor(() => expect(event.setEventSeason).toHaveBeenCalledWith('decode'));
  });

  it('surfaces a rejection instead of claiming success', async () => {
    auth.isAdmin = true;
    event.setEventSeason = vi.fn(async () => ({
      error: new Error('Only an admin can change the season for this event.'),
    }));
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: /Switch Season/i }));
    await screen.findByText(/Switch Arizona Championship to DECODE/i);
    fireEvent.click(screen.getAllByText('Switch Season')[1]);

    await waitFor(() => expect(toasts.calls).toHaveLength(1));
    expect(toasts.calls[0]).toMatchObject({
      title: 'Could not switch season',
      variant: 'destructive',
    });
    expect(String(toasts.calls[0].description)).toMatch(/admin/i);
  });

  it('renders nothing when no event is selected, admin or not', () => {
    auth.isAdmin = true;
    event.currentEvent = null;
    const { container } = renderButton();
    expect(container).toBeEmptyDOMElement();
  });
});
