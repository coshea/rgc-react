import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {},
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    sentryVitePlugin({
      org: "ridgefield-golf-club",
      project: "javascript-react",
    }),
  ],
  build: {
    rolldownOptions: {
      onwarn(warning, warn) {
        // Suppress sourcemap warnings from third-party packages with missing source files
        if (warning.code === "SOURCEMAP_ERROR") return;
        warn(warning);
      },
      output: {
        codeSplitting: {
          groups: [
            {
              test: /node_modules\/firebase\/auth/,
              name: "vendor-firebase-auth",
            },
            {
              test: /node_modules\/firebase\/firestore/,
              name: "vendor-firebase-firestore",
            },
            {
              test: /node_modules\/firebase\/storage/,
              name: "vendor-firebase-storage",
            },
            {
              test: /node_modules\/firebase\/messaging/,
              name: "vendor-firebase-messaging",
            },
            {
              test: /node_modules\/(react-markdown|remark-gfm)/,
              name: "vendor-markdown",
            },
            {
              test: /node_modules\/@tanstack\/react-query/,
              name: "vendor-query",
            },
            {
              test: /node_modules\/(@heroui\/react|@heroicons\/react|@iconify\/react|framer-motion)/,
              name: "vendor-ui",
            },
            {
              test: /node_modules\/(react|react-dom|react-router-dom)/,
              name: "vendor-react",
            },
          ],
        },
      },
    },

    chunkSizeWarningLimit: 1200,
    sourcemap: true,
  },
});
