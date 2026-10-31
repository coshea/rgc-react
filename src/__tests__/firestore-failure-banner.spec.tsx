import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { FirestoreFailureBanner } from "@/components/firestore-failure-banner";
import { isFirestoreCacheFailure } from "@/utils/firebaseErrors";

const assertionError = new Error(
  'FIRESTORE (12.19.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: b815) CONTEXT: {"tl":"Attempt to get all index records from database without an in-progress transaction"}',
);

function dispatchRejection(reason: unknown) {
  // jsdom has no PromiseRejectionEvent constructor.
  const event = new Event("unhandledrejection");
  Object.assign(event, { reason });
  window.dispatchEvent(event);
}

describe("isFirestoreCacheFailure", () => {
  it("matches the iOS IndexedDB failures Firestore reports", () => {
    expect(isFirestoreCacheFailure(assertionError)).toBe(true);
    expect(
      isFirestoreCacheFailure(
        new Error(
          "UnknownError: Attempt to get all index records from database without an in-progress transaction",
        ),
      ),
    ).toBe(true);
    const txError = Object.assign(
      new Error(
        "IndexedDB transaction 'createOrUpgrade' failed: UnknownError: Database deleted by request of the user",
      ),
      { name: "IndexedDbTransactionError" },
    );
    expect(isFirestoreCacheFailure(txError)).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isFirestoreCacheFailure(new Error("Missing or insufficient permissions."))).toBe(false);
    expect(isFirestoreCacheFailure("INTERNAL ASSERTION FAILED")).toBe(false);
    expect(isFirestoreCacheFailure(null)).toBe(false);
  });
});

describe("FirestoreFailureBanner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing until Firestore fails", () => {
    render(<FirestoreFailureBanner />);
    act(() => dispatchRejection(new Error("something unrelated")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("appears on an unhandled Firestore cache rejection", () => {
    render(<FirestoreFailureBanner />);
    act(() => dispatchRejection(assertionError));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /something went wrong loading club data/i,
    );
  });

  it("appears on a thrown Firestore assertion and reloads on press", () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      reload,
    });
    render(<FirestoreFailureBanner />);
    act(() => {
      window.dispatchEvent(new ErrorEvent("error", { error: assertionError }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalled();
  });
});
