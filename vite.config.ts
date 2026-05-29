import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {},
  resolve: {
    tsconfigPaths: true,
    alias: {
      // @heroui-pro/react requires tailwind-variants v3+ (exports cx); alias to
      // the version already bundled alongside @heroui/react.
      "tailwind-variants": path.resolve(
        __dirname,
        "node_modules/@heroui/react/node_modules/tailwind-variants",
      ),
    },
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
          if (/node_modules\/firebase\/messaging/.test(id))
            return "vendor-firebase-messaging";
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
