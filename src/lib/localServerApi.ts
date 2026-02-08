/**
 * Local server API client.
 * All calls go to the laptop's local Express server.
 * Payload is free-form JSON — no locked schema.
 */

export interface LocalSubmission {
  id: string;
  payload: Record<string, unknown>;
}

export async function submitToLocalServer(
  baseUrl: string,
  submission: LocalSubmission
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
    const data = await res.json();
    return { ok: data.ok ?? false, error: data.error };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error — is the local server running?';
    return { ok: false, error: message };
  }
}

export async function checkLocalServerHealth(
  baseUrl: string
): Promise<{ ok: boolean; total?: number; unsynced?: number; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return { ok: data.ok, total: data.total, unsynced: data.unsynced };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cannot reach local server';
    return { ok: false, error: message };
  }
}

/**
 * Generate a deterministic entry ID.
 * Format: {event}_{match}_{team}_{scouterId}
 */
export function generateEntryId(
  eventCode: string,
  matchNumber: number,
  teamNumber: number,
  scouterId: string
): string {
  return `${eventCode}_${matchNumber}_${teamNumber}_${scouterId}`;
}
