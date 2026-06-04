import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { getSignedPhotoUrls, type Garment } from "@/lib/garments";
import { HistorialDetail } from "@/components/historial/historial-detail";

/**
 * Detalle de un outfit del historial. Solo lectura — no se edita ni se
 * borra. Muestra fecha + reasoning original + grid de prendas + clima
 * de ese día.
 *
 * RLS bloquea el acceso a outfits ajenos. Si la prenda fue borrada
 * después, no aparece (el outfit no se rompe).
 */
export default async function HistorialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { data: outfit } = await supabase
    .from("outfits")
    .select(
      "id, worn_date, garment_ids, occasion, weather_snapshot, reasoning, source, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!outfit) notFound();

  const garmentIds = (outfit.garment_ids as string[] | null) ?? [];
  let garments: Garment[] = [];
  let photoUrls: Record<string, string> = {};
  if (garmentIds.length > 0) {
    const { data: garmentsData } = await supabase
      .from("garments")
      .select(
        "id, user_id, name, category, photo_path, is_active, bg_cleaned, formality, climate, created_at, updated_at",
      )
      .in("id", garmentIds);
    garments = (garmentsData ?? []) as Garment[];
    const photoMap = await getSignedPhotoUrls(supabase, user.id, garments);
    for (const g of garments) {
      const url = photoMap.get(g.photo_path);
      if (url) photoUrls[g.id] = url;
    }
  }

  // Ordenamos las prendas en el mismo orden en que se guardaron.
  const orderedGarments = garmentIds
    .map((gid) => garments.find((g) => g.id === gid))
    .filter((g): g is Garment => g !== undefined);

  return (
    <HistorialDetail
      outfit={{
        id: outfit.id,
        wornDate: outfit.worn_date,
        occasion: outfit.occasion,
        reasoning: outfit.reasoning,
        source: outfit.source as "ai_suggested" | "user_edited" | "fallback",
        weather: outfit.weather_snapshot,
      }}
      garments={orderedGarments}
      photoUrls={photoUrls}
    />
  );
}
