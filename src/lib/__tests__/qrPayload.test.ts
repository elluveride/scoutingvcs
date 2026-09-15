import { describe, it, expect } from 'vitest';
import { biobuzz } from '@/seasons/biobuzz';
import { decode } from '@/seasons/decode';
import {
  encodePayload, decodePayload, chunkPayload, entryKey, QR_FORMAT_VERSION,
} from '@/lib/qrPayload';

const biobuzzEntry = {
  team_number: 12841,
  match_number: 14,
  auto_leave: true,
  auto_park: false,
  auto_hive_tips: 1,
  auto_fouls_minor: 2,
  auto_fouls_major: 0,
  teleop_hive_tips: 3,
  teleop_cell_remaining: 7,
  teleop_flower_scored: 4,
  teleop_bottom_nectar: 2,
  teleop_garden: 5,
  teleop_park: true,
  defense_rating: 2,
  penalty_status: 'yellow_card',
  notes: 'intake jammed in the last 30s',
};

const pitEntry = {
  team_number: 2844,
  team_name: 'Bee Team',
  drive_type: 'swerve',
  auto_consistency: 'high',
  reliable_auto_leave: 'yes',
  preferred_start: 'far',
  endgame_consistency: 'medium',
  can_tip_hive: true,
  scores_pollen: false,
  scores_nectar: true,
  scores_flower: true,
  scores_garden: false,
  has_autonomous: true,
};

describe('qrPayload', () => {
  it('round-trips a BIOBUZZ match entry through encode → JSON → decode', () => {
    const json = JSON.stringify(encodePayload(biobuzz, 'match', 'USAZCMP', [biobuzzEntry]));
    const decoded = decodePayload(json, biobuzz);

    expect(decoded).not.toBeNull();
    expect(decoded!.kind).toBe('match');
    expect(decoded!.seasonId).toBe('biobuzz');
    expect(decoded!.eventCode).toBe('USAZCMP');
    expect(decoded!.formatVersion).toBe(QR_FORMAT_VERSION);
    expect(decoded!.rows).toHaveLength(1);
    expect(decoded!.rows[0]).toMatchObject(biobuzzEntry);
  });

  it('round-trips a BIOBUZZ pit entry, capability booleans included', () => {
    const json = JSON.stringify(encodePayload(biobuzz, 'pit', 'USAZCMP', [pitEntry]));
    const decoded = decodePayload(json, biobuzz);

    expect(decoded!.kind).toBe('pit');
    expect(decoded!.rows[0]).toMatchObject(pitEntry);
    // Booleans travel as 0/1 but must come back as real booleans.
    expect(decoded!.rows[0].can_tip_hive).toBe(true);
    expect(decoded!.rows[0].scores_pollen).toBe(false);
  });

  it('reports the payload season so a cross-season scan can be refused', () => {
    const json = JSON.stringify(encodePayload(decode, 'match', 'USAZCMP', [
      { team_number: 1, match_number: 1, auto_scored_close: 3 },
    ]));
    const decoded = decodePayload(json, biobuzz);

    expect(decoded!.seasonId).toBe('decode');
    // Columns BIOBUZZ does not have are dropped rather than written blindly.
    expect(decoded!.rows[0]).not.toHaveProperty('auto_scored_close');
    expect(decoded!.rows[0].team_number).toBe(1);
  });

  it('still decodes v1 DECODE payloads', () => {
    const legacy = JSON.stringify({
      d: [{ t: 12841, m: 3, ac: 2, af: 1, tc: 5, tf: 3, ll: false, dr: 1, er: 'full', ps: 'none', f: 0 }],
    });
    const decoded = decodePayload(legacy, decode);

    expect(decoded!.formatVersion).toBe(1);
    expect(decoded!.kind).toBe('match');
    expect(decoded!.seasonId).toBe('decode');
    expect(decoded!.rows[0]).toMatchObject({
      team_number: 12841,
      match_number: 3,
      auto_scored_close: 2,
      teleop_scored_far: 3,
      endgame_return: 'full',
    });
  });

  it('returns null for anything that is not a scouting payload', () => {
    expect(decodePayload('https://example.com', biobuzz)).toBeNull();
    expect(decodePayload('not json at all', biobuzz)).toBeNull();
    expect(decodePayload('{"hello":"world"}', biobuzz)).toBeNull();
  });

  it('clamps out-of-range integers rather than trusting the scanner', () => {
    const tampered = JSON.stringify({
      v: 2, s: 'biobuzz', k: 'm', e: 'USAZCMP',
      f: ['team_number', 'match_number', 'teleop_garden'],
      d: [[12841, 5, 999999]],
    });
    const decoded = decodePayload(tampered, biobuzz);
    expect(decoded!.rows[0].teleop_garden).toBe(999);
  });

  it('falls back to the first option for an unknown enum value', () => {
    const odd = JSON.stringify({
      v: 2, s: 'biobuzz', k: 'm', e: '',
      f: ['team_number', 'match_number', 'penalty_status'],
      d: [[1, 1, 'purple_card']],
    });
    expect(decodePayload(odd, biobuzz)!.rows[0].penalty_status).toBe('none');
  });

  it('splits into self-describing chunks that each decode alone', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ ...biobuzzEntry, match_number: i + 1 }));
    const chunks = chunkPayload(biobuzz, 'match', 'USAZCMP', rows, 600);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      const decoded = decodePayload(chunk, biobuzz);
      expect(decoded).not.toBeNull();
      expect(decoded!.kind).toBe('match');
      expect(decoded!.rows.length).toBeGreaterThan(0);
    }

    const all = chunks.flatMap((c) => decodePayload(c, biobuzz)!.rows);
    expect(all).toHaveLength(rows.length);
    expect(new Set(all.map((r) => r.match_number)).size).toBe(rows.length);
  });

  it('emits no chunks for an empty entry list', () => {
    expect(chunkPayload(biobuzz, 'match', 'USAZCMP', [])).toEqual([]);
  });

  it('keys match entries by team+match and pit entries by team', () => {
    expect(entryKey('match', biobuzzEntry)).toBe('12841-14');
    expect(entryKey('pit', pitEntry)).toBe('2844');
  });
});
