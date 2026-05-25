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
    hint: "camisetas, camisas, polos, blusas, esqueletos",
  },
  {
    slug: "sobreprenda",
    label: "Sobre la prenda",
    hint: "chaquetas, blazers, abrigos, sudaderas con cierre, cárdiganes",
  },
  {
    slug: "inferior",
    label: "Prenda inferior",
    hint: "pantalones, jeans, shorts, faldas, bermudas",
  },
  {
    slug: "calzado",
    label: "Zapatos",
    hint: "tenis, formales, sandalias, botas",
  },
  {
    slug: "accesorio",
    label: "Accesorios",
    hint: "gorras, sombreros, bufandas, cinturones, gafas",
  },
  {
    slug: "joyeria",
    label: "Joyería y reloj",
    hint: "anillos, cadenas, aretes, relojes, pulseras",
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
