import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIRESTORE_RECOVERY_COOLDOWN_MS,
  isFirestoreCacheFailure,
  reloadForFirestoreCacheFailure,
} from "@/utils/firestoreCacheRecovery";

describe("isFirestoreCacheFailure", () => {
  it.each([
    'FIRESTORE (12.19.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: b815) CONTEXT: {"tl":"Attempt to open a cursor in database without an in-progress transaction"}',
    "UnknownError: Attempt to get all index records from database without an in-progress transaction",
    "IndexedDB transaction 'createOrUpgrade' failed: UnknownError: Database deleted by request of the user",
  ])("matches %s", (message) => {
    expect(isFirestoreCacheFailure(message)).toBe(true);
  });

  it.each([
    "Missing or insufficient permissions.",
    "Failed to fetch dynamically imported module",
    "The client has already been terminated.",
  ])("ignores %s", (message) => {
    expect(isFirestoreCacheFailure(message)).toBe(false);
  });
});

describe("reloadForFirestoreCacheFailure", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("reloads once, then not again within the cooldown", () => {
    const reload = vi.fn();
    const now = 1_000_000;
    expect(reloadForFirestoreCacheFailure("x", now, reload)).toBe(true);
    expect(reloadForFirestoreCacheFailure("x", now + 1000, reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads again after the cooldown", () => {
    const reload = vi.fn();
    const now = 1_000_000;
    reloadForFirestoreCacheFailure("x", now, reload);
    expect(
      reloadForFirestoreCacheFailure(
        "x",
        now + FIRESTORE_RECOVERY_COOLDOWN_MS + 1,
        reload,
      ),
    ).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("never reloads without sessionStorage (no loop guard)", () => {
    const reload = vi.fn();
    vi.spyOn(window.sessionStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(reloadForFirestoreCacheFailure("x", 1, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
