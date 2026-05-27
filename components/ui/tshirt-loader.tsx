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

const TSHIRT =
  "M30 14 L41 8 Q50 16 59 8 L70 14 L85 26 L78 38 L70 33 L70 86 L30 86 L30 33 L22 38 L15 26 Z";

const COMET_KEYFRAMES = `
@keyframes tshirt-comet {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -340; }
}
`;
