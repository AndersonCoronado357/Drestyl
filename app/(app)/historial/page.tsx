import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { getSignedPhotoUrls, type Garment } from "@/lib/garments";
import { HistorialList } from "@/components/historial/historial-list";

/**
 * Pantalla Historial — lista cronológica inversa de outfits aceptados.
 *
 * Solo lectura: no se edita ni se borra desde acá. El historial se
 * alimenta cuando el usuario toca "Usar" en /sugerencia, ese es el
 * único origen. Cada row queda como registro inmutable del día.
 *
 * Server-side fetch:
 *  1. Outfits del usuario ordenados por worn_date desc.
 *  2. TODOS los garments referenciados en los outfits (deduplicados).
 *  3. Signed URLs para mostrarlos en mini-grid.
 *
 * No paginamos por ahora — para 1 outfit/día durante 1 año son ~365
 * rows. La lista completa va en memoria sin problema. Cuando se torne
 * pesado (>1000), agregamos paginación.
 */
export default async function HistorialPage() {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { data: outfitsData } = await supabase
    .from("outfits")
    .select(
      "id, worn_date, garment_ids, occasion, weather_snapshot, reasoning, source, created_at",
    )
    .order("worn_date", { ascending: false })
    .order("created_at", { ascending: false });

  const outfits = outfitsData ?? [];

  // Recopilamos todos los IDs únicos de prendas para una sola query.
  const allGarmentIds = new Set<string>();
  for (const o of outfits) {
    for (const id of (o.garment_ids as string[] | null) ?? []) {
      allGarmentIds.add(id);
    }
  }

  let garmentsById: Map<string, Garment> = new Map();
  let photoUrls: Record<string, string> = {};

  if (allGarmentIds.size > 0) {
    const { data: garmentsData } = await supabase
      .from("garments")
      .select(
        "id, user_id, name, category, photo_path, is_active, bg_cleaned, formality, climate, created_at, updated_at",
      )
      .in("id", Array.from(allGarmentIds));

    const garments = (garmentsData ?? []) as Garment[];
    garmentsById = new Map(garments.map((g) => [g.id, g]));

    const photoMap = await getSignedPhotoUrls(supabase, user.id, garments);
    for (const g of garments) {
      const url = photoMap.get(g.photo_path);
      if (url) photoUrls[g.id] = url;
    }
  }

  return (
    <HistorialList
      outfits={outfits.map((o) => ({
        id: o.id,
        wornDate: o.worn_date,
        garmentIds: (o.garment_ids as string[] | null) ?? [],
        occasion: o.occasion,
        reasoning: o.reasoning,
        source: o.source as "ai_suggested" | "user_edited" | "fallback",
      }))}
      garmentsById={Object.fromEntries(garmentsById.entries())}
      photoUrls={photoUrls}
    />
  );
}
