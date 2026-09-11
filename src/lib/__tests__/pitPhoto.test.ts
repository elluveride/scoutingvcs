import { describe, it, expect } from 'vitest';
import { robotPhotoPath, storagePathFromStored } from '@/lib/pitPhoto';

describe('pitPhoto', () => {
  it('builds a deterministic jpg path per event+team', () => {
    expect(robotPhotoPath('USMIACMP', 12841)).toBe('12841/USMIACMP_12841.jpg');
  });

  it('accepts bare storage paths', () => {
    expect(storagePathFromStored('12841/USMIACMP_12841.jpg')).toBe('12841/USMIACMP_12841.jpg');
    expect(storagePathFromStored('/robot-photos/12841/x.png')).toBe('12841/x.png');
  });

  it('extracts the path from legacy signed and public URLs', () => {
    const signed = 'https://abc.supabase.co/storage/v1/object/sign/robot-photos/12841/USMIACMP_12841.png?token=eyJ.abc';
    expect(storagePathFromStored(signed)).toBe('12841/USMIACMP_12841.png');
    const pub = 'https://abc.supabase.co/storage/v1/object/public/robot-photos/2844/E_2844.jpeg';
    expect(storagePathFromStored(pub)).toBe('2844/E_2844.jpeg');
  });

  it('returns null for empty or foreign values', () => {
    expect(storagePathFromStored(null)).toBeNull();
    expect(storagePathFromStored('   ')).toBeNull();
    expect(storagePathFromStored('https://example.com/other/thing.png')).toBeNull();
  });
});
