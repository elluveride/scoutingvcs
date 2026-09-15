import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntryQRCard } from '@/components/scout/EntryQRCard';
import { biobuzz } from '@/seasons/biobuzz';
import { chunkPayload, decodePayload } from '@/lib/qrPayload';

const entry = {
  team_number: 12841,
  match_number: 7,
  auto_leave: true,
  auto_hive_tips: 2,
  teleop_hive_tips: 3,
  penalty_status: 'none',
  notes: '',
};

/** The rendered SVG carries no payload, so read it back off the QR value prop. */
const qrValues = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('svg')).length;

describe('EntryQRCard', () => {
  it('renders a QR code for a saved entry', () => {
    const { container } = render(
      <EntryQRCard season={biobuzz} kind="match" eventCode="USAZCMP" rows={[entry]} caption="Team 12841 · Match 7" />,
    );

    expect(screen.getByText('Team 12841 · Match 7')).toBeInTheDocument();
    expect(qrValues(container)).toBeGreaterThan(0);
    // The season id is stated on screen so a scout can see which game it is tagged for.
    expect(screen.getByText('biobuzz')).toBeInTheDocument();
  });

  it('renders nothing when there is nothing to hand over', () => {
    const { container } = render(
      <EntryQRCard season={biobuzz} kind="match" eventCode="USAZCMP" rows={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('pages through multiple codes when one entry list will not fit', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ ...entry, match_number: i + 1 }));
    render(<EntryQRCard season={biobuzz} kind="match" eventCode="USAZCMP" rows={rows} />);

    const counter = screen.getByText(/^\d+ \/ \d+$/);
    expect(counter.textContent).toMatch(/^1 \/ [2-9]/);

    const [, next] = screen.getAllByRole('button');
    fireEvent.click(next);
    expect(screen.getByText(/^2 \/ \d+$/)).toBeInTheDocument();
  });

  it('calls onDismiss from the Done button', () => {
    let dismissed = false;
    render(
      <EntryQRCard
        season={biobuzz} kind="match" eventCode="USAZCMP" rows={[entry]}
        onDismiss={() => { dismissed = true; }}
      />,
    );
    fireEvent.click(screen.getByText('Done'));
    expect(dismissed).toBe(true);
  });

  it('produces a payload the scanner side can read back', () => {
    // Guards the contract between the two halves of the hand-off without a camera.
    const [chunk] = chunkPayload(biobuzz, 'match', 'USAZCMP', [entry]);
    const decoded = decodePayload(chunk, biobuzz);

    expect(decoded!.rows[0]).toMatchObject({
      team_number: 12841,
      match_number: 7,
      auto_leave: true,
      auto_hive_tips: 2,
    });
  });
});
