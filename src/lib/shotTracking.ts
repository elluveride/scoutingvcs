/** Keep robot-level observations internally consistent without assigning score points. */
export function updateShotCount(
  form: Record<string, number | boolean | string>,
  key: string,
  value: number | boolean | string,
): Record<string, number | boolean | string> {
  const next = { ...form, [key]: value };
  if (typeof value !== 'number') return next;
  const match = key.match(/^(auto|teleop)_shots_(attempted|made)$/);
  if (!match) return next;
  const attemptedKey = `${match[1]}_shots_attempted`;
  const madeKey = `${match[1]}_shots_made`;
  const attempted = Number(next[attemptedKey] ?? 0);
  const made = Number(next[madeKey] ?? 0);
  if (made > attempted) {
    if (match[2] === 'made') next[attemptedKey] = made;
    else next[madeKey] = attempted;
  }
  return next;
}