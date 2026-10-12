/**
 * Unit tests for fetchUserUpcomingRegistrations – verifies it only looks at
 * upcoming tournaments, finds the user as captain or teammate, dedupes a
 * captain matched by both queries, and skips completed/canceled tournaments.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type DocData = Record<string, unknown>;
type Constraint = { field: string; op: string; value: unknown };
type MockQuery = { col: string; constraints: Constraint[] };

const { getDocsMock, captureExceptionMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, ...path: string[]) => path.join("/")),
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
  getDoc: vi.fn(),
  doc: vi.fn(),
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

const snap = (id: string, data: DocData) => ({ id, data: () => data });
const ts = (iso: string) => ({ toDate: () => new Date(iso) });

const tournaments = [
  snap("t-open", { title: "Member-Guest", date: ts("2099-10-18T00:00:00Z") }),
  snap("t-later", { title: "Turkey Shoot", date: ts("2099-11-20T00:00:00Z") }),
  snap("t-canceled", {
    title: "Rained Out",
    date: ts("2099-10-25T00:00:00Z"),
    status: "Canceled",
  }),
];

const registrations: Record<string, ReturnType<typeof snap>[]> = {
  "tournaments/t-open/registrations": [
    snap("r-captain", {
      ownerId: "me",
      memberIds: ["me", "pal"],
      team: [
        { id: "me", displayName: "Me" },
        { id: "pal", displayName: "Pal" },
      ],
    }),
  ],
  "tournaments/t-later/registrations": [
    snap("r-other", {
      ownerId: "x",
      memberIds: ["x", "y"],
      team: [
        { id: "x", displayName: "X" },
        { id: "y", displayName: "Y" },
      ],
    }),
    // Admin-edited before memberIds was kept in sync: only `team` lists "me".
    snap("r-legacy", {
      ownerId: "pal2",
      team: [
        { id: "pal2", displayName: "Pal 2" },
        { id: "me", displayName: "Me" },
      ],
    }),
    snap("r-teammate", {
      ownerId: "pal",
      memberIds: ["pal", "me"],
      team: [
        { id: "pal", displayName: "Pal" },
        { id: "me", displayName: "Me" },
      ],
    }),
  ],
  "tournaments/t-canceled/registrations": [
    snap("r-canceled", { ownerId: "me", memberIds: ["me"], team: [] }),
  ],
};

function matches(doc: ReturnType<typeof snap>, c: Constraint) {
  const value = doc.data()[c.field];
  if (c.op === "==") return value === c.value;
  if (c.op === "array-contains")
    return Array.isArray(value) && value.includes(c.value);
  return true;
}

beforeEach(() => {
  getDocsMock.mockReset();
  captureExceptionMock.mockReset();
  getDocsMock.mockImplementation(async (q: MockQuery | string) => {
    // A bare collection path means "read every registration".
    if (typeof q === "string") return { docs: registrations[q] ?? [] };
    if (q.col === "tournaments") return { docs: tournaments };
    const docs = (registrations[q.col] ?? []).filter((d) =>
      q.constraints.every((c) => matches(d, c)),
    );
    return { docs };
  });
});

describe("fetchUserUpcomingRegistrations", () => {
  it("queries tournaments from today forward", async () => {
    await fetchUserUpcomingRegistrations("me");
    const tournamentsQuery = getDocsMock.mock.calls[0][0] as MockQuery;
    expect(tournamentsQuery.col).toBe("tournaments");
    const dateFilter = tournamentsQuery.constraints.find(
      (c) => c.field === "date" && c.op === ">=",
    );
    expect(dateFilter?.value).toBeInstanceOf(Date);
    const d = dateFilter?.value as Date;
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
  });

  it("finds the user as captain, teammate, or on a legacy team without memberIds", async () => {
    const result = await fetchUserUpcomingRegistrations("me");
    expect(result.map((r) => r.registration.id)).toEqual([
      "r-captain",
      "r-legacy",
      "r-teammate",
    ]);
    expect(result[2].registration.ownerId).toBe("pal");
    expect(result[0].tournament.title).toBe("Member-Guest");
  });

  it("skips canceled tournaments without querying their registrations", async () => {
    await fetchUserUpcomingRegistrations("me");
    const queriedCols = getDocsMock.mock.calls.map(
      (call) => (call[0] as MockQuery).col,
    );
    expect(queriedCols).not.toContain("tournaments/t-canceled/registrations");
  });

  it("reports and rethrows Firestore errors instead of returning an empty list", async () => {
    const err = new Error("permission-denied");
    getDocsMock.mockRejectedValueOnce(err);
    await expect(fetchUserUpcomingRegistrations("me")).rejects.toBe(err);
    expect(captureExceptionMock).toHaveBeenCalledWith(err);
  });
});
