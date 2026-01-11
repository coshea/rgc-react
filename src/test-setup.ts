// Global test setup: mock expensive or environment-incompatible modules.
import React from "react";
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Polyfill CSS.escape used by @react-aria in jsdom
vi.stubGlobal("CSS", { escape: (s: string) => s });

// Mock @iconify/react with a lightweight functional component that does not schedule timers.
vi.mock("@iconify/react", () => {
  type IconProps = { icon?: string; className?: string };
  const Icon: React.FC<IconProps> = (props) =>
    React.createElement("span", {
      "data-icon": props.icon || "mock-icon",
      className: props.className || "",
    });

  return { Icon, default: Icon };
});

// Cleanup after each test to prevent memory leaks and unhandled promises
afterEach(() => {
  cleanup();
  // Flush microtasks to let framer-motion complete pending state updates
  return new Promise((resolve) => setImmediate(resolve));
});
