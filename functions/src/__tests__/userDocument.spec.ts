import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    collectionMock: vi.fn(),
    docMock: vi.fn(),
    createMock: vi.fn(),
    serverTimestampMock: vi.fn(() => ({ __serverTimestamp: true })),
  };
});

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: mocks.collectionMock,
  }),
  FieldValue: {
    serverTimestamp: mocks.serverTimestampMock,
  },
}));

vi.mock("firebase-functions/v1", () => ({
  auth: {
    user: () => ({
      onCreate: (handler: unknown) => handler,
    }),
  },
}));

import * as userDocumentModule from "../createUserDocument";
import {
  buildUserDocumentData,
  createUserDocument,
  parseDisplayName,
} from "../createUserDocument";

describe("buildUserDocumentData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collectionMock.mockReturnValue({ doc: mocks.docMock });
    mocks.docMock.mockReturnValue({ create: mocks.createMock });
  });

  it("captures the auth-derived fields and creates server timestamps", () => {
    const payload = buildUserDocumentData({
      uid: "user-123",
      email: "alice@example.com",
      displayName: "Alice Member",
      photoURL: "https://example.com/avatar.png",
    });

    expect(payload).not.toBeNull();
    expect(payload).toMatchObject({
      email: "alice@example.com",
      displayName: "Alice Member",
      photoURL: "https://example.com/avatar.png",
      firstName: "Alice",
      lastName: "Member",
      boardMember: false,
      role: null,
    });
    expect(payload?.createdAt).toEqual({ __serverTimestamp: true });
    expect(payload?.updatedAt).toEqual({ __serverTimestamp: true });
    expect(mocks.serverTimestampMock).toHaveBeenCalledTimes(2);
  });

  it("skip payload creation when the user has no email", () => {
    expect(
      buildUserDocumentData({
        uid: "user-456",
        email: "  ",
        displayName: "No Email User",
      }),
    ).toBeNull();
  });
});

describe("createUserDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collectionMock.mockReturnValue({ doc: mocks.docMock });
    mocks.docMock.mockReturnValue({ create: mocks.createMock });
  });

  it("creates the user doc for new auth users", async () => {
    await createUserDocument({
      uid: "user-789",
      email: "new@example.com",
      displayName: "New User",
      photoURL: "https://example.com/new.png",
    });

    expect(mocks.docMock).toHaveBeenCalledWith("user-789");
    expect(mocks.createMock).toHaveBeenCalledTimes(1);
    expect(mocks.createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        displayName: "New User",
        firstName: "New",
        lastName: "User",
      }),
    );
  });

  it("does not write when the auth user has no email", async () => {
    await createUserDocument({ uid: "no-email", email: null });
    expect(mocks.createMock).not.toHaveBeenCalled();
  });

  it("does not overwrite a doc that already exists", async () => {
    mocks.createMock.mockRejectedValueOnce({ code: 6 });
    await expect(
      createUserDocument({ uid: "dup", email: "dup@example.com" }),
    ).resolves.toBeNull();
  });

  it("rethrows unexpected Firestore errors", async () => {
    mocks.createMock.mockRejectedValueOnce({ code: 7 });
    await expect(
      createUserDocument({ uid: "denied", email: "d@example.com" }),
    ).rejects.toEqual({ code: 7 });
  });

  it("does not export a delete handler (user docs are kept for records)", () => {
    expect("deleteUserDocument" in userDocumentModule).toBe(false);
  });
});

describe("parseDisplayName", () => {
  it("splits first and remaining names", () => {
    expect(parseDisplayName("  Mary  Ann Smith ")).toEqual({
      firstName: "Mary",
      lastName: "Ann Smith",
    });
  });

  it("handles missing names", () => {
    expect(parseDisplayName(null)).toEqual({ firstName: "", lastName: "" });
    expect(parseDisplayName("Cher")).toEqual({
      firstName: "Cher",
      lastName: "",
    });
  });
});
