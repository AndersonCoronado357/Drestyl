/**
 * Categorías de prenda en Drestyl. Lista cerrada.
 * El slug es lo que se guarda en la DB (con check constraint en la tabla).
 * El label es lo que ve el usuario en español.
 * Hint es la descripción corta que ayuda al usuario a saber qué encaja.
 */
export const CATEGORIES = [
  {
    slug: "superior",
    label: "Prenda superior",
    hint: "Camisetas, camisas, polos y blusas",
  },
  {
    slug: "sobreprenda",
    label: "Sobre la prenda",
    hint: "Chaquetas, hoodies, blazers y abrigos",
  },
  {
    slug: "inferior",
    label: "Prenda inferior",
    hint: "Pantalones, jeans, pantalonetas y faldas",
  },
  {
    slug: "calzado",
    label: "Zapatos",
    hint: "Tenis, botas, sandalias y formales",
  },
  {
    slug: "accesorio",
    label: "Accesorios",
    hint: "Gorras, correas, gafas, bolsos y joyería",
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as readonly CategorySlug[];

export function getCategoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

export function isValidCategory(value: unknown): value is CategorySlug {
  return (
    typeof value === "string" &&
    CATEGORY_SLUGS.includes(value as CategorySlug)
  );
}
