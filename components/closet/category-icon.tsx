import type { CategorySlug } from "@/lib/categories";

/**
 * Iconos de categoría — imágenes de marca de Drestyl (PNG en /public/icons).
 * Usables en filtros, cards, headers. Square, se escalan por CSS.
 */
const CATEGORY_ICON: Record<CategorySlug, string> = {
  superior: "/icons/cat-superior.png",
  sobreprenda: "/icons/cat-sobreprenda.png",
  inferior: "/icons/cat-inferior.png",
  calzado: "/icons/cat-calzado.png",
  accesorio: "/icons/cat-accesorio.png",
};

export function CategoryIcon({
  slug,
  className,
  size = 20,
}: {
  slug: CategorySlug;
  className?: string;
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={CATEGORY_ICON[slug]}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain" }}
      className={className}
      aria-hidden
    />
  );
}
