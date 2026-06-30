import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// On GitHub Pages the app is served from https://<owner>.github.io/Training/,
// so production assets need the "/Training/" base. Dev stays at "/".
const BASE = process.env.GITHUB_PAGES ? "/Training/" : "/";

export default defineConfig({
  base: BASE,
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "CHARGE — Suivi de musculation",
        short_name: "CHARGE",
        description: "Suivi de musculation local-first, offline et installable.",
        theme_color: "#0b0f17",
        background_color: "#0b0f17",
        display: "standalone",
        orientation: "portrait",
        // Relative so it works under any base (root in dev, /Training/ on Pages).
        start_url: ".",
        scope: BASE,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // The exercise catalog is ~1MB; allow it to be precached for offline use.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,json}"],
      },
    }),
  ],
});
