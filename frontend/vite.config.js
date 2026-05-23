import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react({
      include: /\.(js|jsx|ts|tsx)$/,
    }),
    VitePWA({
      // Auto-register the SW; the React hook surfaces the "needRefresh" state
      // so the user can choose when to reload (no silent navigation interrupts).
      registerType: "prompt",
      injectRegister: "auto",
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "logo.png",
      ],
      manifest: {
        id: "/",
        name: "Mixy Logistics - Delivery Management",
        short_name: "Mixy",
        description: "Complete delivery management system for businesses",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#059669",
        background_color: "#F8FAFC",
        categories: ["business", "productivity"],
        icons: [
          { src: "/favicon.ico", sizes: "64x64 32x32 24x24 16x16", type: "image/x-icon" },
          { src: "/icon-192.png", type: "image/png", sizes: "192x192", purpose: "any maskable" },
          { src: "/icon-512.png", type: "image/png", sizes: "512x512", purpose: "any maskable" },
        ],
        shortcuts: [
          {
            name: "New Order",
            short_name: "Order",
            description: "Create a new delivery order",
            url: "/service/new-order",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        // Build-time hashed precache — every deploy invalidates stale entries
        // and `cleanupOutdatedCaches` removes prior workbox-* cache versions.
        globPatterns: ["**/*.{js,css,html,png,jpg,jpeg,svg,ico,woff,woff2}"],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // Static asset chunks: cache-first (immutable; filename hash changes per build)
            urlPattern: ({ url }) => url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // API calls: network-first with a short timeout, fall back to cache
            // so the app degrades gracefully when offline.
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  envPrefix: ["VITE_", "REACT_APP_"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { ".js": "jsx" },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    css: false,
  },
});
