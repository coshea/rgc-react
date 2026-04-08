// Global test setup: mock expensive or environment-incompatible modules.
import React from "react";
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Polyfill CSS.escape used by @react-aria in jsdom
vi.stubGlobal("CSS", { escape: (s: string) => s });

// Polyfill ResizeObserver which jsdom does not implement (used by @heroui/tabs and others)
vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

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

// Force HeroUI components down their non-animated code paths in tests.
vi.mock("@heroui/system", async () => {
  const actual =
    await vi.importActual<typeof import("@heroui/system")>("@heroui/system");

  return {
    ...actual,
    useProviderContext: () => ({
      ...(actual.useProviderContext?.() ?? {}),
      disableAnimation: true,
      skipFramerMotionAnimations: true,
    }),
  };
});

// Mock framer-motion so that LazyMotion (used internally by HeroUI) never
// schedules async feature-loading work that can fire after jsdom teardown.
vi.mock("framer-motion", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    children ?? null;

  const el = (tag: string) =>
    React.forwardRef<
      Element,
      React.HTMLAttributes<Element> & { children?: React.ReactNode }
    >(({ children, ...props }, ref) =>
      React.createElement(tag, { ...props, ref }, children),
    );

  const motionProxy = new Proxy({} as Record<string, unknown>, {
    get: (_t, tag: string | symbol) =>
      typeof tag === "string" ? el(tag) : undefined,
  });

  return {
    LazyMotion: passthrough,
    AnimatePresence: passthrough,
    MotionConfig: passthrough,
    MotionGlobalConfig: { skipAnimations: true },
    LayoutGroup: passthrough,
    motion: motionProxy,
    m: motionProxy,
    domAnimation: {},
    domMax: {},
    useMotionValue: (initial = 0) => ({
      get: () => initial,
      set: vi.fn(),
      onChange: vi.fn(),
    }),
    useTransform: () => ({ get: () => 0 }),
    useSpring: (initial = 0) => ({ get: () => initial, set: vi.fn() }),
    useReducedMotion: () => false,
    useAnimationControls: () => ({ start: vi.fn(), stop: vi.fn() }),
    useInView: () => false,
    useIsPresent: () => true,
    usePresence: () => [true, vi.fn()],
    useScroll: () => ({
      scrollX: { get: () => 0 },
      scrollY: { get: () => 0 },
    }),
  };
});

// Cleanup after each test to prevent memory leaks and unhandled promises
afterEach(() => {
  cleanup();
});
