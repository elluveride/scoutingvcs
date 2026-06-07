import { describe, it, expect } from 'vitest';
import { validateMatchScoutForm } from '../matchScoutValidation';

describe('validateMatchScoutForm', () => {
  it('blocks save when match number is missing', () => {
    const res = validateMatchScoutForm({ matchNumber: '', teamNumber: '12841' });
    expect(res.valid).toBe(false);
    expect(res.missing).toContain('Match number');
  });

  it('blocks save when team number is missing', () => {
    const res = validateMatchScoutForm({ matchNumber: '1', teamNumber: '' });
    expect(res.valid).toBe(false);
    expect(res.missing).toContain('Team number');
  });

  it('blocks save when team number is non-numeric', () => {
    const res = validateMatchScoutForm({ matchNumber: '1', teamNumber: 'abc' });
    expect(res.valid).toBe(false);
    expect(res.missing).toContain('Team number');
  });

  it('passes when both fields are valid', () => {
    const res = validateMatchScoutForm({ matchNumber: '12', teamNumber: '2844' });
    expect(res.valid).toBe(true);
    expect(res.missing).toHaveLength(0);
  });
});
