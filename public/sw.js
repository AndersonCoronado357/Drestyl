// Service worker de auto-desregistro.
//
// El SW de Fase 0 cacheaba el shell y podía interceptar requests. Algunos
// usuarios quedaron con un SW registrado de pruebas anteriores que devolvía
// JS/HTML viejo y bloqueaba los onClick en mobile.
//
// Este SW reemplaza al anterior: al instalarse limpia TODOS los caches y se
// desregistra a sí mismo. Próxima visita, el navegador queda limpio.
//
// Cuando llegue Fase 6 (PWA pulida) escribiremos un SW serio.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 1. Borrar todos los caches.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      // 2. Desregistrar este SW.
      await self.registration.unregister();
      // 3. Forzar reload de las páginas abiertas con esta app para que ya
      //    funcionen sin SW.
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => c.navigate(c.url));
    })(),
  );
});
