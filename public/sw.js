// Service worker mínimo de auto-desregistro. No intercepta requests, no
// hace cache, no fuerza recargas (eso causaba comportamiento raro en mobile).
// Solo se mata a sí mismo cuando se activa.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
    })(),
  );
});
