import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { getSignedPhotoUrls, type Garment } from "@/lib/garments";
import { AddPieceView } from "@/components/today/add-piece-view";

/**
 * Pantalla para SUMAR una prenda al outfit actual sin llamar a la IA.
 *
 * A diferencia de /cambiar/[id] (reemplazo de una prenda específica),
 * acá el usuario suma una pieza nueva — típicamente un accesorio, una
 * sobreprenda o algo que la IA no eligió.
 *
 * El server carga TODAS las prendas activas + signed URLs. El cliente lee
 * el outfit actual del sessionStorage, filtra las que ya están en él, y
 * muestra el resto agrupable por categoría.
 */
export default async function AddPiecePage() {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { data: garmentsData } = await supabase
    .from("garments")
    .select(
      "id, user_id, name, category, photo_path, is_active, bg_cleaned, formality, climate, created_at, updated_at",
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const garments = (garmentsData ?? []) as Garment[];

  const photoMap = await getSignedPhotoUrls(supabase, user.id, garments);
  const photoUrls: Record<string, string> = {};
  for (const g of garments) {
    const url = photoMap.get(g.photo_path);
    if (url) photoUrls[g.id] = url;
  }

  return <AddPieceView garments={garments} photoUrls={photoUrls} />;
}
