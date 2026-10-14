import { describe, it, expect, vi, beforeEach } from "vitest";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/react", () => ({ captureException }));

import { reportListenerError } from "@/utils/firebaseErrors";

describe("reportListenerError", () => {
  beforeEach(() => {
    captureException.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reports permission-denied to Sentry with the listener tag", () => {
    const err = Object.assign(new Error("Missing or insufficient permissions."), {
      code: "permission-denied",
    });
    reportListenerError("bracket", err);
    expect(captureException).toHaveBeenCalledWith(err, {
      tags: { error_type: "firestore_listener_denied", listener: "bracket" },
    });
  });

  it("only logs transient errors such as unavailable", () => {
    const err = Object.assign(new Error("offline"), { code: "unavailable" });
    reportListenerError("bracket", err);
    expect(captureException).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
