import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { getSignedPhotoUrls, type Garment } from "@/lib/garments";

// Límite duro de prendas que mandamos a la IA por llamada. Más de eso:
//  - El payload base64 crece mucho (slow transfer a Google).
//  - Gemini cobra más tokens por imagen y la inferencia se alarga.
// Antes había un cap de 25 prendas — lo quitamos. La IA recibe TODO el
// clóset activo (menos las recientes) para tener todas las combinaciones.
// El trade-off: payload y latencia más altos cuando hay 50+ prendas.

// Máximo de outfits que la IA arma por día por usuario. Incluye la carga
// inicial + todas las regeneraciones. Controlado en la DB (profiles.
// ai_calls_count) — el cliente no puede manipularlo como sí podía con
// localStorage. Reset automático al cambiar de día.
const MAX_AI_CALLS_PER_DAY = 4;

function todayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Tamaño máximo del lado mayor cuando resizeamos antes de enviar a Gemini.
// 256 sigue dentro del tier "low-res" (258 tokens/imagen) y transfiere
// ~40% menos data base64 que 384.
const AI_IMAGE_SIZE = 256;

// Cache en memoria de fotos ya descargadas y resizeadas. Clave incluye
// updated_at: si la foto cambia (bg removal, edit), cambia la clave y se
// reprocesa. El hit típico es REGENERAR: la primera llamada llena el cache,
// las siguientes solo pagan el tiempo de Gemini (no re-descargan ni resizean).
type CachedPhoto = { mime: string; data: string; until: number };
const photoB64Cache = new Map<string, CachedPhoto>();
const PHOTO_CACHE_TTL_MS = 23 * 60 * 60 * 1000;

// La llamada a Gemini con N imágenes inline puede tardar 10-30s. Subimos el
// timeout del runtime de Next para que no nos corte antes.
export const maxDuration = 60;

type WeatherSnapshot = {
  // Estado actual (lo que se ve al salir AHORA)
  temperature: number | null;
  apparent: number | null;
  humidity: number | null;
  weatherCode: number | null;
  isDay: boolean;
  description: string;
  // Estimado del día COMPLETO (lo que la IA usa para decidir abrigo, lluvia, etc)
  tempMin: number | null;
  tempMax: number | null;
  apparentMin: number | null;
  apparentMax: number | null;
  dayWeatherCode: number | null;
  dayDescription: string;
  precipitationProbability: number | null; // 0-100
  precipitationSum: number | null; // mm
  uvIndexMax: number | null;
  city: string | null;
};

/**
 * Endpoint principal de Fase 4. Genera un outfit completo con IA.
 *
 * Pipeline:
 *  1. Auth + carga perfil (lat/lng/city/repeat_window_days).
 *  2. Carga prendas activas + signed URLs.
 *  3. Carga outfits de los últimos N días (lista de prendas "recientes").
 *  4. Fetch clima actual de Open-Meteo.
 *  5. Descarga cada foto, encodea base64, arma prompt multimodal.
 *  6. Llama a Gemini 2.5 Flash con rotación de keys (free tier).
 *  7. Parsea JSON, valida que cada id devuelto sea del usuario y esté activo.
 *  8. Devuelve { garments, photoUrls, reasoning, weather, source }.
 *
 * Errores comunes (status 502 con `error` específico):
 *  - `no_location`, `no_garments`: el cliente debe redirigir/avisar.
 *  - `ai_failed` / `quota_exceeded`: el cliente puede sugerir reintentar
 *    o caer al fallback (próximo paso de Fase 4).
 *  - `parse_failed` / `no_valid_ids`: la IA respondió mal, reintento manual.
 */
export async function POST(request: NextRequest) {
  const tStart = Date.now();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    /* sin body es OK */
  }
  const occasion =
    body && typeof (body as { occasion?: unknown }).occasion === "string"
      ? ((body as { occasion: string }).occasion).trim().slice(0, 300)
      : "";

  // 1) Perfil — incluye contador de llamadas, flag unlimited, y las
  //    preferencias de estilo del usuario (texto libre que va al prompt).
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "default_lat, default_lng, default_city, repeat_window_days, ai_calls_date, ai_calls_count, ai_calls_unlimited, style_preferences",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (
    !profile ||
    profile.default_lat == null ||
    profile.default_lng == null
  ) {
    return NextResponse.json({ error: "no_location" }, { status: 400 });
  }

  const unlimited = profile.ai_calls_unlimited === true;

  // 1b) Chequear el límite diario de llamadas a la IA — solo si NO es
  //     usuario con cupo ilimitado. Si la fecha guardada no es la de hoy,
  //     el contador efectivo es 0 (nuevo día). Se persiste al final del
  //     pipeline si la IA respondió con éxito.
  const today = todayDateStr();
  const callsToday =
    profile.ai_calls_date === today ? (profile.ai_calls_count ?? 0) : 0;
  if (!unlimited && callsToday >= MAX_AI_CALLS_PER_DAY) {
    return NextResponse.json(
      { error: "daily_limit_reached", callsLeft: 0 },
      { status: 429 },
    );
  }

  // 2) Prendas activas
  const { data: garmentsData } = await supabase
    .from("garments")
    .select(
      "id, user_id, name, category, photo_path, is_active, bg_cleaned, formality, climate, created_at, updated_at",
    )
    .eq("is_active", true);
  const garments = (garmentsData ?? []) as Garment[];
  if (garments.length === 0) {
    return NextResponse.json({ error: "no_garments" }, { status: 400 });
  }

  // 3) Outfits recientes — dos usos:
  //    a) "no repetir prendas": IDs usados en los últimos N días (configurable).
  //    b) "estilo histórico": últimos ~15 outfits aceptados con su composición
  //       completa, como referencia del gusto personal del usuario. La IA
  //       hace pattern-matching con esto en vez de pura clasificación pura.
  const windowDays = profile.repeat_window_days ?? 10;
  const cutoffDateNoRepeat = new Date(Date.now() - windowDays * 24 * 3600 * 1000)
    .toISOString()
    .split("T")[0];
  // Ventana de 30 días para "estilo histórico" — los gustos no cambian
  // tanto en un mes y mantiene el prompt liviano.
  const cutoffDateStyle = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    .toISOString()
    .split("T")[0];
  const { data: recentOutfitsData } = await supabase
    .from("outfits")
    .select("worn_date, garment_ids, occasion, source")
    .gte("worn_date", cutoffDateStyle)
    .order("worn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(15);
  const recentOutfits = recentOutfitsData ?? [];

  const recentlyUsed = new Set<string>();
  for (const o of recentOutfits) {
    if (o.worn_date < cutoffDateNoRepeat) continue; // fuera de la ventana de no-repetir
    for (const id of (o.garment_ids as string[] | null) ?? []) {
      recentlyUsed.add(id);
    }
  }

  // Para enriquecer los outfits del bloque "estilo histórico" necesitamos
  // los nombres + categorías de cada prenda (incluso si fueron borradas
  // del clóset después, las del outfit aceptado siguen como referencia).
  const historicalGarmentIds = new Set<string>();
  for (const o of recentOutfits) {
    for (const id of (o.garment_ids as string[] | null) ?? []) {
      historicalGarmentIds.add(id);
    }
  }
  const historicalGarmentsMap = new Map<
    string,
    { name: string | null; category: string }
  >();
  if (historicalGarmentIds.size > 0) {
    const { data: histGarments } = await supabase
      .from("garments")
      .select("id, name, category")
      .in("id", Array.from(historicalGarmentIds));
    for (const g of histGarments ?? []) {
      historicalGarmentsMap.set(g.id, { name: g.name, category: g.category });
    }
  }

  // 4) Clima
  const weather = await fetchWeather(
    profile.default_lat,
    profile.default_lng,
    profile.default_city,
  );

  // 5a) Filtramos las prendas recientes ANTES de mandarlas a la IA. La
  //     regla "no repetir" las prohíbe igual; sacarlas del input baja el
  //     payload + tokens y acelera todo. Si tras filtrar quedan < 3, las
  //     dejamos pasar para que la IA tenga con qué armar el outfit.
  let candidates = garments.filter((g) => !recentlyUsed.has(g.id));
  if (candidates.length < 3) {
    candidates = garments;
  }

  // 5b) [Eliminado] El cap de 25 estaba aquí. Ahora la IA recibe todas las
  //     prendas activas (filtradas por "no repetir"). Si el clóset crece
  //     mucho (100+), reconsiderar.

  // 5c) Cache hit-first: si ya tenemos la foto base64 cacheada (de una
  //     llamada anterior, ej. el outfit inicial), la reusamos. Si no, la
  //     descargamos, resizeamos con sharp y la metemos al cache. Esto hace
  //     que "Regenerar" sea casi puro tiempo de IA (sin re-descargar fotos).
  const photoMap = await getSignedPhotoUrls(supabase, user.id, candidates);
  const tDownload = Date.now();
  let cacheHits = 0;
  const downloads = await Promise.all(
    candidates.map(async (g) => {
      const cacheKey = `${g.photo_path}@${g.updated_at}`;
      const cached = photoB64Cache.get(cacheKey);
      if (cached && cached.until > Date.now()) {
        cacheHits++;
        return { garment: g, mime: cached.mime, data: cached.data };
      }
      const url = photoMap.get(g.photo_path);
      if (!url) return null;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        const resized = await sharp(buf)
          .resize(AI_IMAGE_SIZE, AI_IMAGE_SIZE, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 75 })
          .toBuffer();
        const entry: CachedPhoto = {
          mime: "image/webp",
          data: resized.toString("base64"),
          until: Date.now() + PHOTO_CACHE_TTL_MS,
        };
        photoB64Cache.set(cacheKey, entry);
        return { garment: g, mime: entry.mime, data: entry.data };
      } catch (err) {
        console.warn(`[suggest-outfit] download/resize fail ${g.id}:`, err);
        return null;
      }
    }),
  );
  // Limpieza ocasional para evitar memory leak en runs largos.
  if (photoB64Cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of photoB64Cache.entries()) {
      if (v.until < now) photoB64Cache.delete(k);
    }
  }
  console.log(
    `[suggest-outfit] fotos preparadas en ${Date.now() - tDownload}ms (${cacheHits} cache hits)`,
  );
  const valid = downloads.filter(
    (x): x is { garment: Garment; mime: string; data: string } => x !== null,
  );
  if (valid.length === 0) {
    return NextResponse.json({ error: "no_garments" }, { status: 400 });
  }
  console.log(
    `[suggest-outfit] ${valid.length}/${candidates.length} fotos listas (de ${garments.length} activas) en ${Date.now() - tStart}ms`,
  );

  // 6) Llamada a Gemini con rotación de keys
  const apiKeys = (
    process.env.GEMINI_API_KEYS ||
    process.env.GEMINI_API_KEY ||
    ""
  )
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (apiKeys.length === 0) {
    return NextResponse.json({ error: "no_key" }, { status: 500 });
  }
  const keys = [...apiKeys].sort(() => Math.random() - 0.5);

  const prompt = buildPrompt(
    valid.map((v) => v.garment),
    weather,
    occasion,
    recentlyUsed,
    profile.style_preferences ?? null,
    recentOutfits.map((o) => ({
      wornDate: o.worn_date as string,
      occasion: (o.occasion as string | null) ?? null,
      garmentIds: ((o.garment_ids as string[] | null) ?? []),
    })),
    historicalGarmentsMap,
  );

  const parts: Array<
    { text: string } | { inline_data: { mime_type: string; data: string } }
  > = [{ text: prompt }];
  // Adjuntamos cada foto con su id como etiqueta para que la IA pueda devolverlo
  valid.forEach((v) => {
    parts.push({
      text: `[id=${v.garment.id}, categoría=${v.garment.category}${
        v.garment.name ? ", nombre=" + v.garment.name : ""
      }${v.garment.formality ? ", ocasión=" + v.garment.formality : ""}${
        v.garment.climate ? ", clima=" + v.garment.climate : ""
      }]`,
    });
    parts.push({ inline_data: { mime_type: v.mime, data: v.data } });
  });

  const tGemini = Date.now();
  // Estrategia de reintentos:
  //  - 429 (quota por key): rotamos a la siguiente key inmediatamente.
  //  - 503 (modelo sobrecargado): backoff exponencial sobre la misma key,
  //    hasta 2 reintentos. Si sigue cayendo, probamos `flash-lite` que
  //    suele estar menos pedido aunque sea un toque menos capaz.
  //  - Otros 5xx: tratamos igual que 503.
  //  - Network exception: pasamos a la siguiente key.
  // flash-lite primero: en pruebas tarda ~40% menos y para outfit-picking
  // con prendas ya pre-clasificadas (category/formality/climate) da
  // resultados equivalentes. flash queda de fallback si lite falla o
  // está caído.
  const models = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
  let response: Response | null = null;
  let lastStatus: number | null = null;

  outer: for (const model of models) {
    for (let i = 0; i < keys.length; i++) {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          const wait = 500 * 2 ** (attempt - 1); // 500ms, 1000ms
          console.warn(
            `[suggest-outfit] ${model} 503 retry #${attempt} en ${wait}ms`,
          );
          await new Promise((r) => setTimeout(r, wait));
        }
        const ac = new AbortController();
        const timeoutId = setTimeout(() => ac.abort(), 55000);
        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keys[i]}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: ac.signal,
              body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: {
                  // 0.4 da combinaciones consistentes sin volverse robótico.
                  // Más bajo que esto y siempre tira el mismo outfit.
                  temperature: 0.4,
                  // El output es solo ids + 1-2 frases de reasoning. Con
                  // 1200 sobra muchísimo y el modelo termina más rápido.
                  maxOutputTokens: 1200,
                  // JSON estructurado: garantiza output parseable.
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: "OBJECT",
                    properties: {
                      garment_ids: {
                        type: "ARRAY",
                        items: { type: "STRING" },
                      },
                      reasoning: { type: "STRING" },
                    },
                    required: ["garment_ids", "reasoning"],
                  },
                },
              }),
            },
          );
        } catch (err) {
          console.warn(`[suggest-outfit] ${model} key #${i + 1} exception:`, err);
          response = null;
        } finally {
          clearTimeout(timeoutId);
        }
        lastStatus = response?.status ?? null;

        if (!response) break; // network error → cambiar de key
        if (response.ok) break outer; // éxito
        if (response.status === 429) break; // quota: ir a la siguiente key
        if (response.status >= 500 && response.status < 600) continue; // overload: reintentar misma key
        break outer; // 4xx no-429: error real, salir
      }
      if (response?.status === 429) {
        console.warn(
          `[suggest-outfit] ${model} key #${i + 1}/${keys.length} agotada, rotando...`,
        );
        continue;
      }
      break;
    }
    if (response?.ok) break;
    if (response?.status && response.status >= 500) {
      console.warn(`[suggest-outfit] ${model} sigue caído, fallback a siguiente modelo...`);
      continue; // probar el siguiente modelo (flash-lite)
    }
  }
  console.log(
    `[suggest-outfit] gemini ${Date.now() - tGemini}ms, status ${lastStatus}`,
  );

  // Helper: cuando la IA falla por la razón que sea, armamos un outfit
  // simple sin IA (1 prenda random por categoría, excluyendo recientes).
  // Mejor entregar ALGO antes que un 502 — el usuario puede regenerar
  // o aceptar igual.
  const buildFallbackResponse = (reason: string) => {
    const fallback = buildFallbackOutfit(valid.map((v) => v.garment));
    if (fallback.length === 0) {
      return NextResponse.json(
        { error: reason, callsLeft: unlimited ? MAX_AI_CALLS_PER_DAY : Math.max(0, MAX_AI_CALLS_PER_DAY - callsToday) },
        { status: 502 },
      );
    }
    const photoUrls: Record<string, string> = {};
    for (const g of fallback) {
      const url = photoMap.get(g.photo_path);
      if (url) photoUrls[g.id] = url;
    }
    return NextResponse.json({
      garments: fallback,
      photoUrls,
      reasoning:
        "Armé esto con un mix simple de tu clóset — la IA está caída en este momento. Podés tocar Regenerar más tarde para una sugerencia con razonamiento.",
      weather,
      occasion,
      source: "fallback" as const,
      // El fallback NO consume cupo (no usó IA).
      callsLeft: unlimited
        ? MAX_AI_CALLS_PER_DAY
        : Math.max(0, MAX_AI_CALLS_PER_DAY - callsToday),
      unlimited,
    });
  };

  if (!response) {
    console.warn("[suggest-outfit] sin response, devolviendo fallback");
    return buildFallbackResponse("ai_failed");
  }
  if (response.status === 429) {
    console.warn("[suggest-outfit] 429 en todas las keys, fallback");
    return buildFallbackResponse("quota_exceeded");
  }
  if (response.status >= 500 && response.status < 600) {
    console.warn(`[suggest-outfit] ${response.status} sostenido, fallback`);
    return buildFallbackResponse("ai_overloaded");
  }
  if (!response.ok) {
    const errBody = await response.text().catch(() => "<no body>");
    console.error(
      "[suggest-outfit] AI error",
      response.status,
      errBody.slice(0, 300),
    );
    return buildFallbackResponse("ai_failed");
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const raw = (candidate?.content?.parts?.[0]?.text ?? "")
    .trim()
    .replace(/^```json\s*|\s*```$/g, "")
    .replace(/^```\s*|\s*```$/g, "");
  console.log(
    `[suggest-outfit] finishReason=${finishReason}, raw (${raw.length} chars):`,
    raw.slice(0, 800),
  );

  let parsed: { garment_ids?: unknown; reasoning?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("[suggest-outfit] JSON.parse falló:", err);
    // Fallback regex: extraemos UUIDs del texto crudo. Si Gemini devolvió
    // algo casi-JSON pero malformado, igual rescatamos los ids.
    const uuidRe =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const extracted = raw.match(uuidRe) ?? [];
    if (extracted.length === 0) {
      return NextResponse.json({ error: "parse_failed" }, { status: 502 });
    }
    parsed = {
      garment_ids: extracted,
      reasoning: "",
    };
    console.warn(
      `[suggest-outfit] recuperados ${extracted.length} ids vía regex`,
    );
  }

  // 7) Validación + dedupe: cada id devuelto tiene que pertenecer al set
  //    válido, y NO se permite el mismo id dos veces (la prompt lo prohíbe
  //    pero defendemos el caso por si la IA falla).
  const validIds = new Set(valid.map((v) => v.garment.id));
  const seen = new Set<string>();
  const suggestedIds: string[] = [];
  if (Array.isArray(parsed.garment_ids)) {
    for (const raw of parsed.garment_ids as unknown[]) {
      if (typeof raw !== "string") continue;
      if (!validIds.has(raw)) continue;
      if (seen.has(raw)) continue;
      seen.add(raw);
      suggestedIds.push(raw);
    }
  }
  if (suggestedIds.length === 0) {
    return NextResponse.json({ error: "no_valid_ids" }, { status: 502 });
  }

  // 7b) Defensa: la IA a veces se "olvida" alguna categoría base aunque
  //     el prompt lo prohíba. Si falta superior, inferior o calzado y
  //     el clóset tiene esa categoría disponible, sumamos uno random.
  //     Mejor un outfit completo "menos elegante" que uno incompleto.
  const garmentById = new Map(valid.map((v) => [v.garment.id, v.garment]));
  const haveCategories = new Set(
    suggestedIds.map((id) => garmentById.get(id)?.category).filter(Boolean),
  );
  const garmentsByCategory = new Map<string, Garment[]>();
  for (const v of valid) {
    const arr = garmentsByCategory.get(v.garment.category) ?? [];
    arr.push(v.garment);
    garmentsByCategory.set(v.garment.category, arr);
  }
  const required = ["superior", "inferior", "calzado"] as const;
  for (const cat of required) {
    if (haveCategories.has(cat)) continue;
    const pool = garmentsByCategory.get(cat) ?? [];
    if (pool.length === 0) continue; // el closet no tiene; no podemos hacer nada
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!seen.has(pick.id)) {
      suggestedIds.push(pick.id);
      seen.add(pick.id);
      haveCategories.add(cat);
      console.log(
        `[suggest-outfit] IA olvidó ${cat}, agregamos id=${pick.id} (${pick.name ?? "sin nombre"})`,
      );
    }
  }

  // 8) Respuesta: prendas en el orden que la IA las puso, con sus URLs
  const outfitGarments = suggestedIds
    .map((id) => valid.find((v) => v.garment.id === id)?.garment)
    .filter((g): g is Garment => g !== undefined);
  const photoUrls: Record<string, string> = {};
  for (const g of outfitGarments) {
    const url = photoMap.get(g.photo_path);
    if (url) photoUrls[g.id] = url;
  }

  const reasoning =
    typeof parsed.reasoning === "string"
      ? parsed.reasoning.trim().slice(0, 500)
      : "";

  // Incrementar contador diario en DB. Solo si NO es usuario con cupo
  // ilimitado y solo cuando la IA arma un outfit válido. Fallos y usuarios
  // unlimited no consumen ni mueven el contador.
  let callsLeft: number;
  if (unlimited) {
    callsLeft = MAX_AI_CALLS_PER_DAY; // valor de relleno; el cliente lee `unlimited`
  } else {
    const newCount = callsToday + 1;
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ ai_calls_count: newCount, ai_calls_date: today })
      .eq("id", user.id);
    if (updateErr) {
      console.warn("[suggest-outfit] update ai_calls falló:", updateErr);
      // No bloqueamos: el outfit está armado, lo devolvemos igual.
    }
    callsLeft = Math.max(0, MAX_AI_CALLS_PER_DAY - newCount);
  }

  console.log(
    `[suggest-outfit] total ${Date.now() - tStart}ms · ${outfitGarments.length} prendas · ${unlimited ? "∞" : `${callsLeft}/${MAX_AI_CALLS_PER_DAY}`} restantes`,
  );

  return NextResponse.json({
    garments: outfitGarments,
    photoUrls,
    reasoning,
    weather,
    occasion,
    source: "ai_suggested",
    callsLeft,
    unlimited,
  });
}

// ─────────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────────

type HistoricalOutfit = {
  wornDate: string;
  occasion: string | null;
  garmentIds: string[];
};

function buildPrompt(
  garments: Garment[],
  weather: WeatherSnapshot | null,
  occasion: string,
  recentlyUsed: Set<string>,
  stylePreferences: string | null,
  historicalOutfits: HistoricalOutfit[],
  historicalGarmentsMap: Map<string, { name: string | null; category: string }>,
): string {
  // Le pasamos el ESTIMADO DEL DÍA primero (lo más importante para escoger
  // el outfit) y el estado actual como referencia secundaria. Si va a
  // llover, abrigar, o subir la temperatura: el outfit debe servir todo
  // el día, no solo el momento en que abre la app.
  const weatherLine = weather
    ? [
        `Clima del DÍA (estimado completo, esto manda para escoger):`,
        `  - Rango: ${weather.tempMin}°C a ${weather.tempMax}°C (sensación ${weather.apparentMin}° a ${weather.apparentMax}°)`,
        `  - Predominante: ${weather.dayDescription}`,
        weather.precipitationProbability != null
          ? `  - Lluvia: ${weather.precipitationProbability}% probabilidad${weather.precipitationSum != null && weather.precipitationSum > 0 ? `, ~${weather.precipitationSum}mm esperados` : ""}`
          : "",
        weather.uvIndexMax != null
          ? `  - UV máximo: ${weather.uvIndexMax}${weather.uvIndexMax >= 8 ? " (alto, considerar gorra/gafas)" : ""}`
          : "",
        `Ahora mismo: ${weather.temperature}°C, ${weather.description}, humedad ${weather.humidity}%. ${weather.city ?? ""}`.trim(),
      ]
        .filter(Boolean)
        .join("\n")
    : "Clima: no disponible.";

  const occasionLine = occasion
    ? `Plan del día del usuario: "${occasion}".`
    : "El usuario no especificó un plan en particular.";

  const recentIds = garments.filter((g) => recentlyUsed.has(g.id)).map((g) => g.id);
  const recentLine =
    recentIds.length > 0
      ? `Prendas usadas en los últimos días (EVITAR salvo que no haya alternativa razonable): ${recentIds.join(", ")}`
      : "No hay prendas usadas recientemente — todas disponibles.";

  const preferencesBlock = stylePreferences?.trim()
    ? `PREFERENCIAS DEL USUARIO (texto libre, respetalas salvo que vayan en contra del clima o la ocasión):\n"${stylePreferences.trim()}"`
    : "El usuario no especificó preferencias particulares.";

  // ESTILO HISTÓRICO — últimos outfits aceptados. Le da a la IA pattern
  // de los gustos reales del usuario sin necesidad de ML. Cada línea es
  // un outfit pasado con: fecha relativa, ocasión (si la había) y la
  // composición usando "categoría: nombre" para que la IA "vea" el patrón
  // sin tener que cargar las fotos antiguas.
  const todayMs = Date.now();
  const historyLines = historicalOutfits
    .map((o) => {
      const pieces = o.garmentIds
        .map((id) => historicalGarmentsMap.get(id))
        .filter((g): g is { name: string | null; category: string } => !!g)
        .map((g) => `${g.category}: ${g.name?.trim() || "(sin nombre)"}`);
      if (pieces.length === 0) return null;
      const daysAgo = Math.max(
        0,
        Math.round(
          (todayMs - new Date(o.wornDate + "T12:00:00").getTime()) /
            86_400_000,
        ),
      );
      const when =
        daysAgo === 0
          ? "hoy"
          : daysAgo === 1
            ? "ayer"
            : `hace ${daysAgo}d`;
      const occ = o.occasion?.trim() ? ` [${o.occasion.trim().slice(0, 40)}]` : "";
      return `- ${when}${occ}: ${pieces.join(" + ")}`;
    })
    .filter((l): l is string => l !== null);

  const historyBlock =
    historyLines.length > 0
      ? `ESTILO HISTÓRICO DEL USUARIO (últimos ${historyLines.length} outfits aceptados — úsalos como referencia de su gusto personal, no como restricción rígida. Notá patrones de color, formalidad, qué empareja con qué, qué tipo de accesorios usa):\n${historyLines.join("\n")}`
      : "El usuario todavía no aceptó ningún outfit — no hay historial de estilo.";

  return `Sos un estilista personal. Te paso ${garments.length} prendas activas del clóset de un usuario. Cada prenda viene con su id, categoría y metadata, seguida de su foto (fondo limpio).

${weatherLine}
${occasionLine}
${recentLine}
${preferencesBlock}

${historyBlock}

REGLAS:
1. OBLIGATORIO en TODO outfit, sin excepción: 1 prenda con category="superior" + 1 con category="inferior" + 1 con category="calzado". Si te falta alguna en tu respuesta, ESTÁ MAL. Revisá tu output antes de mandarlo.
2. Sumá UNA sola sobreprenda si el clima lo pide (frío, lluvia) — nunca dos. No es obligatoria.
3. NO repitas prendas recientes salvo que sea estrictamente necesario.
4. Combiná por color, estilo y ocasión coherente con el clima y el plan del día. Usá las fotos, no solo el nombre.
5. Preferí prendas cuya formality/climate match el plan y el clima reportado.
6. Los ids DEBEN ser exactos a los que te pasé. No inventés ni modifiqués.
7. Si en el reasoning mencionás una prenda (ej. "tenis blancos"), ese id DEBE estar en garment_ids. No menciones prendas que no incluiste.

REGLAS DE ACCESORIOS (las prendas con category="accesorio" son MUY variadas):
- Identificá VISUALMENTE qué tipo de accesorio es cada uno (gorra/cachucha, gafas, bufanda, cadena/collar, correa/cinturón, reloj, pulsera/manilla, anillo, bolso/mochila, corbata, etc).
- UNA sola pieza por tipo: máximo 1 gorra, 1 par de gafas, 1 bufanda, 1 cadena, 1 correa, 1 reloj, 1 corbata, 1 bolso, 1 par de aretes.
- EXCEPCIÓN: anillos y pulseras/manillas pueden ir varios (es normal usar 2-3 anillos o 2 pulseras a la vez).
- Total de accesorios en el outfit: 0 a 4 piezas. Solo sumalos si VISUALMENTE combinan con la ropa elegida (color, estilo, formalidad). Si dudás, mejor menos.
- NUNCA pongas dos veces la misma prenda (mismo id).

RESPONDÉ SOLO JSON, sin markdown ni texto extra:
{"garment_ids":["<id1>","<id2>", ...], "reasoning":"<1-2 frases en español colombiano explicándole al usuario tu elección, sin tecnicismos>"}`;
}

// ─────────────────────────────────────────────────────────────────────
// Weather helper — duplicado mínimo de /api/weather para no agregar otro
// roundtrip HTTP interno. Si más adelante extraemos a lib/weather.ts
// ambos endpoints lo comparten.
// ─────────────────────────────────────────────────────────────────────

async function fetchWeather(
  lat: number,
  lng: number,
  city: string | null,
): Promise<WeatherSnapshot | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set(
      "current",
      "temperature_2m,weather_code,is_day,relative_humidity_2m,apparent_temperature",
    );
    // Estimado del día COMPLETO — la IA usa esto para escoger el outfit
    // (no solo lo que hace ahora). Incluimos rangos de temp + sensación,
    // weather_code predominante, probabilidad de lluvia, mm esperados, UV.
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,weather_code,precipitation_probability_max,precipitation_sum,uv_index_max",
    );
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "auto");
    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const current = data?.current ?? {};
    const daily = data?.daily ?? {};
    const dayCode =
      typeof daily.weather_code?.[0] === "number" ? daily.weather_code[0] : null;
    return {
      temperature: roundOrNull(current.temperature_2m),
      apparent: roundOrNull(current.apparent_temperature),
      humidity: roundOrNull(current.relative_humidity_2m),
      weatherCode:
        typeof current.weather_code === "number" ? current.weather_code : null,
      isDay: current.is_day === 1,
      description: describeWeather(current.weather_code, current.is_day === 1),
      tempMin: roundOrNull(daily.temperature_2m_min?.[0]),
      tempMax: roundOrNull(daily.temperature_2m_max?.[0]),
      apparentMin: roundOrNull(daily.apparent_temperature_min?.[0]),
      apparentMax: roundOrNull(daily.apparent_temperature_max?.[0]),
      dayWeatherCode: dayCode,
      dayDescription: describeWeather(dayCode, true),
      precipitationProbability: roundOrNull(daily.precipitation_probability_max?.[0]),
      precipitationSum:
        typeof daily.precipitation_sum?.[0] === "number"
          ? Math.round(daily.precipitation_sum[0] * 10) / 10
          : null,
      uvIndexMax: roundOrNull(daily.uv_index_max?.[0]),
      city,
    };
  } catch (err) {
    console.warn("[suggest-outfit] weather:", err);
    return null;
  }
}

function roundOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

/**
 * Algoritmo no-IA: arma un outfit con 1 prenda random por categoría base
 * + opcionalmente sobreprenda + 1-2 accesorios. Se usa como fallback
 * cuando Gemini cae completamente. No es "inteligente" pero respeta la
 * estructura mínima (superior + inferior + calzado).
 */
function buildFallbackOutfit(garments: Garment[]): Garment[] {
  const byCategory = new Map<string, Garment[]>();
  for (const g of garments) {
    const arr = byCategory.get(g.category) ?? [];
    arr.push(g);
    byCategory.set(g.category, arr);
  }
  const pick = (slot: string): Garment | null => {
    const arr = byCategory.get(slot) ?? [];
    if (arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  };
  const pickN = (slot: string, n: number): Garment[] => {
    const arr = [...(byCategory.get(slot) ?? [])];
    const take = Math.min(n, arr.length);
    for (let i = 0; i < take; i++) {
      const j = i + Math.floor(Math.random() * (arr.length - i));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, take);
  };

  const accessoriesAvail = (byCategory.get("accesorio") ?? []).length;
  const outfit = [
    pick("superior"),
    pick("inferior"),
    pick("calzado"),
    pick("sobreprenda"),
    ...pickN("accesorio", Math.min(accessoriesAvail, 2)),
  ].filter((g): g is Garment => g !== null);
  return outfit;
}

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
