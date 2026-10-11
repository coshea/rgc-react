import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteFiles: vi.fn(),
  bucket: vi.fn(),
  docMock: vi.fn(),
}));

vi.mock("firebase-admin", () => ({
  storage: () => ({ bucket: mocks.bucket }),
  firestore: () => ({ doc: mocks.docMock }),
}));

vi.mock("firebase-functions/v1", () => ({
  auth: { user: () => ({ onDelete: (handler: unknown) => handler }) },
}));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { deleteUserAvatars } from "../deleteUserAvatars";

type Handler = (user: { uid: string }) => Promise<null>;
const run = (uid: string) => (deleteUserAvatars as unknown as Handler)({ uid });

describe("deleteUserAvatars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bucket.mockReturnValue({ deleteFiles: mocks.deleteFiles });
    mocks.deleteFiles.mockResolvedValue(undefined);
  });

  it("deletes only the user's avatar prefix", async () => {
    await run("u1");
    expect(mocks.deleteFiles).toHaveBeenCalledWith({ prefix: "avatars/u1/" });
  });

  it("never touches Firestore documents", async () => {
    await run("u1");
    expect(mocks.docMock).not.toHaveBeenCalled();
  });

  it("swallows storage errors so the auth deletion isn't retried forever", async () => {
    mocks.deleteFiles.mockRejectedValue(new Error("boom"));
    await expect(run("u1")).resolves.toBeNull();
  });
});
