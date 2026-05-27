import type { CategorySlug } from "@/lib/categories";

/**
 * Iconos minimalistas por categoría — line-art consistente (stroke 1.6,
 * round caps, currentColor). Diseñados manualmente para verse limpios a
 * 16-24px. Usables en filtros, cards, headers.
 */
export function CategoryIcon({
  slug,
  className,
  size = 20,
}: {
  slug: CategorySlug;
  className?: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  };

  switch (slug) {
    // Camiseta clásica: cuello redondo, hombros, sisas, cuerpo más
    // cuadrado (antes v13 = body alargado, ahora v9 = proporcional).
    case "superior":
      return (
        <svg {...common}>
          <path d="M9 5.5h6l3.5 2-1 4-2-1v9H8.5v-9l-2 1-1-4z" />
          <path d="M9 5.5c0 1.5 1.4 2.5 3 2.5s3-1 3-2.5" />
        </svg>
      );

    // Chaqueta con cierre: solapas + cremallera central + bolsillos
    case "sobreprenda":
      return (
        <svg {...common}>
          <path d="M8 4l2 2 2-2 2 2 2-2 3 2v15h-3v-9l-1 1v8H9v-8l-1-1v9H5V6z" />
          <line x1="12" y1="6" x2="12" y2="19" strokeDasharray="1 1.5" />
        </svg>
      );

    // Pantalón largo: cintura + dos piernas trapezoidales
    case "inferior":
      return (
        <svg {...common}>
          <path d="M6 3h12l-.5 5-.5 13h-3.5l-1-12-1 12H8L7.5 8z" />
          <line x1="6.5" y1="6" x2="17.5" y2="6" />
        </svg>
      );

    // Tenis de perfil: suela + cuerpo + cordones simplificados
    case "calzado":
      return (
        <svg {...common}>
          <path d="M3 17.5c0-1 .3-1.5 1-2v-3.5l3-1.5 1.5-3h3.5l1 2.5 4 1.5 4 2 1 1.5v3z" />
          <path d="M3.5 17.5h18a.5.5 0 0 1 .5.5v1H2.5v-1a.5.5 0 0 1 1-.5z" />
          <path d="M8 11l1 2M10 10l1 2M12 10l1 2M14 10.5l1 2" />
        </svg>
      );

    // Accesorios: gafas (representa todo: gorras, bolsos, joyería, etc.)
    case "accesorio":
      return (
        <svg {...common}>
          <circle cx="7" cy="14" r="3.5" />
          <circle cx="17" cy="14" r="3.5" />
          <path d="M10.5 14h3" />
          <path d="M3.5 11.5L7 6h10l3.5 5.5" />
        </svg>
      );
  }
}
