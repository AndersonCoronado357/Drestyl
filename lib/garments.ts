import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategorySlug } from "./categories";

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

// Cache module-level de signed URLs. Clave: path@updatedAt. Cuando una foto
// se reemplaza (bg removal en background) cambia updated_at en DB → clave
// distinta → URL nueva → browser fetch fresco. Si no cambió, reutilizamos
// la URL y el browser hace cache hit.
const SIGNED_URL_TTL_MS = 23 * 60 * 60 * 1000; // 23h, justo abajo del expiry de 24h
const urlCache = new Map<string, { url: string; until: number }>();

/**
 * Genera URLs firmadas con expiración larga (24h) y las cachea en memoria
 * indexadas por path + updated_at. El mismo URL en re-visits = browser cache
 * hit en las imágenes. Cuando el bg se limpia, updated_at cambia y forzamos
 * URL nueva para que el browser baje la versión limpia.
 */
export async function getSignedPhotoUrls(
  supabase: SupabaseClient,
  userId: string,
  garments: Array<{ photo_path: string; updated_at: string }>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (garments.length === 0) return result;

  const now = Date.now();
  const toFetch: string[] = [];
  const keyByPath = new Map<string, string>();

  for (const g of garments) {
    const key = `${userId}/${g.photo_path}@${g.updated_at}`;
    keyByPath.set(g.photo_path, key);
    const cached = urlCache.get(key);
    if (cached && cached.until > now + 60_000) {
      result.set(g.photo_path, cached.url);
    } else if (!toFetch.includes(g.photo_path)) {
      toFetch.push(g.photo_path);
    }
  }

  if (toFetch.length > 0) {
    const bucket = `user-${userId}`;
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrls(toFetch, 24 * 3600);

    data?.forEach((item) => {
      if (item.signedUrl && item.path) {
        result.set(item.path, item.signedUrl);
        const key = keyByPath.get(item.path);
        if (key) {
          urlCache.set(key, { url: item.signedUrl, until: now + SIGNED_URL_TTL_MS });
        }
      }
    });
  }

  // Limpieza ocasional de entradas viejas (evita memory leak en runs largos).
  if (urlCache.size > 1000) {
    for (const [k, v] of urlCache.entries()) {
      if (v.until < now) urlCache.delete(k);
    }
  }

  return result;
}
