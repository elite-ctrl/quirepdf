import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** A static copy of the desk. No server, no account. Served from a folder. */
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@/lib/usage.server", replacement: resolve(import.meta.dirname, "portable/usage-stub.ts") },
      { find: "@/lib/usage", replacement: resolve(import.meta.dirname, "portable/usage-client.ts") },
      { find: "@", replacement: resolve(import.meta.dirname, "src") },
    ],
  },
  build: {
    outDir: "dist-portable",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, "portable/index.html"),
    },
  },
});
