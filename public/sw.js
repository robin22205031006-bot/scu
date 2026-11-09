self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.allSettled(names.map((n) => caches.delete(n)));
      await self.clients.claim();
      const cs = await self.clients.matchAll({ type: "window" });
      await Promise.allSettled(cs.map((c) => c.navigate(c.url)));
    } finally { await self.registration.unregister(); }
  })()),
);
