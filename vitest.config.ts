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
