import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidCategory } from "@/lib/categories";
import { getSignedPhotoUrls, type Garment } from "@/lib/garments";
import { GarmentDetail } from "@/components/closet/garment-detail";

/**
 * El page sirve solo como entry point — carga la lista completa de prendas
 * con sus signed URLs (mismas que el closet, cacheadas) y se la pasa al
 * client component. Una vez montado, navegar entre prendas es 100% client:
 * solo cambia el índice en estado, sin URL change ni server roundtrip.
 */
export default async function GarmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Lista completa, mismo orden que el closet.
  const { data: garments } = await supabase
    .from("garments")
    .select(
      "id, user_id, name, category, photo_path, is_active, bg_cleaned, formality, climate, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  const list = (garments ?? []) as Garment[];
  const initial = list.find((g) => g.id === id);
  if (!initial || !isValidCategory(initial.category)) {
    notFound();
  }

  // Signed URLs para TODAS las prendas — el cache module-level las
  // reutiliza entre cargas, así es barato.
  const photoMap = await getSignedPhotoUrls(supabase, user.id, list);
  const photoUrls = Object.fromEntries(
    list.map((g) => [g.id, photoMap.get(g.photo_path) ?? null] as const),
  );

  return (
    <GarmentDetail
      garments={list}
      photoUrls={photoUrls}
      initialId={initial.id}
    />
  );
}
