import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase config/auth
vi.mock("@/config/firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "u1" } },
  getAnalyticsInstance: () => null,
}));

const { addDocMock, collectionMock, serverTimestampMock, docMock, getDocMock } =
  vi.hoisted(() => {
    const addDocMock = vi.fn<
      (
        col: unknown,
        payload: Record<string, unknown>,
      ) => Promise<{ id: string }>
    >(async () => ({ id: "new-id" }));
    const collectionMock = vi.fn<(db: unknown, path: string) => unknown>(
      () => ({}),
    );
    const serverTimestampMock = vi.fn<() => unknown>(() => ({ __ts: true }));

    // Needed because src/utils/admin.ts imports these at module eval time.
    const docMock = vi.fn(() => ({ __doc: true }));
    const getDocMock = vi.fn(async () => ({
      exists: () => false,
      data: () => ({}),
    }));

    return {
      addDocMock,
      collectionMock,
      serverTimestampMock,
      docMock,
      getDocMock,
    };
  });

vi.mock("firebase/firestore", () => ({
  addDoc: addDocMock,
  collection: collectionMock,
  serverTimestamp: serverTimestampMock,
  doc: docMock,
  getDoc: getDocMock,
}));

import { createPartnerPost } from "@/api/find-a-game";

describe("createPartnerPost", () => {
  beforeEach(() => {
    addDocMock.mockClear();
    collectionMock.mockClear();
    serverTimestampMock.mockClear();
  });

  it("does not write time/openSpots for needGroup", async () => {
    await createPartnerPost({
      type: "needGroup",
      date: "2099-01-02",
      time: "09:00", // should be ignored for needGroup
      openSpots: 3,
    });

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const call = addDocMock.mock.calls[0];
    expect(call).toBeTruthy();
    const payload = call[1];

    expect(payload.type).toBe("needGroup");
    expect(payload.date).toBe("2099-01-02");
    expect(payload.ownerId).toBe("u1");
    expect(payload).not.toHaveProperty("time");
    expect(payload).not.toHaveProperty("openSpots");
  });

  it("writes openSpots and trims time for needPlayers", async () => {
    await createPartnerPost({
      type: "needPlayers",
      date: "2099-01-02",
      time: " 09:00 ",
      openSpots: 2,
    });

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const call = addDocMock.mock.calls[0];
    expect(call).toBeTruthy();
    const payload = call[1];
    expect(payload.type).toBe("needPlayers");
    expect(payload.time).toBe("09:00");
    expect(payload.openSpots).toBe(2);
  });

  it("rejects non-integer openSpots for needPlayers", async () => {
    await expect(
      createPartnerPost({
        type: "needPlayers",
        date: "2099-01-02",
        time: "09:00",
        openSpots: Number(""), // NaN
      }),
    ).rejects.toThrow(/Open spots must be an integer/i);

    expect(addDocMock).not.toHaveBeenCalled();
  });
});
