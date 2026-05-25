/**
 * Género que el usuario elige al crear cuenta. Lo usa la IA en Fase 4 para
 * armar outfits acordes al tipo de ropa habitual del usuario. Se puede
 * cambiar después en Ajustes.
 */
export const GENDERS = [
  { slug: "masculino", label: "Masculino" },
  { slug: "femenino", label: "Femenino" },
  { slug: "mixto", label: "Mixto / sin preferencia" },
] as const;

export type GenderSlug = (typeof GENDERS)[number]["slug"];

export const GENDER_SLUGS = GENDERS.map((g) => g.slug) as readonly GenderSlug[];

export function getGenderLabel(slug: string): string {
  return GENDERS.find((g) => g.slug === slug)?.label ?? slug;
}

export function isValidGender(value: unknown): value is GenderSlug {
  return (
    typeof value === "string" && GENDER_SLUGS.includes(value as GenderSlug)
  );
}
