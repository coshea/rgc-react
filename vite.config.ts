import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const isPreviewBuild = process.env.VITE_SENTRY_ENVIRONMENT === "preview";

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
      project: "rgc-react",
      release: {
        // CI sets SENTRY_RELEASE (e.g. rgc-react@9.10.0+<sha>) so the deploy
        // step can mark the same release as deployed. Locally the plugin
        // falls back to the git SHA.
        name: process.env.SENTRY_RELEASE || undefined,
        // Preview builds must not claim commits, or each production release's
        // commit range starts at the last preview instead of the last release.
        setCommits: isPreviewBuild
          ? false
          : { auto: true, ignoreMissing: true },
      },
      sourcemaps: {
        // Maps are uploaded to Sentry for symbolication; don't ship them publicly.
        filesToDeleteAfterUpload: ["./dist/**/*.map"],
      },
    }),
  ],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress sourcemap warnings from third-party packages with missing source files
        if (warning.code === "SOURCEMAP_ERROR") return;
        warn(warning);
      },
      output: {
        manualChunks: (id) => {
          if (/node_modules\/firebase\/auth/.test(id))
            return "vendor-firebase-auth";
          if (/node_modules\/firebase\/firestore/.test(id))
            return "vendor-firebase-firestore";
          if (/node_modules\/firebase\/storage/.test(id))
            return "vendor-firebase-storage";
          if (/node_modules\/(react-markdown|remark-gfm)/.test(id))
            return "vendor-markdown";
          if (/node_modules\/@tanstack\/react-query/.test(id))
            return "vendor-query";
          if (
            /node_modules\/(@heroui\/react|@heroicons\/react|@iconify\/react|framer-motion)/.test(
              id,
            )
          )
            return "vendor-ui";
          if (/node_modules\/(react\/|react-dom\/|react-router-dom\/)/.test(id))
            return "vendor-react";
        },
      },
    },

    chunkSizeWarningLimit: 1200,
    sourcemap: true,
  },
});
