// Post-build step: generates the Workbox service worker against the real
// client output (.output/public), which Nitro emits after `vite build`.
// Run automatically via `npm run build`.
import { generateSW } from "workbox-build";

const { count, size, warnings } = await generateSW({
  globDirectory: ".output/public",
  globPatterns: [
    "**/*.{js,css,html,png,svg,ico,webmanifest,json,woff,woff2,ttf,otf}",
  ],
  globIgnores: ["sw.js", "registerSW.js", "_headers", "**/*.map"],
  swDest: ".output/public/sw.js",
  // No navigateFallback: this is an SSR app with no SPA shell HTML to fall back
  // to — serving offline.html for every navigation traps users on the offline
  // page after any full reload (e.g. post-login). Navigations are handled by
  // the NetworkFirst rule below instead.
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Page navigations: always try the network first; only when it fails or
      // stalls do we serve the precached offline page. /api/ and /auth/ are
      // excluded so auth redirects and server functions are never cached.
      urlPattern: ({ url, request }) =>
        request.mode === "navigate" &&
        !url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/auth"),
      handler: "NetworkFirst",
      options: {
        cacheName: "scu-navigation",
        networkTimeoutSeconds: 4,
        precacheFallback: { fallbackURL: "/offline.html" },
        expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
        cacheableResponse: { statuses: [200] },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.(lovable\.cloud|supabase\.co)\//,
      handler: "NetworkFirst",
      options: {
        cacheName: "scu-api-cache",
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
      handler: "CacheFirst",
      options: {
        cacheName: "scu-fonts-cache",
        expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\.(?:js|css|woff2?|ttf|otf)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "scu-static-cache",
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif|ico)$/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "scu-images-cache",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
});

for (const w of warnings) console.warn("workbox:", w);
console.log(`sw.js written — ${count} precached files, ${(size / 1024).toFixed(0)} KiB`);
