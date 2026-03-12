import { describe, it, expect, vi, afterEach } from "vitest";
import { Timestamp } from "firebase/firestore";
import type { AppNotification } from "@/types/notification";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotification(
  overrides: Partial<AppNotification> = {},
): AppNotification {
  return {
    id: "notif-1",
    uid: "user-123",
    title: "Test",
    body: "Test body",
    type: "general",
    read: false,
    createdAt: Timestamp.fromDate(new Date()),
    expiresAt: Timestamp.fromDate(
      new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    ),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Module reset between tests
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useNotifications", () => {
  it("returns empty notifications and zero unreadCount when uid is null", async () => {
    vi.doMock("@/config/firebase", () => ({ db: {} }));
    vi.doMock("firebase/firestore", () => ({
      collection: vi.fn(),
      query: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      limit: vi.fn(),
      onSnapshot: vi.fn(() => () => {}),
      doc: vi.fn(),
      updateDoc: vi.fn(),
      deleteDoc: vi.fn(),
      writeBatch: vi.fn(),
    }));

    const { renderHook } = await import("@testing-library/react");
    const { useNotifications } = await import("@/hooks/useNotifications");

    const { result } = renderHook(() => useNotifications(null));

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it("populates notifications from onSnapshot and computes unreadCount", async () => {
    const n1 = makeNotification({ id: "a", read: false });
    const n2 = makeNotification({ id: "b", read: true });
    const n3 = makeNotification({ id: "c", read: false });

    let capturedNext: ((snap: object) => void) | undefined;

    vi.doMock("@/config/firebase", () => ({ db: {} }));
    vi.doMock("firebase/firestore", () => ({
      collection: vi.fn(() => ({})),
      query: vi.fn(() => ({})),
      where: vi.fn(() => ({})),
      orderBy: vi.fn(() => ({})),
      limit: vi.fn(() => ({})),
      onSnapshot: vi.fn((_, next: (snap: object) => void) => {
        capturedNext = next;
        return () => {};
      }),
      doc: vi.fn(),
      updateDoc: vi.fn(),
      deleteDoc: vi.fn(),
      writeBatch: vi.fn(),
    }));

    const { renderHook, act } = await import("@testing-library/react");
    const { useNotifications } = await import("@/hooks/useNotifications");

    const { result } = renderHook(() => useNotifications("user-123"));

    // Emit snapshot
    await act(async () => {
      capturedNext?.({
        docs: [
          { id: "a", data: () => ({ ...n1, id: undefined }) },
          { id: "b", data: () => ({ ...n2, id: undefined }) },
          { id: "c", data: () => ({ ...n3, id: undefined }) },
        ],
      });
    });

    expect(result.current.notifications).toHaveLength(3);
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.loading).toBe(false);
  });

  it("markRead calls updateDoc with { read: true }", async () => {
    const updateDoc = vi.fn();
    const docRef = { path: "notifications/notif-1" };

    vi.doMock("@/config/firebase", () => ({ db: {} }));
    vi.doMock("firebase/firestore", () => ({
      collection: vi.fn(() => ({})),
      query: vi.fn(() => ({})),
      where: vi.fn(() => ({})),
      orderBy: vi.fn(() => ({})),
      limit: vi.fn(() => ({})),
      onSnapshot: vi.fn(() => () => {}),
      doc: vi.fn(() => docRef),
      updateDoc,
      deleteDoc: vi.fn(),
      writeBatch: vi.fn(),
    }));

    const { renderHook } = await import("@testing-library/react");
    const { useNotifications } = await import("@/hooks/useNotifications");

    const { result } = renderHook(() => useNotifications("user-123"));
    await result.current.markRead("notif-1");

    expect(updateDoc).toHaveBeenCalledWith(docRef, { read: true });
  });

  it("dismissNotification calls deleteDoc", async () => {
    const deleteDoc = vi.fn();
    const docRef = { path: "notifications/notif-1" };

    vi.doMock("@/config/firebase", () => ({ db: {} }));
    vi.doMock("firebase/firestore", () => ({
      collection: vi.fn(() => ({})),
      query: vi.fn(() => ({})),
      where: vi.fn(() => ({})),
      orderBy: vi.fn(() => ({})),
      limit: vi.fn(() => ({})),
      onSnapshot: vi.fn(() => () => {}),
      doc: vi.fn(() => docRef),
      updateDoc: vi.fn(),
      deleteDoc,
      writeBatch: vi.fn(),
    }));

    const { renderHook } = await import("@testing-library/react");
    const { useNotifications } = await import("@/hooks/useNotifications");

    const { result } = renderHook(() => useNotifications("user-123"));
    await result.current.dismissNotification("notif-1");

    expect(deleteDoc).toHaveBeenCalledWith(docRef);
  });

  it("clearAll calls batch.update for each unread notification then commit", async () => {
    const batchUpdate = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    const batch = { update: batchUpdate, commit: batchCommit };

    const n1 = makeNotification({ id: "a", read: false });
    const n2 = makeNotification({ id: "b", read: false });

    let capturedNext: ((snap: object) => void) | undefined;

    vi.doMock("@/config/firebase", () => ({ db: {} }));
    vi.doMock("firebase/firestore", () => ({
      collection: vi.fn(() => ({})),
      query: vi.fn(() => ({})),
      where: vi.fn(() => ({})),
      orderBy: vi.fn(() => ({})),
      limit: vi.fn(() => ({})),
      onSnapshot: vi.fn((_, next: (snap: object) => void) => {
        capturedNext = next;
        return () => {};
      }),
      doc: vi.fn((_, _c: string, id: string) => ({
        path: `notifications/${id}`,
      })),
      updateDoc: vi.fn(),
      deleteDoc: vi.fn(),
      writeBatch: vi.fn(() => batch),
    }));

    const { renderHook, act } = await import("@testing-library/react");
    const { useNotifications } = await import("@/hooks/useNotifications");

    const { result } = renderHook(() => useNotifications("user-123"));

    await act(async () => {
      capturedNext?.({
        docs: [
          { id: "a", data: () => ({ ...n1, id: undefined }) },
          { id: "b", data: () => ({ ...n2, id: undefined }) },
        ],
      });
    });

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(batchUpdate).toHaveBeenCalledTimes(2);
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });
});
