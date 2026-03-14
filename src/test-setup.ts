// Global test setup: mock expensive or environment-incompatible modules.
import React from "react";
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Polyfill CSS.escape used by @react-aria in jsdom
vi.stubGlobal("CSS", { escape: (s: string) => s });

// Node.js 25 introduces `--localstorage-file` which conflicts with jsdom's
// localStorage implementation, causing `localStorage.getItem` to not be a
// function. Stub out the Web Storage API with a simple in-memory Map.
(function stubWebStorage() {
  function makeStorage() {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    };
  }
  vi.stubGlobal("localStorage", makeStorage());
  vi.stubGlobal("sessionStorage", makeStorage());
})();

// Mock reCAPTCHA to always succeed in tests by default
vi.mock("@/utils/recaptcha", () => ({
  executeRecaptcha: vi.fn().mockResolvedValue("mock-token"),
  RECAPTCHA_SITE_KEY: "mock-key",
}));

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
