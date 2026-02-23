import { describe, it, expect, vi, beforeEach } from "vitest";

const getDocMock = vi.fn();
const setDocMock = vi.fn();
const docMock = vi.fn();
const serverTimestampMock = vi.fn();

vi.mock("@/config/firebase", () => ({
  db: { _mock: "db" },
  auth: {
    currentUser: {
      uid: "uid-123",
      email: "member@example.com",
      getIdToken: vi.fn(async () => "token"),
    },
  },
}));

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => docMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  serverTimestamp: () => serverTimestampMock(),
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

import { saveUserProfile } from "@/api/users";

describe("saveUserProfile bootstrap create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    docMock.mockReturnValue({ path: "users/uid-123" });
    serverTimestampMock.mockReturnValue("ts");
    getDocMock.mockResolvedValue({ exists: () => false });
    setDocMock.mockResolvedValue(undefined);
  });

  it("creates users/{uid} when profile doc is missing", async () => {
    await saveUserProfile("uid-123", {
      firstName: "Alice",
      lastName: "Member",
      phone: "555-111-2222",
    });

    expect(getDocMock).toHaveBeenCalledTimes(1);
    expect(setDocMock).toHaveBeenCalledTimes(1);

    const [refArg, payloadArg, optionsArg] = setDocMock.mock.calls[0];

    expect(refArg).toEqual({ path: "users/uid-123" });
    expect(optionsArg).toEqual({ merge: false });
    expect(payloadArg.email).toBe("member@example.com");
    expect(payloadArg.boardMember).toBe(false);
    expect(payloadArg.role).toBeNull();
    expect(payloadArg.createdAt).toBe("ts");
    expect(payloadArg.updatedAt).toBe("ts");
    expect(payloadArg.displayName).toBe("Alice Member");
  });
});
