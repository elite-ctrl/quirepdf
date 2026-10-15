import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Studio desk. No passcode, no usage report, no server. */
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@/components/desk/Usage", replacement: resolve(import.meta.dirname, "extension/no-usage.tsx") },
      { find: "@/lib/usage.server", replacement: resolve(import.meta.dirname, "portable/usage-stub.ts") },
      { find: "@/lib/usage", replacement: resolve(import.meta.dirname, "portable/usage-client.ts") },
      { find: "@", replacement: resolve(import.meta.dirname, "src") },
    ],
  },
  define: {
    "import.meta.env.VITE_STUDIO": "true",
  },
  build: {
    outDir: "dist-studio",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(import.meta.dirname, "portable/studio.html"),
    },
  },
});
