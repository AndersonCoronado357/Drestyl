"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveOutfitInput = {
  garmentIds: string[];
  occasion?: string;
  weather?: unknown;
  reasoning?: string;
  source?: "ai_suggested" | "user_edited" | "fallback";
};

export type SaveOutfitResult = { ok: true } | { error: string };

/**
 * Guarda un outfit ACEPTADO por el usuario en la tabla `outfits`. Solo
 * llega aquí cuando el usuario toca "Usar" — las sugerencias no aceptadas
 * (regeneradas, descartadas) NO se persisten.
 *
 * El `worn_date` es la fecha local del SERVER (no del cliente) para evitar
 * outfits "del futuro" si el browser tiene la zona horaria desincronizada.
 *
 * Validación de seguridad: cada garment_id se valida contra los del usuario.
 * Sin esto, un cliente malicioso podría guardar outfits con ids de otros
 * usuarios. RLS lo bloquearía igual a nivel DB, pero filtramos arriba para
 * dar un error claro.
 */
export async function saveOutfit(
  input: SaveOutfitInput,
): Promise<SaveOutfitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu sesión expiró." };
  }

  if (
    !Array.isArray(input.garmentIds) ||
    input.garmentIds.length === 0 ||
    input.garmentIds.length > 20
  ) {
    return { error: "Lista de prendas inválida." };
  }

  // Validar que cada id sea del usuario
  const { data: owned } = await supabase
    .from("garments")
    .select("id")
    .eq("user_id", user.id)
    .in("id", input.garmentIds);
  const ownedSet = new Set((owned ?? []).map((g) => g.id));
  const validIds = input.garmentIds.filter((id) => ownedSet.has(id));
  if (validIds.length === 0) {
    return { error: "Ninguna prenda del outfit te pertenece." };
  }

  const today = new Date().toISOString().split("T")[0];
  const source =
    input.source === "user_edited" || input.source === "fallback"
      ? input.source
      : "ai_suggested";

  const { error } = await supabase.from("outfits").insert({
    user_id: user.id,
    worn_date: today,
    garment_ids: validIds,
    occasion: input.occasion?.trim() || null,
    weather_snapshot: input.weather ?? null,
    reasoning: input.reasoning?.trim() || null,
    source,
  });

  if (error) {
    console.error("[saveOutfit]", error);
    return { error: "No pudimos guardar el outfit." };
  }

  // Refrescar Hoy (cuando exista la sección "outfit de hoy") + Historial.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Wrapper que guarda y redirige a Hoy. Útil desde formularios. */
export async function saveOutfitAndGoHome(
  input: SaveOutfitInput,
): Promise<SaveOutfitResult> {
  const result = await saveOutfit(input);
  if ("ok" in result) {
    redirect("/");
  }
  return result;
}
