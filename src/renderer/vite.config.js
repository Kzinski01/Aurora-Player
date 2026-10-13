import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      // Two windows, two entries: the main app and the background mini player,
      // each loaded by the main process with loadFile(). Declaring both keeps
      // Vite's default single-page assumption from dropping mini.html.
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        mini: resolve(import.meta.dirname, "mini.html"),
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
