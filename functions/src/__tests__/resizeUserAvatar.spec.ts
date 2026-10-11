import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  save: vi.fn(),
  fileMock: vi.fn(),
  bucketMock: vi.fn(),
  userGet: vi.fn(),
  userUpdate: vi.fn(),
  docMock: vi.fn(),
  metadata: vi.fn(),
  toBuffer: vi.fn(),
  resize: vi.fn(),
  jpeg: vi.fn(),
}));

vi.mock("firebase-admin", () => {
  const firestore = Object.assign(() => ({ doc: mocks.docMock }), {
    FieldValue: { serverTimestamp: () => "ts" },
  });
  return {
    storage: () => ({ bucket: mocks.bucketMock }),
    firestore,
  };
});

vi.mock("firebase-functions/v2/storage", () => ({
  onObjectFinalized: (_opts: unknown, handler: unknown) => handler,
}));

vi.mock("sharp", () => ({
  default: () => ({
    metadata: mocks.metadata,
    resize: mocks.resize,
  }),
}));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  getUserUidFromAvatarPath,
  resize_user_avatar,
} from "../resizeUserAvatar";

type Handler = (event: { data: Record<string, unknown> }) => Promise<void>;
const run = (data: Record<string, unknown>) =>
  (resize_user_avatar as unknown as Handler)({ data });

const baseEvent = {
  name: "avatars/uid1/photo.png",
  bucket: "bkt",
  contentType: "image/png",
};

describe("getUserUidFromAvatarPath", () => {
  it("extracts the uid", () => {
    expect(getUserUidFromAvatarPath("avatars/u1/a.png")).toBe("u1");
  });
  it("rejects bad paths", () => {
    expect(getUserUidFromAvatarPath("avatars/a.png")).toBeNull();
    expect(getUserUidFromAvatarPath("other/u1/a.png")).toBeNull();
    expect(getUserUidFromAvatarPath("avatars/ /a.png")).toBeNull();
  });
});

describe("resize_user_avatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bucketMock.mockReturnValue({ file: mocks.fileMock });
    mocks.fileMock.mockImplementation(() => ({
      download: mocks.download,
      save: mocks.save,
    }));
    mocks.download.mockResolvedValue([Buffer.from("img")]);
    mocks.metadata.mockResolvedValue({ width: 1200, height: 800 });
    mocks.resize.mockReturnValue({ jpeg: mocks.jpeg });
    mocks.jpeg.mockReturnValue({ toBuffer: mocks.toBuffer });
    mocks.toBuffer.mockResolvedValue(Buffer.from("small"));
    mocks.docMock.mockReturnValue({
      get: mocks.userGet,
      update: mocks.userUpdate,
    });
    mocks.userGet.mockResolvedValue({ exists: true });
    mocks.save.mockResolvedValue(undefined);
    mocks.userUpdate.mockResolvedValue(undefined);
  });

  it("ignores files outside avatars/, resized copies and non-images", async () => {
    await run({ ...baseEvent, name: "blog-images/a.png" });
    await run({ ...baseEvent, name: "avatars/uid1/resized/a.jpg" });
    await run({ ...baseEvent, contentType: "application/pdf" });
    await run({ bucket: "bkt" });
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("skips images that are already small enough", async () => {
    mocks.metadata.mockResolvedValue({ width: 300, height: 200 });
    await run(baseEvent);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("saves a resized jpeg with a download token and updates profileURL", async () => {
    await run(baseEvent);

    expect(mocks.resize).toHaveBeenCalledWith(
      400,
      400,
      expect.objectContaining({ withoutEnlargement: true }),
    );
    expect(mocks.fileMock).toHaveBeenCalledWith("avatars/uid1/resized/photo.jpg");

    const [, saveOpts] = mocks.save.mock.calls[0];
    expect(saveOpts.contentType).toBe("image/jpeg");
    const token = saveOpts.metadata.metadata.firebaseStorageDownloadTokens;
    expect(token).toBeTruthy();

    expect(mocks.docMock).toHaveBeenCalledWith("users/uid1");
    const [update] = mocks.userUpdate.mock.calls[0];
    expect(update.profileURL).toBe(
      `https://firebasestorage.googleapis.com/v0/b/bkt/o/${encodeURIComponent(
        "avatars/uid1/resized/photo.jpg",
      )}?alt=media&token=${token}`,
    );
  });

  it("does not re-create a missing user doc", async () => {
    mocks.userGet.mockResolvedValue({ exists: false });
    await run(baseEvent);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("swallows processing errors", async () => {
    mocks.download.mockRejectedValue(new Error("boom"));
    await expect(run(baseEvent)).resolves.toBeUndefined();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});
