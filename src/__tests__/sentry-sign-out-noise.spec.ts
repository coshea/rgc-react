import { describe, expect, it } from "vitest";

import {
  isSignOutTerminationNoise,
  markFirestoreTerminatedForSignOut,
} from "@/config/sentry";

const terminated = "FirebaseError: The client has already been terminated.";

describe("isSignOutTerminationNoise", () => {
  it("keeps terminated-client errors until sign-out terminates Firestore", () => {
    expect(isSignOutTerminationNoise(terminated)).toBe(false);
  });

  it("drops them just after sign-out, and reports them again later", () => {
    markFirestoreTerminatedForSignOut(1_000);
    expect(isSignOutTerminationNoise(terminated, 2_000)).toBe(true);
    expect(isSignOutTerminationNoise("Missing or insufficient permissions.", 2_000)).toBe(false);
    expect(isSignOutTerminationNoise(terminated, 60_000)).toBe(false);
  });
});
