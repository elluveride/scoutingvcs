/**
 * Auto-path helpers shared by the pit-scout drawing canvas and the team-detail
 * viewer. Paths are stored in `pit_entries.auto_paths` as JSON.
 *
 * Storage format (v2): each path carries `strokes` (an array of pen-down →
 * pen-up point lists) plus a flattened `points` array kept for backwards
 * compatibility with older readers. Legacy rows (v1) only have `points`; they
 * are treated as a single stroke.
 *
 * All coordinates are normalized 0–1 relative to the square field image.
 */

export interface PathPoint {
  x: number;
  y: number;
}

export interface DrawnPath {
  id: string;
  label: string;
  color: string;
  /** Flattened points (all strokes concatenated). Always present. */
  points: PathPoint[];
  /** Individual pen strokes. Missing on legacy rows. */
  strokes?: PathPoint[][];
}

export const MAX_PATHS = 5;

/** Alliance-ordered palette: first color is "our" alliance. */
const RED = '#ef4444';
const BLUE = '#3b82f6';
const NEUTRAL = ['#22c55e', '#f59e0b', '#a855f7'];

export function pathPalette(alliance: 'red' | 'blue'): string[] {
  return alliance === 'red' ? [RED, BLUE, ...NEUTRAL] : [BLUE, RED, ...NEUTRAL];
}

/** Return the strokes for a path, tolerating legacy rows that only have points. */
export function getStrokes(path: Pick<DrawnPath, 'points' | 'strokes'>): PathPoint[][] {
  if (Array.isArray(path.strokes)) {
    return path.strokes.filter((s) => Array.isArray(s) && s.length > 0);
  }
  return path.points && path.points.length > 0 ? [path.points] : [];
}

export function flattenStrokes(strokes: PathPoint[][]): PathPoint[] {
  return strokes.flat();
}

export function withStrokes(path: DrawnPath, strokes: PathPoint[][]): DrawnPath {
  return { ...path, strokes, points: flattenStrokes(strokes) };
}

export function appendStroke(path: DrawnPath, stroke: PathPoint[]): DrawnPath {
  if (stroke.length < 2) return path;
  return withStrokes(path, [...getStrokes(path), stroke]);
}

export function removeLastStroke(path: DrawnPath): DrawnPath {
  const strokes = getStrokes(path);
  if (strokes.length === 0) return path;
  return withStrokes(path, strokes.slice(0, -1));
}

export function clearPath(path: DrawnPath): DrawnPath {
  return withStrokes(path, []);
}

export function isEmptyPath(path: Pick<DrawnPath, 'points' | 'strokes'>): boolean {
  return getStrokes(path).every((s) => s.length < 2);
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function newPath(index: number, palette: string[]): DrawnPath {
  return {
    id: makeId(),
    label: `Path ${index + 1}`,
    color: palette[index % palette.length],
    points: [],
    strokes: [],
  };
}

function isPoint(pt: unknown): pt is PathPoint {
  return (
    !!pt &&
    typeof pt === 'object' &&
    typeof (pt as PathPoint).x === 'number' &&
    typeof (pt as PathPoint).y === 'number' &&
    Number.isFinite((pt as PathPoint).x) &&
    Number.isFinite((pt as PathPoint).y)
  );
}

/**
 * Coerce whatever came back from the database into a well-formed path list.
 * Drops malformed entries instead of throwing so one bad row can't break the
 * pit-scout page.
 */
export function normalizePaths(raw: unknown): DrawnPath[] {
  if (!Array.isArray(raw)) return [];
  const out: DrawnPath[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Partial<DrawnPath>;
    const points = Array.isArray(p.points) ? p.points.filter(isPoint) : [];
    const strokes = Array.isArray(p.strokes)
      ? p.strokes
          .filter((s): s is PathPoint[] => Array.isArray(s))
          .map((s) => s.filter(isPoint))
          .filter((s) => s.length > 0)
      : undefined;
    const path: DrawnPath = {
      id: typeof p.id === 'string' && p.id ? p.id : `legacy-${out.length}`,
      label: typeof p.label === 'string' && p.label ? p.label : `Path ${out.length + 1}`,
      color: typeof p.color === 'string' && p.color ? p.color : RED,
      points,
    };
    if (strokes) {
      path.strokes = strokes;
      path.points = flattenStrokes(strokes);
    }
    out.push(path);
  }
  return out;
}

/** Strip empty paths before saving so the DB doesn't fill with blank rows. */
export function pathsForSave(paths: DrawnPath[]): DrawnPath[] {
  return paths
    .filter((p) => !isEmptyPath(p))
    .map((p) => withStrokes(p, getStrokes(p)));
}
