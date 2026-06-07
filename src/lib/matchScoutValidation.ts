export interface MatchScoutFormInput {
  matchNumber: string;
  teamNumber: string;
}

export interface MatchScoutValidationResult {
  valid: boolean;
  missing: string[];
}

/**
 * Pure validator for MatchScout's required fields. Centralized so the form,
 * inline banner, and tests all use the same rules.
 */
export function validateMatchScoutForm(input: MatchScoutFormInput): MatchScoutValidationResult {
  const missing: string[] = [];
  const m = input.matchNumber?.trim();
  const t = input.teamNumber?.trim();

  if (!m || !/^\d+$/.test(m) || parseInt(m, 10) <= 0) missing.push('Match number');
  if (!t || !/^\d+$/.test(t) || parseInt(t, 10) <= 0) missing.push('Team number');

  return { valid: missing.length === 0, missing };
}
