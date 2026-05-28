// Service worker mínimo para PWA instalable. NO cachea data del usuario
// (siempre va fresca al server) — solo cumple los criterios de Chrome
// para que la app sea instalable: SW activo + manifest + íconos válidos.
//
// Estrategia "network-only" para todos los requests: no interceptamos ni
// devolvemos cache. Es lo más simple y evita problemas como los que
// tuvimos en Fase 0 (cache agresivo rompía hidratación en mobile).
//
// Cuando lleguemos a Fase 6.6 (offline básico) podemos sumar cache de
// shell estático. Por ahora: solo presencia.

const SW_VERSION = "drestyl-v1";

self.addEventListener("install", () => {
  // Forzamos activación inmediata sin esperar a que cierren las pestañas.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Limpieza de cualquier caché viejo de versiones anteriores.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k)),
      );
      // Tomamos control de las pestañas abiertas inmediatamente.
      await self.clients.claim();
    })(),
  );
});

// No interceptamos fetch — pasamos todo al network sin tocar. Esto se
// puede expandir más adelante para cachear el shell (Next chunks) o assets
// estáticos, pero por ahora la simplicidad gana.
self.addEventListener("fetch", () => {
  /* network-only por default */
});
