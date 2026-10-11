import { describe, it, expect, vi, beforeEach } from "vitest";

const getDocMock = vi.fn();
const setDocMock = vi.fn();
const docMock = vi.fn();
const captureMock = vi.fn();

const authMock = vi.hoisted(() => ({
  currentUser: { uid: "uid-123" } as { uid: string } | null,
}));

vi.mock("@sentry/react", () => ({
  captureException: (...a: unknown[]) => captureMock(...a),
  startSpan: (_o: unknown, cb: () => unknown) => cb(),
}));

vi.mock("@/config/firebase", () => ({
  db: { _mock: "db" },
  auth: authMock,
}));

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => docMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  serverTimestamp: () => "ts",
  getDoc: (...args: unknown[]) => getDocMock(...args),
  collection: vi.fn(),
  addDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  Timestamp: class Timestamp {},
}));

import { hydrateUserProfileFromAuth } from "@/api/users";

const snap = (data?: Record<string, unknown>) => ({
  exists: () => !!data,
  data: () => data,
});

describe("hydrateUserProfileFromAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.currentUser = { uid: "uid-123" };
    docMock.mockReturnValue({ path: "users/uid-123" });
    setDocMock.mockResolvedValue(undefined);
    getDocMock.mockResolvedValue(snap());
  });

  it("creates a missing profile with merge:true and no undefined values", async () => {
    await hydrateUserProfileFromAuth("uid-123", {
      email: " a@b.com ",
      displayName: "",
      firstName: "",
      lastName: "",
      photoURL: null,
    });

    const [, payload, options] = setDocMock.mock.calls[0];
    expect(options).toEqual({ merge: true });
    expect(payload).toMatchObject({
      email: "a@b.com",
      boardMember: false,
      role: null,
      createdAt: "ts",
    });
    expect(Object.values(payload)).not.toContain(undefined);
    expect(payload).not.toHaveProperty("firstName");
    expect(payload).not.toHaveProperty("displayName");
  });

  it("derives displayName from first/last when auth has none", async () => {
    await hydrateUserProfileFromAuth("uid-123", {
      email: "a@b.com",
      firstName: "Al",
      lastName: "Smith",
    });
    expect(setDocMock.mock.calls[0][1]).toMatchObject({
      firstName: "Al",
      lastName: "Smith",
      displayName: "Al Smith",
    });
  });

  it("rejects creation when no email is available", async () => {
    await expect(
      hydrateUserProfileFromAuth("uid-123", { displayName: "No Email" }),
    ).rejects.toThrow(/no email available/);
    expect(setDocMock).not.toHaveBeenCalled();
    expect(captureMock).toHaveBeenCalled();
  });

  it("does not overwrite existing values and does not set create-only fields", async () => {
    getDocMock.mockResolvedValue(
      snap({
        email: "old@b.com",
        firstName: "Existing",
        lastName: "",
        displayName: "Existing Name",
        photoURL: "https://old/photo.png",
        boardMember: true,
        role: "President",
      }),
    );

    await hydrateUserProfileFromAuth("uid-123", {
      email: "new@b.com",
      firstName: "Other",
      lastName: "Last",
      displayName: "Other Last",
      photoURL: "https://new/photo.png",
    });

    const [, payload, options] = setDocMock.mock.calls[0];
    expect(options).toEqual({ merge: true });
    expect(payload).toEqual({ updatedAt: "ts", lastName: "Last" });
  });

  it("propagates read errors instead of replacing the profile", async () => {
    const err = Object.assign(new Error("denied"), {
      code: "permission-denied",
    });
    getDocMock.mockRejectedValue(err);

    await expect(
      hydrateUserProfileFromAuth("uid-123", { email: "a@b.com" }),
    ).rejects.toBe(err);
    expect(setDocMock).not.toHaveBeenCalled();
    expect(captureMock).toHaveBeenCalledWith(err);
  });

  it("requires a matching authenticated user", async () => {
    await expect(
      hydrateUserProfileFromAuth("other", { email: "a@b.com" }),
    ).rejects.toThrow(/does not match/);
    authMock.currentUser = null;
    await expect(
      hydrateUserProfileFromAuth("uid-123", { email: "a@b.com" }),
    ).rejects.toThrow(/no authenticated user/);
    expect(getDocMock).not.toHaveBeenCalled();
  });
});
