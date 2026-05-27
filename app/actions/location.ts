"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveLocationState = { error?: string } | undefined;

/**
 * Guarda lat/lng del usuario en `profiles` y resuelve el nombre de la
 * ciudad vía Nominatim (OpenStreetMap, gratis, sin key). Si el reverse
 * geocoding falla, igual guardamos lat/lng — la app puede funcionar sin
 * el nombre de la ciudad, solo se ve menos elegante.
 *
 * Open-Meteo no tiene endpoint de reverse geocoding propio (solo forward
 * por nombre). Por eso usamos Nominatim con un User-Agent identificatorio
 * como pide su política de uso.
 */
export async function saveLocation(
  formData: FormData,
): Promise<SaveLocationState> {
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "Coordenadas inválidas." };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: "Coordenadas fuera de rango." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Reverse geocoding — best-effort. Si falla, city queda null.
  let city: string | null = null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es&zoom=10`,
      {
        headers: { "User-Agent": "Drestyl/1.0 (drestyl.app)" },
        signal: AbortSignal.timeout(4000),
      },
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data?.address ?? {};
      city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.state ||
        null;
      if (city && city.length > 120) city = city.slice(0, 120);
    }
  } catch (err) {
    console.warn("[saveLocation] reverse geocoding falló:", err);
  }

  const { error } = await supabase
    .from("profiles")
    .update({ default_lat: lat, default_lng: lng, default_city: city })
    .eq("id", user.id);

  if (error) {
    console.error("[saveLocation] update falló:", error);
    return { error: "No pudimos guardar la ubicación. Intentá de nuevo." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
