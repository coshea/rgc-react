import { describe, it, expect, vi } from 'vitest';
import { uploadProfilePicture } from '@/api/storage';

// We'll mock firebase/storage methods used in the implementation.
vi.mock('firebase/storage', async (importOriginal) => {
  await importOriginal();
  return {
    getStorage: vi.fn(() => ({})),
    ref: vi.fn((_storageInstance: any, path: string) => ({ path })),
    uploadBytes: vi.fn(async (ref, _file) => ({ ref })),
    getDownloadURL: vi.fn(async (ref) => `https://storage.test/${ref.path}`),
  };
});

describe('uploadProfilePicture', () => {
  it('uploads a file and returns a download URL', async () => {
    const file = new File(['abc'], 'avatar.png', { type: 'image/png' });
  const url = await uploadProfilePicture('uid123', file);
  // url should contain the generated timestamped filename under avatars/uid123
  expect(url).toMatch(/^https:\/\/storage\.test\/avatars\/uid123\/\d+_avatar\.png$/);
  });
});
