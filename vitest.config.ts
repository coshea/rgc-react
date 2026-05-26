import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: resolve(__dirname, "src") },
      { find: "@@", replacement: resolve(__dirname, "functions/src") },
      {
        find: "tailwind-variants",
        replacement: resolve(
          __dirname,
          "node_modules/@heroui/react/node_modules/tailwind-variants/dist/index.js",
        ),
      },
      // Bypass package.json exports field resolution for @heroui-pro subpaths,
      // which fails on Linux CI (vite:import-analysis can't resolve them) even
      // though vi.mock() would intercept the load. Aliasing directly to the
      // compiled file lets static analysis succeed in all environments.
      {
        find: "@heroui-pro/react/stepper",
        replacement: resolve(
          __dirname,
          "node_modules/@heroui-pro/react/dist/components/stepper/index.js",
        ),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    deps: {
      // Force framer-motion and HeroUI through Vitest's module transformer so
      // that vi.mock("framer-motion") in test-setup.ts reliably intercepts it
      // on all platforms (including CI/Linux where ESM path resolution differs
      // from macOS and would bypass the mock registry).
      // @heroui packages must also be inlined: they import framer-motion
      // internally, and if @heroui loads as native ESM those sub-imports
      // bypass the mock registry, causing LazyMotion async work to fire
      // after jsdom teardown ("window is not defined").
      inline: [/framer-motion/, /@heroui/, /tailwind-variants/],
    },
    // Explicitly exclude compiled output and node_modules so Vitest doesn't pick
    // up tests from dependencies or built artifacts (these were running in
    // the pre-commit hook and causing unrelated failures).
    exclude: [
      "node_modules/**",
      "functions/src/**",
      "functions/lib/**",
      "functions/node_modules/**",
    ],
  },
});
