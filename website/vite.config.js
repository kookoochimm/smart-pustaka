
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",

      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
      },

      // Enable Service Worker during localhost development
      devOptions: {
        enabled: true,
        type: "module",
      },

      // Automatically update Service Worker
      registerType: "autoUpdate",

      // PWA assets
      includeAssets: ["apple-touch-icon.png"],

      manifest: {
        id: "/",
        name: "SMART PUSTAKA",
        short_name: "SMART PUSTAKA",
        description:
          "SMART PUSTAKA - Self-service library system for TVETMARA Sungai Petani.",

        start_url: "/login",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#191970",

        icons: [
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
