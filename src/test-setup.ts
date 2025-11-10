// Global test setup: mock expensive or environment-incompatible modules.
import React from "react";
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Mock @iconify/react with a lightweight functional component that does not schedule timers.
vi.mock("@iconify/react", () => {
  const Icon = (props: any) =>
    React.createElement("span", {
      "data-icon": props.icon || "mock-icon",
      className: props.className || "",
    });
  return { Icon, default: Icon } as any;
});

// Cleanup after each test to prevent memory leaks and unhandled promises
afterEach(() => {
  cleanup();
  // Flush microtasks to let framer-motion complete pending state updates
  return new Promise((resolve) => setImmediate(resolve));
});
