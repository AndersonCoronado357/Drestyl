"use client";

/**
 * Loader para el momento de GUARDAR: silueta de camiseta + segmento lila
 * recorriendo el contorno (técnica comet con stroke-dasharray + dashoffset).
 *
 * Animación INLINE (style jsx) para no depender del pipeline de Tailwind/
 * Lightning CSS que estaba purgando la clase. Así el componente es 100%
 * autocontenido y funciona sí o sí.
 */
export function TshirtLoader({ size = 100 }: { size?: number }) {
  return (
    <>
      <style>{COMET_KEYFRAMES}</style>
      <svg
        viewBox="0 0 100 100"
        style={{ width: size, height: size }}
        role="status"
        aria-label="Cargando"
      >
        {/* Contorno guía permanente — tenue */}
        <path
          d={TSHIRT}
          fill="none"
          stroke="var(--color-accent)"
          strokeOpacity="0.15"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Segmento animado que recorre el path */}
        <path
          d={TSHIRT}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: "40 300",
            animation: "tshirt-comet 2.5s linear infinite",
          }}
        />
      </svg>
    </>
  );
}

// Silueta más cuadrada — body más corto (y bottom 86 → 70) y centrada en
// el viewBox. La camiseta original quedaba muy alargada como un vestido.
const TSHIRT =
  "M30 22 L41 16 Q50 24 59 16 L70 22 L85 34 L78 46 L70 41 L70 78 L30 78 L30 41 L22 46 L15 34 Z";

const COMET_KEYFRAMES = `
@keyframes tshirt-comet {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -340; }
}
`;
