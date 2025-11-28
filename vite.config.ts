import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths(), tailwindcss()],
  define: {
    // EmailJS configuration from environment variables
    "import.meta.env.VITE_EMAILJS_SERVICE_ID": JSON.stringify(
      process.env.EMAILJS_SERVICE_ID || process.env.VITE_EMAILJS_SERVICE_ID
    ),
    "import.meta.env.VITE_EMAILJS_TEMPLATE_ID": JSON.stringify(
      process.env.EMAILJS_TEMPLATE_ID || process.env.VITE_EMAILJS_TEMPLATE_ID
    ),
    "import.meta.env.VITE_EMAILJS_PUBLIC_KEY": JSON.stringify(
      process.env.EMAILJS_PUBLIC_KEY || process.env.VITE_EMAILJS_PUBLIC_KEY
    ),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Firebase SDK modules so they don't bloat the main bundle
          "vendor-firebase-auth": ["firebase/auth"],
          "vendor-firebase-firestore": ["firebase/firestore"],
          "vendor-firebase-storage": ["firebase/storage"],
          // Core react and router
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // UI libs
          "vendor-ui": [
            "@heroui/react",
            "@heroicons/react",
            "@iconify/react",
            "framer-motion",
          ],
          // Data/query
          "vendor-query": [
            "@tanstack/react-query",
            "@tanstack/react-query-devtools",
          ],
          // Markdown rendering
          "vendor-markdown": ["react-markdown", "remark-gfm"],
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
});
