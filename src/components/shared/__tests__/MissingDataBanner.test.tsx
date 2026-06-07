import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MissingDataBanner } from '../MissingDataBanner';

describe('MissingDataBanner', () => {
  it('renders nothing when no teams are provided', () => {
    const { container } = render(<MissingDataBanner teams={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('lists each team with its missing-input reasons', () => {
    render(
      <MissingDataBanner
        teams={[
          { teamNumber: 12841, reasons: ['no_match_data'] },
          { teamNumber: 2844, reasons: ['low_sample', 'no_pit_data'], detail: '1 match' },
        ]}
      />
    );
    expect(screen.getByText('12841')).toBeInTheDocument();
    expect(screen.getByText(/no match scouting/i)).toBeInTheDocument();
    expect(screen.getByText('2844')).toBeInTheDocument();
    expect(screen.getByText(/low sample/i)).toBeInTheDocument();
    expect(screen.getByText(/no pit scouting/i)).toBeInTheDocument();
    expect(screen.getByText(/1 match/)).toBeInTheDocument();
  });

  it('shows the error title for the error variant', () => {
    render(
      <MissingDataBanner
        variant="error"
        teams={[{ teamNumber: 1, reasons: ['no_match_data'] }]}
      />
    );
    expect(screen.getByText(/prediction unavailable/i)).toBeInTheDocument();
  });

  it('respects a custom title and description', () => {
    render(
      <MissingDataBanner
        title="Heads up"
        description="Some teams haven't been scouted yet"
        teams={[{ teamNumber: 7, reasons: ['no_opr'] }]}
      />
    );
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText(/haven't been scouted/i)).toBeInTheDocument();
    expect(screen.getByText(/no official OPR/i)).toBeInTheDocument();
  });
});
