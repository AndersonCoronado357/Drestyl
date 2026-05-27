"use client";

/**
 * Loader: logo de la app pulsando (opacity + scale).
 * Ambas propiedades son COMPOSITADAS por la GPU — nunca dependen del main
 * thread. Aunque el modelo de bg removal use 100% CPU, esta animación
 * sigue corriendo perfecto.
 *
 * Es la solución más simple y robusta: 2 propiedades CSS que el navegador
 * promueve a su propio compositor layer.
 */
export function ClothingLoader({ size = 100 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      style={{ width: size, height: size }}
      className="relative inline-flex items-center justify-center"
    >
      <svg
        viewBox="0 0 512 512"
        className="size-full clothing-loader-logo"
        aria-hidden
      >
        <rect width="512" height="512" rx="96" fill="var(--color-accent)" />
        <path
          d="M168 128h88c70 0 128 57 128 128s-58 128-128 128h-88V128zm60 60v136h28c42 0 76-34 76-68s-34-68-76-68h-28z"
          fill="#FAFAFA"
        />
      </svg>
    </span>
  );
}
