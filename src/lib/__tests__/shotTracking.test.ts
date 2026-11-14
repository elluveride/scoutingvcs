import { describe, it, expect } from 'vitest';
import { updateShotCount } from '../shotTracking';
import { scoreEntry } from '../seasonScoring';
import { biobuzz } from '@/seasons/biobuzz';
import { countersForPhase, matchFields } from '@/seasons/fields';

describe('BIOBUZZ robot shooting observations', () => {
  it('does not award Hive Tip points for shots attempted or made', () => {
    expect(scoreEntry(biobuzz, { auto_shots_attempted: 10, auto_shots_made: 7,
      teleop_shots_attempted: 30, teleop_shots_made: 25 }).total).toBe(0);
  });
  it('retains official Hive Tip scoring independently of robot observations', () => {
    expect(scoreEntry(biobuzz, { auto_hive_tips: 2, teleop_hive_tips: 3 }).total).toBe(100);
  });
  it('raises attempts when another successful shot is recorded', () => {
    expect(updateShotCount({ auto_shots_attempted: 2, auto_shots_made: 2 },
      'auto_shots_made', 3)).toEqual({ auto_shots_attempted: 3, auto_shots_made: 3 });
  });
  it('increases total shots for every additional made shot even when attempts are higher', () => {
    expect(updateShotCount({ auto_shots_attempted: 10, auto_shots_made: 3 },
      'auto_shots_made', 4)).toEqual({ auto_shots_attempted: 11, auto_shots_made: 4 });
    expect(updateShotCount({ teleop_shots_attempted: 20, teleop_shots_made: 7 },
      'teleop_shots_made', 9)).toEqual({ teleop_shots_attempted: 22, teleop_shots_made: 9 });
  });
  it('reduces made when an attempt is corrected below the made count', () => {
    expect(updateShotCount({ teleop_shots_attempted: 5, teleop_shots_made: 4 },
      'teleop_shots_attempted', 3)).toEqual({ teleop_shots_attempted: 3, teleop_shots_made: 3 });
  });
  it('keeps observations available for offline and QR transport', () => {
    expect(matchFields(biobuzz).map(f => f.key)).toEqual(expect.arrayContaining([
      'auto_shots_attempted', 'auto_shots_made', 'teleop_shots_attempted', 'teleop_shots_made',
    ]));
  });
});