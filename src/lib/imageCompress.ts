/**
 * Downscale + re-encode a photo in the browser before upload. Phone cameras
 * produce 3–12 MB HEIC/JPEG files; venue wifi is slow and Supabase storage
 * bills by size, so we cap the long edge and emit JPEG.
 */
export interface CompressOptions {
  /** Longest edge in pixels. */
  maxEdge?: number;
  /** JPEG quality 0–1. */
  quality?: number;
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<Blob> {
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.82;

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Canvas unavailable (very old browser) — fall back to the original bytes.
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ('close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') {
    (bitmap as ImageBitmap).close();
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  // If encoding failed or didn't help, keep the original.
  if (!blob || (blob.size >= file.size && file.type === 'image/jpeg')) return file;
  return blob;
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation honors EXIF rotation so portrait phone shots stay upright.
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* fall through to <img> */
    }
  }
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode image')); };
    img.src = url;
  });
}
