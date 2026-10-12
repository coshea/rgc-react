/**
 * Unit tests for fetchUserUpcomingRegistrations – verifies it finds the user
 * as captain or teammate via collectionGroup queries, dedupes a captain
 * matched by both queries, reads each tournament once, and skips past,
 * completed and canceled tournaments.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type DocData = Record<string, unknown>;
type Constraint = { field: string; op: string; value: unknown };
type MockQuery = { col: string; constraints: Constraint[] };

const { getDocsMock, getDocMock, captureExceptionMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  getDocMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, ...path: string[]) => path.join("/")),
  collectionGroup: vi.fn((_db: unknown, id: string) => `group:${id}`),
  query: vi.fn((col: string, ...constraints: Constraint[]) => ({
    col,
    constraints,
  })),
  where: vi.fn((field: string, op: string, value: unknown) => ({
    field,
    op,
    value,
  })),
  orderBy: vi.fn((field: string) => ({ field, op: "orderBy", value: null })),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  doc: vi.fn((_db: unknown, ...path: string[]) => path.join("/")),
  onSnapshot: vi.fn(),
  deleteDoc: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  getCountFromServer: vi.fn(),
  FirestoreError: class {},
}));

vi.mock("@/config/firebase", () => ({ db: {} }));

vi.mock("@sentry/react", () => ({
  startSpan: (_opts: unknown, cb: () => unknown) => cb(),
  captureException: captureExceptionMock,
}));

import { fetchUserUpcomingRegistrations } from "@/api/tournaments";

const ts = (iso: string) => ({ toDate: () => new Date(iso) });

const tournaments: Record<string, DocData> = {
  "t-open": { title: "Member-Guest", date: ts("2099-10-18T00:00:00Z") },
  "t-later": { title: "Turkey Shoot", date: "2099-11-20" },
  "t-past": { title: "Spring Scramble", date: ts("2000-04-01T00:00:00Z") },
  "t-canceled": {
    title: "Rained Out",
    date: ts("2099-10-25T00:00:00Z"),
    status: "Canceled",
  },
};

const regSnap = (tournamentId: string, id: string, data: DocData) => ({
  id,
  data: () => data,
  ref: {
    path: `tournaments/${tournamentId}/registrations/${id}`,
    parent: { parent: { id: tournamentId } },
  },
});

const registrations = [
  regSnap("t-later", "r-teammate", {
    ownerId: "pal",
    memberIds: ["pal", "me"],
    team: [
      { id: "pal", displayName: "Pal" },
      { id: "me", displayName: "Me" },
    ],
  }),
  regSnap("t-open", "r-captain", {
    ownerId: "me",
    memberIds: ["me", "pal"],
    team: [
      { id: "me", displayName: "Me" },
      { id: "pal", displayName: "Pal" },
    ],
  }),
  // Same doc ID in a different tournament must not be conflated.
  regSnap("t-later", "r-captain", {
    ownerId: "me",
    memberIds: ["me"],
    team: [{ id: "me", displayName: "Me" }],
  }),
  regSnap("t-later", "r-other", {
    ownerId: "x",
    memberIds: ["x", "y"],
    team: [],
  }),
  regSnap("t-past", "r-past", { ownerId: "me", memberIds: ["me"], team: [] }),
  regSnap("t-canceled", "r-canceled", {
    ownerId: "me",
    memberIds: ["me"],
    team: [],
  }),
];

function matches(d: ReturnType<typeof regSnap>, c: Constraint) {
  const value = d.data()[c.field];
  if (c.op === "==") return value === c.value;
  if (c.op === "array-contains")
    return Array.isArray(value) && value.includes(c.value);
  return true;
}

beforeEach(() => {
  getDocsMock.mockReset();
  getDocMock.mockReset();
  captureExceptionMock.mockReset();
  getDocsMock.mockImplementation(async (q: MockQuery) => ({
    docs: registrations.filter((d) =>
      q.constraints.every((c) => matches(d, c)),
    ),
  }));
  getDocMock.mockImplementation(async (path: string) => {
    const id = path.split("/")[1];
    const data = tournaments[id];
    return { id, exists: () => data !== undefined, data: () => data };
  });
});

describe("fetchUserUpcomingRegistrations", () => {
  it("queries registrations by ownerId and memberIds across tournaments", async () => {
    await fetchUserUpcomingRegistrations("me");
    const queries = getDocsMock.mock.calls.map((c) => c[0] as MockQuery);
    expect(queries.map((q) => q.col)).toEqual([
      "group:registrations",
      "group:registrations",
    ]);
    expect(queries.flatMap((q) => q.constraints)).toEqual([
      { field: "ownerId", op: "==", value: "me" },
      { field: "memberIds", op: "array-contains", value: "me" },
    ]);
  });

  it("returns captain and teammate registrations for upcoming tournaments, sorted by date", async () => {
    const result = await fetchUserUpcomingRegistrations("me");
    expect(
      result.map((r) => `${r.tournament.firestoreId}/${r.registration.id}`),
    ).toEqual(["t-open/r-captain", "t-later/r-captain", "t-later/r-teammate"]);
    expect(result[2].registration.ownerId).toBe("pal");
    expect(result[0].tournament.title).toBe("Member-Guest");
  });

  it("reads each referenced tournament once", async () => {
    await fetchUserUpcomingRegistrations("me");
    const paths = getDocMock.mock.calls.map((c) => c[0] as string).sort();
    expect(paths).toEqual([
      "tournaments/t-canceled",
      "tournaments/t-later",
      "tournaments/t-open",
      "tournaments/t-past",
    ]);
  });

  it("returns an empty list without reading tournaments when the user has no registrations", async () => {
    const result = await fetchUserUpcomingRegistrations("nobody");
    expect(result).toEqual([]);
    expect(getDocMock).not.toHaveBeenCalled();
  });

  it("reports and rethrows Firestore errors instead of returning an empty list", async () => {
    const err = new Error("permission-denied");
    getDocsMock.mockRejectedValueOnce(err);
    await expect(fetchUserUpcomingRegistrations("me")).rejects.toBe(err);
    expect(captureExceptionMock).toHaveBeenCalledWith(err);
  });
});
