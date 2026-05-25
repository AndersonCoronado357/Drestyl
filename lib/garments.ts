import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategorySlug } from "./categories";

export type Garment = {
  id: string;
  user_id: string;
  name: string | null;
  category: CategorySlug;
  photo_path: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Genera URLs firmadas temporales (1 hora) para una lista de paths del
 * bucket 'garments'. Devuelve un Map path → url. Acepta lista vacía.
 */
export async function getSignedPhotoUrls(
  supabase: SupabaseClient,
  paths: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;

  const { data } = await supabase.storage
    .from("garments")
    .createSignedUrls(paths, 3600);

  data?.forEach((item) => {
    if (item.signedUrl && item.path) {
      result.set(item.path, item.signedUrl);
    }
  });

  return result;
}
