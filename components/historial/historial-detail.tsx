"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { GarmentCard } from "@/components/closet/garment-card";
import type { Garment } from "@/lib/garments";

type Outfit = {
  id: string;
  wornDate: string;
  occasion: string | null;
  reasoning: string | null;
  source: "ai_suggested" | "user_edited" | "fallback";
  weather: unknown;
};

type WeatherSnapshot = {
  temperature?: number | null;
  description?: string | null;
  tempMin?: number | null;
  tempMax?: number | null;
  city?: string | null;
};

type Props = {
  outfit: Outfit;
  garments: Garment[];
  photoUrls: Record<string, string>;
};

/**
 * Vista detallada de un outfit del historial. Similar a /sugerencia pero
 * SIN acciones (sin Usar, sin Regenerar, sin Cambiar, sin Agregar) —
 * el historial es solo registro.
 *
 * Tap a una prenda navega a /closet/[id] (NO al picker de cambiar, que
 * solo aplica al outfit del día actual).
 */
export function HistorialDetail({ outfit, garments, photoUrls }: Props) {
  const router = useRouter();
  const dateLabel = formatDateLabel(outfit.wornDate);
  const weather = (outfit.weather ?? null) as WeatherSnapshot | null;

  return (
    <section className="flex min-h-0 flex-1 flex-col pt-4 lg:pt-6 animate-fade-in">
      {/* Header — fijo arriba */}
      <header className="mb-3 shrink-0 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <Link
          href="/historial"
          className="h-9 inline-flex items-center rounded-full bg-accent/8 px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent/15"
        >
          Volver
        </Link>
        <div className="text-center min-w-0">
          <p className="text-xs text-muted-foreground">{dateLabel.relative}</p>
          <h1 className="mt-0.5 truncate text-base font-semibold capitalize tracking-tight lg:text-lg">
            {dateLabel.absolute}
          </h1>
        </div>
        {outfit.source !== "ai_suggested" ? (
          <span className="h-9 shrink-0 inline-flex items-center rounded-full bg-accent/15 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
            {outfit.source === "user_edited" ? "Editado" : "Sin IA"}
          </span>
        ) : (
          <span className="h-9 w-[3rem]" aria-hidden />
        )}
      </header>

      {/* Reasoning + clima + ocasión — card combinada */}
      <div className="mb-4 shrink-0 rounded-2xl bg-accent/8 px-4 py-3">
        {outfit.reasoning && (
          <>
            <div className="mb-1 flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-foreground">
                <SparkleIcon />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                Por qué este outfit
              </p>
            </div>
            <p className="text-xs leading-relaxed text-foreground">
              {outfit.reasoning}
            </p>
          </>
        )}
        {(outfit.occasion || weather) && (
          <div
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground ${outfit.reasoning ? "mt-3 border-t border-accent/15 pt-2" : ""}`}
          >
            {outfit.occasion && (
              <span>
                <span className="font-semibold text-foreground">Ocasión:</span>{" "}
                {outfit.occasion}
              </span>
            )}
            {weather?.temperature != null && (
              <span>
                <span className="font-semibold text-foreground">Clima:</span>{" "}
                {weather.temperature}°
                {weather.description ? ` · ${weather.description}` : ""}
                {weather.city ? ` · ${weather.city}` : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Grid de prendas (scroll vertical) */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {garments.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Las prendas de este outfit ya no están en tu clóset.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {garments.map((g) => (
              <GarmentCard
                key={g.id}
                garment={g}
                photoUrl={photoUrls[g.id] ?? undefined}
                onClick={() => router.push(`/closet/${g.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function formatDateLabel(wornDate: string): {
  relative: string;
  absolute: string;
} {
  const today = todayLocalDateStr();
  const days = daysBetween(wornDate, today);
  let relative: string;
  if (days === 0) relative = "Hoy";
  else if (days === 1) relative = "Ayer";
  else if (days < 7) relative = `Hace ${days} días`;
  else if (days < 14) relative = "La semana pasada";
  else if (days < 30) relative = `Hace ${Math.floor(days / 7)} semanas`;
  else relative = `Hace ${Math.floor(days / 30)} meses`;

  const [y, m, d] = wornDate.split("-").map((p) => parseInt(p, 10));
  const dt = new Date(y, m - 1, d);
  const absolute = dt.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return { relative, absolute };
}

function todayLocalDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map((p) => parseInt(p, 10));
  const [by, bm, bd] = b.split("-").map((p) => parseInt(p, 10));
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.abs(Math.round((db - da) / 86_400_000));
}

function SparkleIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4L12 2z" />
    </svg>
  );
}
