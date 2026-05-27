import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Devuelve el clima actual para la ubicación del usuario.
 *
 * Lee lat/lng/city del profile del usuario (no de query params) — así no se
 * puede pedir clima de la ubicación de otro y la geo no se expone fuera de
 * Supabase.
 *
 * SIN caché: cada request hace fetch a Open-Meteo. Decisión del usuario.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_lat, default_lng, default_city")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.default_lat == null ||
    profile.default_lng == null
  ) {
    return NextResponse.json({ error: "no_location" }, { status: 400 });
  }

  const lat = profile.default_lat;
  const lng = profile.default_lng;

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set(
      "current",
      "temperature_2m,weather_code,is_day,relative_humidity_2m,apparent_temperature",
    );
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "auto");

    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.error("[weather] open-meteo error", res.status);
      return NextResponse.json(
        { error: "open_meteo_error", status: res.status },
        { status: 502 },
      );
    }

    const data = await res.json();
    const current = data?.current ?? {};
    const daily = data?.daily ?? {};

    return NextResponse.json({
      city: profile.default_city ?? null,
      temperature: roundOrNull(current.temperature_2m),
      apparent: roundOrNull(current.apparent_temperature),
      humidity: roundOrNull(current.relative_humidity_2m),
      tempMax: roundOrNull(daily.temperature_2m_max?.[0]),
      tempMin: roundOrNull(daily.temperature_2m_min?.[0]),
      weatherCode:
        typeof current.weather_code === "number" ? current.weather_code : null,
      isDay: current.is_day === 1,
      description: describeWeather(current.weather_code, current.is_day === 1),
    });
  } catch (err) {
    console.error("[weather] exception", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}

function roundOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

/**
 * Mapea el WMO weather_code de Open-Meteo a una descripción legible en
 * español. Referencia: https://open-meteo.com/en/docs (sección Weather codes).
 */
function describeWeather(code: unknown, isDay: boolean): string {
  if (typeof code !== "number") return "Sin datos";
  if (code === 0) return isDay ? "Despejado" : "Noche despejada";
  if (code === 1) return "Mayormente despejado";
  if (code === 2) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if (code === 45 || code === 48) return "Neblina";
  if (code >= 51 && code <= 57) return "Llovizna";
  if (code >= 61 && code <= 67) return "Lluvia";
  if (code >= 71 && code <= 77) return "Nieve";
  if (code >= 80 && code <= 82) return "Aguaceros";
  if (code >= 85 && code <= 86) return "Aguanieve";
  if (code >= 95 && code <= 99) return "Tormenta eléctrica";
  return "Clima variable";
}
