import { describe, it, expect } from 'vitest';
import { biobuzz } from '@/seasons/biobuzz';
import { decode } from '@/seasons/decode';
import { SEASONS } from '@/seasons';
import { tableColumns, tableColumnsByPhase, shortLabel } from '@/seasons/fields';

describe('shortLabel', () => {
  it('strips the phase prefix and filler nouns', () => {
    expect(shortLabel('TeleOp Hive Tips')).toBe('Hive');
    expect(shortLabel('Cell Elements Remaining')).toBe('Cell');
    expect(shortLabel('Auto Scored Close')).toBe('Close');
  });

  it('never returns an empty header, even when every word is filler', () => {
    expect(shortLabel('Elements')).not.toBe('');
    expect(shortLabel('Auto')).not.toBe('');
  });
});

describe('tableColumns', () => {
  it('uses the season\'s declared short labels', () => {
    const byKey = new Map(tableColumns(biobuzz).map((c) => [c.key, c]));
    expect(byKey.get('teleop_hive_tips')?.short).toBe('Hive');
    expect(byKey.get('teleop_bottom_nectar')?.short).toBe('Nectar');
    expect(byKey.get('teleop_park')?.short).toBe('Park');
  });

  it('omits fouls, defense and penalty — every surface renders those itself', () => {
    const keys = tableColumns(biobuzz).map((c) => c.key);
    expect(keys).not.toContain('auto_fouls_minor');
    expect(keys).not.toContain('auto_fouls_major');
    expect(keys).not.toContain('defense_rating');
    expect(keys).not.toContain('penalty_status');
  });

  it('keeps DECODE\'s endgame return status, which is a real scoring column', () => {
    const keys = tableColumns(decode).map((c) => c.key);
    expect(keys).toContain('endgame_return');
    expect(keys).toContain('auto_scored_close');
  });

  it('marks integer columns sortable and booleans not', () => {
    const byKey = new Map(tableColumns(biobuzz).map((c) => [c.key, c]));
    expect(byKey.get('teleop_garden')?.sortable).toBe(true);
    expect(byKey.get('teleop_garden')?.type).toBe('int');
    expect(byKey.get('auto_leave')?.sortable).toBe(false);
    expect(byKey.get('auto_leave')?.type).toBe('bool');
  });

  it('groups by phase, and the groups partition the whole list', () => {
    const grouped = tableColumnsByPhase(biobuzz);
    const total = grouped.auto.length + grouped.teleop.length + grouped.endgame.length;

    expect(total).toBe(tableColumns(biobuzz).length);
    expect(grouped.auto.map((c) => c.key)).toContain('auto_hive_tips');
    expect(grouped.endgame.map((c) => c.key)).toEqual(['teleop_park']);
  });

  it.each(Object.values(SEASONS).map((s) => [s.id, s] as const))(
    '%s gives every column a non-empty short header',
    (_id, season) => {
      for (const col of tableColumns(season)) {
        expect(col.short.length, `${col.key} has an empty header`).toBeGreaterThan(0);
      }
    },
  );

  it('disambiguates labels that repeat across phases', () => {
    const byKey = new Map(tableColumns(biobuzz).map((c) => [c.key, c]));

    // BIOBUZZ has Hive in auto and teleop, and Park in auto and endgame. A radar
    // axis or legend entry reading just "Park" twice would be unreadable.
    expect(byKey.get('auto_hive_tips')?.uniqueShort).toBe('A. Hive');
    expect(byKey.get('teleop_hive_tips')?.uniqueShort).toBe('T. Hive');
    expect(byKey.get('auto_park')?.uniqueShort).toBe('A. Park');
    expect(byKey.get('teleop_park')?.uniqueShort).toBe('E. Park');
  });

  it('leaves unambiguous labels short', () => {
    const byKey = new Map(tableColumns(biobuzz).map((c) => [c.key, c]));
    expect(byKey.get('teleop_garden')?.uniqueShort).toBe('Garden');
    expect(byKey.get('teleop_bottom_nectar')?.uniqueShort).toBe('Nectar');
    expect(byKey.get('auto_leave')?.uniqueShort).toBe('Leave');
  });

  it.each(Object.values(SEASONS).map((s) => [s.id, s] as const))(
    '%s gives every column a label that stands alone',
    (_id, season) => {
      const labels = tableColumns(season).map((c) => c.uniqueShort);
      expect(new Set(labels).size, `duplicate chart labels: ${labels.join(', ')}`).toBe(labels.length);
    },
  );

  it.each(Object.values(SEASONS).map((s) => [s.id, s] as const))(
    '%s produces no duplicate columns',
    (_id, season) => {
      const keys = tableColumns(season).map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
    },
  );
});
