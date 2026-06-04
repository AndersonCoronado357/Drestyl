import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { getSignedPhotoUrls, type Garment } from "@/lib/garments";
import { SwapPieceView } from "@/components/today/swap-piece-view";

/**
 * Pantalla para cambiar UNA prenda del outfit sin llamar a la IA.
 *
 * Llega aquí cuando el usuario toca una prenda dentro de /sugerencia.
 * Server-side:
 *  1. Verifica que el garment exista, sea del usuario y esté activo.
 *  2. Carga todas las demás prendas activas de la misma categoría.
 *  3. Genera signed URLs para mostrarlas en grilla.
 *
 * El cliente lee el outfit actual del sessionStorage (lo dejó OutfitView)
 * y, cuando el usuario tap a una opción, persiste el outfit MODIFICADO
 * con flag `pendingSwap: true` y navega de vuelta a /sugerencia. El
 * source pasa a "user_edited" porque la combinación final ya no es 100%
 * de la IA.
 */
export default async function SwapPiecePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { supabase, user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  // 1) La prenda que se va a reemplazar — valida ownership vía RLS.
  const { data: current } = await supabase
    .from("garments")
    .select(
      "id, user_id, name, category, photo_path, is_active, bg_cleaned, formality, climate, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!current) notFound();

  // 2) Otras prendas activas de la misma categoría (excluyendo la actual).
  const { data: optionsData } = await supabase
    .from("garments")
    .select(
      "id, user_id, name, category, photo_path, is_active, bg_cleaned, formality, climate, created_at, updated_at",
    )
    .eq("is_active", true)
    .eq("category", current.category)
    .neq("id", id)
    .order("created_at", { ascending: false });

  const options = (optionsData ?? []) as Garment[];

  // 3) Signed URLs para todas las opciones + la prenda actual (para mostrarla
  //    de referencia arriba del picker).
  const photoMap = await getSignedPhotoUrls(
    supabase,
    user.id,
    [current as Garment, ...options],
  );
  const photoUrls: Record<string, string> = {};
  for (const g of [current as Garment, ...options]) {
    const url = photoMap.get(g.photo_path);
    if (url) photoUrls[g.id] = url;
  }

  return (
    <SwapPieceView
      currentGarment={current as Garment}
      options={options}
      photoUrls={photoUrls}
    />
  );
}
