import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => {
  const indexedDBLocalPersistence = { name: "indexeddb" };
  const browserLocalPersistence = { name: "local" };
  const inMemoryPersistence = { name: "memory" };

  return {
    initializeAuth: vi.fn(() => ({ __auth: true })),
    setPersistence: vi.fn(async () => undefined),
    indexedDBLocalPersistence,
    browserLocalPersistence,
    inMemoryPersistence,
  };
});

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({ __app: true })),
}));

vi.mock("firebase/auth", () => ({
  initializeAuth: authMocks.initializeAuth,
  setPersistence: authMocks.setPersistence,
  indexedDBLocalPersistence: authMocks.indexedDBLocalPersistence,
  browserLocalPersistence: authMocks.browserLocalPersistence,
  inMemoryPersistence: authMocks.inMemoryPersistence,
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({ __db: true })),
}));

vi.mock("firebase/storage", () => ({
  getStorage: vi.fn(() => ({ __storage: true })),
}));

vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => ({ __functions: true })),
}));

vi.mock("firebase/analytics", () => ({
  getAnalytics: vi.fn(() => ({ __analytics: true })),
  isSupported: vi.fn(async () => false),
}));

async function loadFirebaseModule() {
  return import("@/config/firebase");
}

describe("withAuthPersistenceRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns immediately when operation succeeds", async () => {
    const { withAuthPersistenceRetry } = await loadFirebaseModule();
    const operation = vi.fn(async () => "ok");

    await expect(withAuthPersistenceRetry(operation)).resolves.toBe("ok");

    expect(operation).toHaveBeenCalledTimes(1);
    expect(authMocks.setPersistence).not.toHaveBeenCalled();
  });

  it("retries once and downgrades to browser local persistence on app/idb-set", async () => {
    const { withAuthPersistenceRetry } = await loadFirebaseModule();

    const idbError = new Error("Firebase: app/idb-set");
    (idbError as Error & { code?: string }).code = "app/idb-set";

    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(idbError)
      .mockResolvedValueOnce("recovered");

    await expect(withAuthPersistenceRetry(operation)).resolves.toBe(
      "recovered",
    );

    expect(operation).toHaveBeenCalledTimes(2);
    expect(authMocks.setPersistence).toHaveBeenCalledTimes(1);
    expect(authMocks.setPersistence).toHaveBeenCalledWith(
      expect.anything(),
      authMocks.browserLocalPersistence,
    );
  });

  it("falls back to in-memory persistence if browser local persistence fails", async () => {
    const { withAuthPersistenceRetry } = await loadFirebaseModule();

    const idbError = new Error(
      "Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.",
    );
    (idbError as Error & { code?: string }).code = "app/idb-set";

    authMocks.setPersistence
      .mockRejectedValueOnce(new Error("local persistence failed"))
      .mockResolvedValueOnce(undefined);

    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(idbError)
      .mockResolvedValueOnce("recovered");

    await expect(withAuthPersistenceRetry(operation)).resolves.toBe(
      "recovered",
    );

    expect(authMocks.setPersistence).toHaveBeenCalledTimes(2);
    expect(authMocks.setPersistence).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      authMocks.browserLocalPersistence,
    );
    expect(authMocks.setPersistence).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      authMocks.inMemoryPersistence,
    );
  });

  it("rethrows non-IndexedDB errors without retry", async () => {
    const { withAuthPersistenceRetry } = await loadFirebaseModule();
    const nonIdbError = new Error("network down");

    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(nonIdbError);

    await expect(withAuthPersistenceRetry(operation)).rejects.toThrow(
      "network down",
    );

    expect(operation).toHaveBeenCalledTimes(1);
    expect(authMocks.setPersistence).not.toHaveBeenCalled();
  });
});
