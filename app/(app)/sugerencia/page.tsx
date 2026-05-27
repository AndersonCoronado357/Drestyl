import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSignedPhotoUrls, type Garment } from "@/lib/garments";
import { OutfitPreview } from "@/components/today/outfit-preview";

/**
 * Pantalla de sugerencia de outfit.
 *
 * Fase 3 (acá): arma un outfit "demo" tomando una prenda activa random
 * de cada categoría clave (superior, sobreprenda, inferior, calzado,
 * accesorio). Sin IA todavía — solo muestra el layout que va a usar.
 *
 * Fase 4: este server component llamará a `/api/suggest-outfit` con
 * clima + ocasión y la IA elegirá las prendas. Mismo OutfitPreview.
 */
export default async function SugerenciaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: garments } = await supabase
    .from("garments")
    .select(
      "id, user_id, name, category, photo_path, is_active, bg_cleaned, formality, climate, created_at, updated_at",
    )
    .eq("is_active", true);

  const list = (garments ?? []) as Garment[];

  // Agrupar por categoría
  const byCategory = new Map<string, Garment[]>();
  for (const g of list) {
    const arr = byCategory.get(g.category) ?? [];
    arr.push(g);
    byCategory.set(g.category, arr);
  }

  function pickRandom(slot: string): Garment | null {
    const arr = byCategory.get(slot) ?? [];
    if (arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickRandomMany(slot: string, max: number): Garment[] {
    const arr = [...(byCategory.get(slot) ?? [])];
    if (arr.length === 0) return [];
    // Fisher-Yates parcial: tomar hasta `max` (o lo que haya).
    const n = Math.min(max, arr.length);
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(Math.random() * (arr.length - i));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, n);
  }

  // Orden de prioridad: prendas base primero, accesorios al final.
  // Para accesorios podemos sugerir 1-3 (reloj + correa + gafas, por ej.).
  const accessoriesAvailable = (byCategory.get("accesorio") ?? []).length;
  const accessoryCount = Math.min(
    accessoriesAvailable,
    accessoriesAvailable >= 2 ? 2 : accessoriesAvailable,
  );

  const outfit = [
    pickRandom("superior"),
    pickRandom("inferior"),
    pickRandom("calzado"),
    pickRandom("sobreprenda"),
    ...pickRandomMany("accesorio", accessoryCount),
  ].filter((g): g is Garment => g !== null);

  const photoMap = await getSignedPhotoUrls(supabase, user.id, outfit);
  const photoUrls = Object.fromEntries(
    outfit.map((g) => [g.id, photoMap.get(g.photo_path) ?? null] as const),
  );

  return (
    <OutfitPreview
      garments={outfit}
      photoUrls={photoUrls}
      totalActive={list.length}
    />
  );
}
