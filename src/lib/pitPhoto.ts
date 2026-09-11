/**
 * Robot-photo helpers for pit scouting.
 *
 * `pit_entries.robot_photo_url` historically stored a *signed* URL (which
 * expires after an hour). New rows store the bucket-relative storage path
 * instead. `storagePathFromStored` accepts either form.
 */

export const ROBOT_PHOTO_BUCKET = 'robot-photos';

/** Bucket-relative path for a team's photo at an event. Always JPEG (we compress client-side). */
export function robotPhotoPath(eventCode: string, teamNumber: number | string): string {
  return `${teamNumber}/${eventCode}_${teamNumber}.jpg`;
}

/** Extract the bucket-relative path from a stored value (path, public URL, or signed URL). */
export function storagePathFromStored(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    // Already a bare path. Strip any accidental leading slash or bucket prefix.
    const bare = trimmed.replace(/^\/+/, '').replace(new RegExp(`^${ROBOT_PHOTO_BUCKET}/`), '');
    return bare || null;
  }
  const m = trimmed.match(new RegExp(`/${ROBOT_PHOTO_BUCKET}/([^?#]+)`));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}
