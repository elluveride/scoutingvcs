import { describe, it, expect } from 'vitest';
import {
  getStrokes, appendStroke, removeLastStroke, clearPath, isEmptyPath, normalizePaths,
  pathsForSave, pathPalette, newPath, type DrawnPath,
} from '@/lib/autoPaths';

const pt = (x: number, y: number) => ({ x, y });

describe('autoPaths', () => {
  it('treats legacy points-only rows as a single stroke', () => {
    const legacy = { id: 'a', label: 'Path 1', color: '#f00', points: [pt(0, 0), pt(0.5, 0.5)] };
    expect(getStrokes(legacy)).toEqual([[pt(0, 0), pt(0.5, 0.5)]]);
    expect(isEmptyPath(legacy)).toBe(false);
  });

  it('appendStroke keeps strokes separate and flattens points for old readers', () => {
    let p: DrawnPath = newPath(0, pathPalette('blue'));
    p = appendStroke(p, [pt(0, 0), pt(0.1, 0.1)]);
    p = appendStroke(p, [pt(0.9, 0.9), pt(1, 1)]);
    expect(p.strokes).toHaveLength(2);
    expect(p.points).toHaveLength(4);
    // Undo removes exactly one stroke, not "the last 20 points".
    const undone = removeLastStroke(p);
    expect(undone.strokes).toHaveLength(1);
    expect(undone.points).toEqual([pt(0, 0), pt(0.1, 0.1)]);
    expect(isEmptyPath(clearPath(p))).toBe(true);
  });

  it('ignores single-point strokes (taps)', () => {
    const p = appendStroke(newPath(0, pathPalette('red')), [pt(0.2, 0.2)]);
    expect(getStrokes(p)).toEqual([]);
  });

  it('normalizePaths drops garbage and repairs partial rows', () => {
    const raw = [
      null,
      'nope',
      { id: 'x', label: 'L', color: '#123', points: [pt(0, 0), { x: 'bad', y: 1 }, pt(1, 1)] },
      { strokes: [[pt(0, 0), pt(0.3, 0.3)], 'junk', []] },
    ];
    const out = normalizePaths(raw);
    expect(out).toHaveLength(2);
    expect(out[0].points).toEqual([pt(0, 0), pt(1, 1)]);
    expect(out[1].strokes).toEqual([[pt(0, 0), pt(0.3, 0.3)]]);
    expect(out[1].points).toEqual([pt(0, 0), pt(0.3, 0.3)]);
    expect(out[1].label).toBe('Path 2');
    expect(normalizePaths('not an array')).toEqual([]);
  });

  it('pathsForSave strips empty paths and always writes strokes', () => {
    const empty = newPath(0, pathPalette('blue'));
    const legacy = { id: 'a', label: 'Path 1', color: '#f00', points: [pt(0, 0), pt(0.5, 0.5)] };
    const saved = pathsForSave([empty, legacy]);
    expect(saved).toHaveLength(1);
    expect(saved[0].strokes).toEqual([[pt(0, 0), pt(0.5, 0.5)]]);
  });

  it('palette puts our alliance first', () => {
    expect(pathPalette('blue')[0]).toBe('#3b82f6');
    expect(pathPalette('red')[0]).toBe('#ef4444');
    expect(pathPalette('red')[1]).toBe('#3b82f6');
  });
});
