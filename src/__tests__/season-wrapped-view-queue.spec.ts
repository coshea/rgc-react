import { describe, expect, it, vi } from "vitest";

const transactions: Array<() => void> = [];
const writes: Array<Record<string, unknown>> = [];
let stored: Record<string, unknown> | null = null;

vi.mock("@/config/firebase", () => ({ db: {}, functions: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: () => "ts",
  // Each transaction waits until the test lets it finish, like a slow commit.
  runTransaction: vi.fn(
    (_db: unknown, fn: (tx: unknown) => Promise<void>) =>
      new Promise<void>((resolve) => {
        transactions.push(() => {
          const snapshot = stored;
          void fn({
            get: async () => ({ exists: () => !!snapshot, data: () => snapshot }),
            set: (_ref: unknown, data: Record<string, unknown>) => {
              stored = data;
              writes.push(data);
            },
          }).then(resolve);
        });
      }),
  ),
}));

vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("recordWrappedView", () => {
  it("runs writes for the same story one at a time, in order", async () => {
    const { recordWrappedView } = await import("@/api/seasonWrapped");
    const base = { source: "push" as const, cardCount: 12 };

    const first = recordWrappedView(2026, "me", { ...base, newOpen: true, card: 1 });
    const second = recordWrappedView(2026, "me", { ...base, newOpen: false, card: 2 });
    const third = recordWrappedView(2026, "me", { ...base, newOpen: false, card: 3 });
    await flush();

    // Only the first transaction has started.
    expect(transactions).toHaveLength(1);
    transactions[0]();
    await first;
    await flush();
    expect(transactions).toHaveLength(2);
    transactions[1]();
    await second;
    await flush();
    transactions[2]();
    await third;

    expect(writes.map((w) => w.furthestCard)).toEqual([1, 2, 3]);
    expect(writes.map((w) => w.openCount)).toEqual([1, 1, 1]);
  });
});
