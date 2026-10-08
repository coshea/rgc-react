import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    collectionMock: vi.fn(),
    docMock: vi.fn(),
    setMock: vi.fn(),
    deleteMock: vi.fn(),
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
      onDelete: (handler: unknown) => handler,
    }),
  },
}));

import {
  buildUserDocumentData,
  createUserDocument,
  deleteUserDocument,
} from "../createUserDocument";

describe("buildUserDocumentData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collectionMock.mockReturnValue({ doc: mocks.docMock });
    mocks.docMock.mockReturnValue({
      set: mocks.setMock,
      delete: mocks.deleteMock,
    });
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
    mocks.docMock.mockReturnValue({
      set: mocks.setMock,
      delete: mocks.deleteMock,
    });
  });

  it("writes a merge-true user doc for new auth users", async () => {
    await createUserDocument({
      uid: "user-789",
      email: "new@example.com",
      displayName: "New User",
      photoURL: "https://example.com/new.png",
    });

    expect(mocks.docMock).toHaveBeenCalledWith("user-789");
    expect(mocks.setMock).toHaveBeenCalledTimes(1);
    expect(mocks.setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        displayName: "New User",
        firstName: "New",
        lastName: "User",
      }),
      { merge: true },
    );
  });
});

describe("deleteUserDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collectionMock.mockReturnValue({ doc: mocks.docMock });
    mocks.docMock.mockReturnValue({
      set: mocks.setMock,
      delete: mocks.deleteMock,
    });
  });

  it("deletes the user doc when the auth record is removed", async () => {
    await deleteUserDocument({ uid: "user-delete" });

    expect(mocks.docMock).toHaveBeenCalledWith("user-delete");
    expect(mocks.deleteMock).toHaveBeenCalledTimes(1);
  });
});
