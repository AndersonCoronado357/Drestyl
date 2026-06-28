import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_SLUGS, isValidCategory } from "@/lib/categories";

/**
 * Clasifica una o varias prendas con Gemini en UNA sola llamada.
 *
 * Body (multipart/form-data):
 *   - `photo` (1 archivo)  → respuesta { category, name } (modo single)
 *   - `photos` (N archivos) → respuesta { suggestions: [{category, name}] } (batch)
 *
 * Cuando hay varias fotos las mandamos todas en el mismo request a Gemini
 * — es muchísimo más rápido que N requests sueltos (sin cold start por foto,
 * sin overhead de TLS handshake, sin rate limit acumulado).
 */
export async function POST(request: NextRequest) {
  const tReq = Date.now();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log(`[suggest-category] auth ${Date.now() - tReq}ms`);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawKeys = (
    process.env.GEMINI_API_KEYS ||
    process.env.GEMINI_API_KEY ||
    ""
  )
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (rawKeys.length === 0) {
    return NextResponse.json({ error: "no_key" }, { status: 500 });
  }
  const apiKeys = [...rawKeys].sort(() => Math.random() - 0.5);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "no_body" }, { status: 400 });
  }

  // Acumula todas las fotos: tanto `photo` (single legacy) como `photos` (batch).
  const files: File[] = [];
  const single = formData.get("photo");
  if (single instanceof File && single.size > 0) files.push(single);
  for (const entry of formData.getAll("photos")) {
    if (entry instanceof File && entry.size > 0) files.push(entry);
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "no_photo" }, { status: 400 });
  }
  if (files.length > 30) {
    return NextResponse.json({ error: "too_many_photos" }, { status: 400 });
  }

  const isBatch = files.length > 1 || formData.has("photos");

  // Convierte cada foto a base64 (Gemini espera inline_data).
  const tEncode = Date.now();
  const parts: Array<
    { text: string } | { inline_data: { mime_type: string; data: string } }
  > = [];
  parts.push({ text: buildPrompt(files.length) });
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    parts.push({
      inline_data: { mime_type: f.type, data: buf.toString("base64") },
    });
  }
  console.log(
    `[suggest-category] ${files.length} foto(s) encoded en ${Date.now() - tEncode}ms`,
  );

  try {
    const tGemini = Date.now();
    const reqBody = JSON.stringify({
      contents: [{ parts }],
      // Generoso para batch: 50 tokens por prenda × 30 max + buffer.
      generationConfig: { temperature: 0.3, maxOutputTokens: 2500 },
    });
    // Modelos en orden: lite (rápido/barato) primero; si está sobrecargado
    // (503) o falla, cae a modelos con más capacidad. 429 (cuota) = otra key.
    const MODELS = [
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash",
      "gemini-2.5-flash",
    ];
    let response: Response | null = null;
    let usedModel = "";
    for (const model of MODELS) {
      for (let i = 0; i < apiKeys.length; i++) {
        const ac = new AbortController();
        const timeoutId = setTimeout(() => ac.abort(), 25000);
        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeys[i]}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: ac.signal,
              body: reqBody,
            },
          ).finally(() => clearTimeout(timeoutId));
        } catch (e) {
          console.warn(`[suggest-category] ${model} key#${i + 1} fetch fail:`, e);
          response = null;
          continue; // red/timeout → siguiente key
        }
        usedModel = model;
        if (response.ok) break;
        if (response.status === 429) {
          console.warn(`[suggest-category] ${model} key #${i + 1} cuota, siguiente key...`);
          continue; // cuota es por key → probar otra key
        }
        // 503/500 (sobrecarga) u otro: no insistir con más keys del mismo modelo
        console.warn(`[suggest-category] ${model} status ${response.status}, siguiente modelo...`);
        break;
      }
      if (response?.ok) break;
      // Si el último error NO fue transitorio (429/503/500), no probar más modelos.
      if (
        response &&
        response.status !== 429 &&
        response.status !== 503 &&
        response.status !== 500
      )
        break;
    }
    if (!response) throw new Error("no response received");
    console.log(
      `[suggest-category] gemini(${usedModel}) ${Date.now() - tGemini}ms, status ${response.status}`,
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "<no body>");
      console.error("[suggest-category] API error", response.status, body.slice(0, 300));
      const reason = response.status === 429 ? "quota_exceeded" : "api_error";
      return NextResponse.json(
        { error: reason, status: response.status },
        { status: 502 },
      );
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const raw = (candidate?.content?.parts?.[0]?.text ?? "")
      .trim()
      .replace(/^```json\s*|\s*```$/g, "")
      .replace(/^```\s*|\s*```$/g, "");

    console.log("[suggest-category] finishReason:", finishReason);
    console.log("[suggest-category] raw:", raw.slice(0, 300));

    if (!raw) {
      return emptyResponse(isBatch, files.length, "empty_response");
    }

    // Parsear: si batch, esperamos array. Si single, esperamos objeto.
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return emptyResponse(isBatch, files.length, "parse_failed");
    }

    if (isBatch) {
      // Gemini con 1 sola foto a veces devuelve {} en vez de [{}] aunque
      // le pidamos array. Lo envolvemos si vino objeto suelto.
      const arr = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
          ? [parsed]
          : [];
      const suggestions = files.map((_, i) => {
        const item = arr[i] as
          | {
              category?: string;
              name?: string;
              formality?: string;
              climate?: string;
            }
          | undefined;
        return normalize(item);
      });
      return NextResponse.json({ suggestions });
    } else {
      const obj = parsed as {
        category?: string;
        name?: string;
        formality?: string;
        climate?: string;
      };
      const result = normalize(obj);
      return NextResponse.json({ ...result, valid: CATEGORY_SLUGS });
    }
  } catch (err) {
    console.error("[suggest-category] EXCEPTION:", err);
    return emptyResponse(isBatch, files.length, "exception");
  }
}

const FORMALITIES = ["formal", "elegante", "casual", "deportivo"] as const;
const CLIMATES = ["frio", "templado", "calor", "mixto"] as const;
type Formality = (typeof FORMALITIES)[number];
type Climate = (typeof CLIMATES)[number];

function normalize(
  item:
    | { category?: string; name?: string; formality?: string; climate?: string }
    | undefined,
): {
  category: string | null;
  name: string | null;
  formality: Formality | null;
  climate: Climate | null;
} {
  const category = isValidCategory(item?.category) ? item.category : null;
  const name =
    typeof item?.name === "string" && item.name.trim().length > 0
      ? item.name.trim().slice(0, 80)
      : null;
  const formality = FORMALITIES.includes(item?.formality as Formality)
    ? (item!.formality as Formality)
    : null;
  const climate = CLIMATES.includes(item?.climate as Climate)
    ? (item!.climate as Climate)
    : null;
  return { category, name, formality, climate };
}

function emptyResponse(isBatch: boolean, n: number, reason: string) {
  if (isBatch) {
    return NextResponse.json({
      suggestions: Array(n).fill({ category: null, name: null }),
      reason,
    });
  }
  return NextResponse.json({ category: null, name: null, reason });
}

function buildPrompt(numPhotos: number): string {
  const isBatch = numPhotos > 1;
  const formatSection = isBatch
    ? `Te paso ${numPhotos} prendas en orden. Responde SOLO JSON, un array con ${numPhotos} elementos en el MISMO ORDEN. Sin markdown:
[{"category":"<slug>","name":"<nombre>","formality":"<formal|casual|deportivo|elegante>","climate":"<frio|templado|calor|mixto>"}, ...${numPhotos > 2 ? " (un objeto por cada foto)" : ""}]`
    : `Clasifica esta prenda. Responde SOLO JSON, sin markdown:
{"category":"<slug>","name":"<nombre>","formality":"<formal|casual|deportivo|elegante>","climate":"<frio|templado|calor|mixto>"}`;

  return `${formatSection}

Para cada foto, decidí: ¿el sujeto es una prenda de vestir, calzado o
accesorio? Sin medias tintas.

CASO A — SÍ es prenda/calzado/accesorio (puede estar doblada, en persona,
en maniquí, colgada, mal iluminada, con ángulo raro o fondo desordenado):
clasifícala con las 5 categorías abajo.

CASO B — NO es prenda (animal o mascota, comida, mueble, paisaje, vehículo,
electrónico, herramienta, planta, juguete, screenshot, meme, persona sin
enfoque en su ropa): category=null, name="No es una prenda", formality=null,
climate=null.

CATEGORÍAS (usa una exacta — son SOLO 5):
- superior: camisetas, camisas, polos, blusas, esqueletos, suéteres/buzos SIN cierre
- sobreprenda: chaquetas, chamarras, blazers, abrigos, chalecos, hoodies, busos CON cierre o capota
- inferior: pantalones, jeans, pantalonetas, shorts, bermudas, joggers, leggings, faldas
- calzado: tenis, guayos, zapatos, sandalias, chanclas, botas, botines
- accesorio: gorras, cachuchas, bufandas, correas/cinturones, gafas, corbatas, bolsos, mochilas, anillos, cadenas, aretes, relojes, pulseras, manillas (joyería va acá también)

NAME en español colombiano, 3-6 palabras, OBLIGATORIO nunca null:
- Si ves marca/logo legible (Nike, Adidas, Puma, Vans, Converse, Jordan, Levi's, Tommy, Lacoste, Zara…) inclúyela: "Tenis Nike Air Force blancos".
- Si ves modelo (Air Max, 501, Stan Smith) inclúyelo.
- Sin marca: color + tipo + corte/material: "Jean azul oscuro slim", "Chaqueta beige oversize gamuza".
- Siempre color. Si hay estampado obvio, menciónalo.
- Mínimo "color + tipo" si la foto es pobre: "Pantaloneta gris".

FIT (incluir en el name solo si claro): oversize, slim, baggy, cropped, relaxed.

FORMALITY (siempre devolver uno):
- formal: traje, blazer estructurado, camisa de vestir, zapatos formales
- elegante: blazer casual, camisa cuidada, chinos, mocasines
- casual: jeans, camisetas, polos, tenis, sudaderas
- deportivo: pantalonetas, leggings, ropa de gym/jogging, tenis deportivos

CLIMATE (siempre devolver uno):
- frio: chaquetas, abrigos, suéteres gruesos, botas
- templado: jeans, camisetas, suéteres delgados, tenis (la mayoría)
- calor: pantalonetas, blusas/camisetas ligeras, sandalias
- mixto: prendas neutras que funcionan en varios climas${isBatch ? `\n\nIMPORTANTE: array con EXACTAMENTE ${numPhotos} elementos en el orden de las fotos.` : ""}`;
}
