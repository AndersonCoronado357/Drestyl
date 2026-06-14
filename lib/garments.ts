import "server-only";
import type { CategorySlug } from "./categories";
import { signedPhotoUrl } from "./server/photos";

export type Formality = "formal" | "elegante" | "casual" | "deportivo";
export type Climate = "frio" | "templado" | "calor" | "mixto";

export type Garment = {
  id: string;
  user_id: string;
  name: string | null;
  category: CategorySlug;
  photo_path: string;
  is_active: boolean;
  bg_cleaned: boolean;
  formality: Formality | null;
  climate: Climate | null;
  created_at: string;
  updated_at: string;
};

/**
 * Devuelve, por cada prenda, la URL de su foto en acmsy (/api/photo con firma
 * HMAC). La URL incluye `v=updated_at`, así que cuando la foto cambia (bg
 * removal) la URL cambia y el navegador baja la versión nueva; si no cambió,
 * la URL es estable y el navegador cachea.
 *
 * El primer parámetro `_supabase` se mantiene por compatibilidad con las
 * llamadas existentes (ya no se usa: las fotos viven en la BD de acmsy).
 */
export async function getSignedPhotoUrls(
  _supabase: unknown,
  userId: string,
  garments: Array<{ photo_path: string; updated_at: string }>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const g of garments) {
    result.set(g.photo_path, signedPhotoUrl(userId, g.photo_path, g.updated_at));
  }
  return result;
}
