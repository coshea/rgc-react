import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: resolve(__dirname, "src") },
      { find: "@@", replacement: resolve(__dirname, "functions/src") },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    deps: {
      // Force framer-motion through Vitest's module transformer so that
      // vi.mock("framer-motion") in test-setup.ts reliably intercepts it
      // on all platforms (including CI/Linux where ESM path resolution
      // differs from macOS and would bypass the mock registry).
      inline: ["framer-motion"],
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
