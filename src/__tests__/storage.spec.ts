import { describe, it, expect, vi } from "vitest";
import { uploadProfilePicture } from "@/api/storage";

// Mock firebase auth to ensure currentUser exists
vi.mock("@/config/firebase", () => ({
  auth: { currentUser: { uid: "uid123" } },
  storage: {},
  getAnalyticsInstance: () => null,
}));

// We'll mock firebase/storage methods used in the implementation.
vi.mock("firebase/storage", async (importOriginal) => {
  await importOriginal();
  return {
    getStorage: vi.fn(() => ({})),
    ref: vi.fn((_storageInstance: any, path: string) => ({ path })),
    uploadBytes: vi.fn(async (ref, _file) => ({ ref })),
    getDownloadURL: vi.fn(async (ref) => `https://storage.test/${ref.path}`),
  };
});

describe("uploadProfilePicture", () => {
  it("uploads a file and returns a download URL", async () => {
    const file = new File(["abc"], "avatar.png", { type: "image/png" });
    const url = await uploadProfilePicture("uid123", file);
    // url should contain the generated timestamped filename under avatars/uid123
    expect(url).toMatch(
      /^https:\/\/storage\.test\/avatars\/uid123\/\d+_avatar\.png$/,
    );
  });
});

describe("uploadResizedProfilePicture", () => {
  it("uploads the original when the browser can't shrink it", async () => {
    const { uploadResizedProfilePicture } = await import("@/api/storage");
    const file = new File(["abc"], "avatar.png", { type: "image/png" });
    const url = await uploadResizedProfilePicture("uid123", file);
    expect(url).toMatch(/avatars\/uid123\/\d+_avatar\.png$/);
  });

  it("refuses a photo over the storage limit instead of uploading it", async () => {
    const { uploadResizedProfilePicture, AvatarTooLargeError } = await import(
      "@/api/storage"
    );
    const { uploadBytes } = await import("firebase/storage");
    vi.mocked(uploadBytes).mockClear();
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "IMG_9508.jpeg", {
      type: "image/jpeg",
    });
    await expect(uploadResizedProfilePicture("uid123", big)).rejects.toBeInstanceOf(
      AvatarTooLargeError,
    );
    expect(uploadBytes).not.toHaveBeenCalled();
  });
});
