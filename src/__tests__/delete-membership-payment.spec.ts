/**
 * Unit tests for deleteMembershipPayment – verifies that after deleting the
 * payment docs it re-syncs the denormalized `lastPaidYear` and `membershipType`
 * fields on the user document.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Firestore mock infrastructure ──────────────────────────────────────────

type DocData = Record<string, unknown>;

const docSnapFactory = (data: DocData, id = "doc-1") => ({
  id,
  ref: { id },
  data: () => data,
});

const deleteFieldSentinel = Symbol("deleteField");

// vi.hoisted ensures these are initialized before vi.mock hoisting runs
const { deleteDocMock, setDocMock, getDocMock, getDocsMock } = vi.hoisted(
  () => ({
    deleteDocMock: vi.fn().mockResolvedValue(undefined),
    setDocMock: vi.fn().mockResolvedValue(undefined),
    getDocMock: vi.fn(),
    getDocsMock: vi.fn(),
  }),
);

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => "col"),
  query: vi.fn((...args: unknown[]) => ({ args })),
  where: vi.fn((...a: unknown[]) => a),
  orderBy: vi.fn((...a: unknown[]) => a),
  limit: vi.fn((n: number) => n),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  doc: vi.fn((_db: unknown, _col: string, id: string) => ({ id })),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
  deleteField: vi.fn(() => deleteFieldSentinel),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock("@/config/firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "admin-uid" } },
}));

vi.mock("@/utils/firestoreLogger", () => ({
  logFsStart: vi.fn(),
  logFsSuccess: vi.fn(),
  logFsError: vi.fn(),
}));

// Import AFTER mocks are registered
import { deleteMembershipPayment } from "@/api/membership";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("deleteMembershipPayment – user doc sync", () => {
  const userId = "user-123";
  const year = 2026;

  const paymentDoc = docSnapFactory({ userId, year, purpose: "dues" });

  beforeEach(() => {
    deleteDocMock.mockClear();
    setDocMock.mockClear();
    getDocsMock.mockClear();
    getDocMock.mockClear();
  });

  it("deletes all dues payment docs for the given user/year", async () => {
    getDocsMock.mockResolvedValueOnce({ docs: [paymentDoc], size: 1 });
    getDocMock.mockResolvedValueOnce({ data: () => ({}) });

    await deleteMembershipPayment({ userId, year });

    expect(deleteDocMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT update user doc when lastPaidYear differs from deleted year", async () => {
    getDocsMock.mockResolvedValueOnce({ docs: [paymentDoc], size: 1 });
    getDocMock.mockResolvedValueOnce({
      data: () => ({ lastPaidYear: 2025, membershipType: "full" }),
    });

    await deleteMembershipPayment({ userId, year });

    expect(setDocMock).not.toHaveBeenCalled();
  });

  it("clears lastPaidYear and membershipType when no prior confirmed payments remain", async () => {
    getDocsMock
      .mockResolvedValueOnce({ docs: [paymentDoc], size: 1 }) // target year docs
      .mockResolvedValueOnce({ docs: [], empty: true }); // no prior payments
    getDocMock.mockResolvedValueOnce({
      data: () => ({ lastPaidYear: year, membershipType: "full" }),
    });

    await deleteMembershipPayment({ userId, year });

    expect(setDocMock).toHaveBeenCalledTimes(1);
    const [, payload] = setDocMock.mock.calls[0] as [unknown, DocData, unknown];
    expect(payload.lastPaidYear).toBe(deleteFieldSentinel);
    expect(payload.membershipType).toBe(deleteFieldSentinel);
  });

  it("rolls back to the most recent prior confirmed payment year and membershipType", async () => {
    const prevDoc = docSnapFactory(
      { year: 2025, membershipType: "handicap" },
      "prev-1",
    );
    getDocsMock
      .mockResolvedValueOnce({ docs: [paymentDoc], size: 1 })
      .mockResolvedValueOnce({ docs: [prevDoc], empty: false });
    getDocMock.mockResolvedValueOnce({
      data: () => ({ lastPaidYear: year, membershipType: "full" }),
    });

    await deleteMembershipPayment({ userId, year });

    expect(setDocMock).toHaveBeenCalledTimes(1);
    const [, payload] = setDocMock.mock.calls[0] as [unknown, DocData, unknown];
    expect(payload.lastPaidYear).toBe(2025);
    expect(payload.membershipType).toBe("handicap");
  });

  it("uses deleteField for membershipType when prior payment has no membershipType", async () => {
    const prevDoc = docSnapFactory({ year: 2024 }, "prev-2"); // no membershipType field
    getDocsMock
      .mockResolvedValueOnce({ docs: [paymentDoc], size: 1 })
      .mockResolvedValueOnce({ docs: [prevDoc], empty: false });
    getDocMock.mockResolvedValueOnce({
      data: () => ({ lastPaidYear: year, membershipType: "full" }),
    });

    await deleteMembershipPayment({ userId, year });

    const [, payload] = setDocMock.mock.calls[0] as [unknown, DocData, unknown];
    expect(payload.lastPaidYear).toBe(2024);
    expect(payload.membershipType).toBe(deleteFieldSentinel);
  });
});
