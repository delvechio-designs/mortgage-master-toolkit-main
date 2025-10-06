// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  // --- DEV SERVER ---
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
    cors: true, // allow loading from WP origin
    // hmr is automatic, but this keeps things explicit/stable:
    hmr: {
      host: "localhost",
      protocol: "ws",
      port: 8080,
    },
    // Optional if you want absolute URLs in dev:
    // origin: "http://localhost:8080",
  },

  // --- PLUGINS ---
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),

  // --- ALIASES ---
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // --- BUILD (for WordPress plugin) ---
  // IMPORTANT: make built asset URLs relative so they work inside the plugin folder
  base: mode === "development" ? "/" : "./", // <-- NEW/IMPORTANT
  build: {
    outDir: "dist",
    manifest: true,       // <-- NEW/IMPORTANT (WP will read this)
    sourcemap: true,      // useful in WP even with built assets
  },
}));
