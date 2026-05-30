// Compute OPR (Offensive Power Rating) via least squares from match scores.
// OPR = solution x to A x = b where A is the alliance-team incidence matrix and b is alliance totals.

import type { MatchScore } from '@/hooks/useFTCRankings';

interface MatchPositionLite {
  matchNumber: number;
  positions: { teamNumber: number; position: string }[];
}

export function computeOPR(
  matches: MatchPositionLite[],
  scores: MatchScore[],
): Map<number, number> {
  const teamSet = new Set<number>();
  matches.forEach((m) => m.positions.forEach((p) => teamSet.add(p.teamNumber)));
  const teams = [...teamSet];
  const n = teams.length;
  const result = new Map<number, number>();
  if (n === 0) return result;

  const idx = new Map(teams.map((t, i) => [t, i]));
  const A: number[][] = [];
  const b: number[] = [];

  matches.forEach((m) => {
    const score = scores.find((s) => s.matchNumber === m.matchNumber);
    if (!score) return;
    const red = score.alliances.find((a) => a.alliance.toLowerCase() === 'red');
    const blue = score.alliances.find((a) => a.alliance.toLowerCase() === 'blue');
    if (!red || !blue) return;
    const redRow = new Array(n).fill(0);
    const blueRow = new Array(n).fill(0);
    m.positions.forEach((p) => {
      const i = idx.get(p.teamNumber);
      if (i === undefined) return;
      if (p.position.startsWith('R')) redRow[i] = 1;
      else if (p.position.startsWith('B')) blueRow[i] = 1;
    });
    A.push(redRow); b.push(red.totalPoints);
    A.push(blueRow); b.push(blue.totalPoints);
  });

  if (A.length < n) {
    teams.forEach((t) => result.set(t, 0));
    return result;
  }

  // Normal equations: AtA x = Atb
  const AtA = Array.from({ length: n }, () => new Array(n).fill(0));
  const Atb = new Array(n).fill(0);
  for (let i = 0; i < A.length; i++) {
    const row = A[i];
    for (let j = 0; j < n; j++) {
      if (!row[j]) continue;
      Atb[j] += b[i];
      for (let k = 0; k < n; k++) if (row[k]) AtA[j][k]++;
    }
  }

  // Ridge regularization to handle singular matrices
  for (let i = 0; i < n; i++) AtA[i][i] += 0.5;

  // Augmented matrix + Gauss elimination with partial pivoting
  const M = AtA.map((row, i) => [...row, Atb[i]]);
  for (let i = 0; i < n; i++) {
    let max = i;
    for (let k = i + 1; k < n; k++)
      if (Math.abs(M[k][i]) > Math.abs(M[max][i])) max = k;
    [M[i], M[max]] = [M[max], M[i]];
    if (Math.abs(M[i][i]) < 1e-10) continue;
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      if (f === 0) continue;
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = Math.abs(M[i][i]) < 1e-10 ? 0 : s / M[i][i];
  }
  teams.forEach((t, i) => result.set(t, x[i]));
  return result;
}
