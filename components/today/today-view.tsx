"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Weather = {
  city: string | null;
  temperature: number | null;
  apparent: number | null;
  humidity: number | null;
  tempMax: number | null;
  tempMin: number | null;
  weatherCode: number | null;
  isDay: boolean;
  description: string;
};

type WeatherState =
  | { status: "loading" }
  | { status: "ok"; data: Weather; refreshing: boolean }
  | { status: "error"; message: string };

const REFRESH_MS = 5 * 60 * 1000;
const CACHE_KEY = "drestyl:weather:v1";

export function TodayView({
  displayName,
  activeGarments,
}: {
  displayName: string;
  activeGarments: number;
}) {
  const [weather, setWeather] = useState<WeatherState>({ status: "loading" });
  const [occasion, setOccasion] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Lee el cache de localStorage DESPUÉS del primer render para no
    // causar hydration mismatch (server no tiene localStorage).
    // Si había cache, lo pintamos al instante y refrescamos en paralelo.
    let hadCache = false;
    try {
      const cached = window.localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { data: Weather };
        if (parsed?.data) {
          setWeather({ status: "ok", data: parsed.data, refreshing: true });
          hadCache = true;
        }
      }
    } catch {}

    async function fetchWeather(silent: boolean) {
      try {
        const res = await fetch("/api/weather", { cache: "no-store" });
        const data = await res.json();
        if (!mountedRef.current) return;
        if (!res.ok) {
          if (!silent) {
            setWeather((prev) =>
              prev.status === "ok"
                ? { ...prev, refreshing: false }
                : {
                    status: "error",
                    message:
                      data?.error === "no_location"
                        ? "Falta configurar tu ubicación."
                        : "No pudimos cargar el clima.",
                  },
            );
          }
          return;
        }
        setWeather({ status: "ok", data, refreshing: false });
        try {
          window.localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ data, ts: Date.now() }),
          );
        } catch {}
      } catch {
        if (mountedRef.current && !silent) {
          setWeather((prev) =>
            prev.status === "ok"
              ? { ...prev, refreshing: false }
              : { status: "error", message: "No pudimos cargar el clima." },
          );
        }
      }
    }

    // Si había cache, el fetch es silencioso (no toca el UI). Si no, dejamos
    // que muestre el skeleton hasta que llegue la primera respuesta.
    fetchWeather(hadCache);

    const id = window.setInterval(() => {
      setWeather((prev) =>
        prev.status === "ok" ? { ...prev, refreshing: true } : prev,
      );
      fetchWeather(true);
    }, REFRESH_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden pt-6 lg:pt-10 animate-fade-in">
      <header className="mb-5 shrink-0">
        <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
        <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight lg:text-4xl">
          {greetingFor(today)}, {displayName}
        </h1>
      </header>

      {/* Hero de clima — diseño original con métricas en 3 cols, solo
          reducido en tamaño (no en estructura). */}
      <div className="mb-4 shrink-0">
        {weather.status === "loading" && <WeatherSkeleton />}
        {weather.status === "error" && (
          <div className="rounded-2xl bg-accent/8 p-4">
            <p className="text-sm text-muted-foreground">{weather.message}</p>
          </div>
        )}
        {weather.status === "ok" && (
          <WeatherCard data={weather.data} refreshing={weather.refreshing} />
        )}
      </div>

      {/* Card del clóset — entre clima y ocasión */}
      {activeGarments > 0 ? (
        <Link
          href="/closet"
          className="mb-4 shrink-0 group flex items-center justify-between gap-4 rounded-2xl bg-accent/8 px-4 py-3 transition-colors hover:bg-accent/12 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <HangerIcon size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Tu clóset</p>
              <p className="text-xs text-muted-foreground truncate">
                {activeGarments === 1
                  ? "1 prenda activa"
                  : `${activeGarments} prendas activas`}
              </p>
            </div>
          </div>
          <ChevronRight />
        </Link>
      ) : (
        <Link
          href="/closet/nueva"
          className="mb-4 shrink-0 flex items-center justify-between gap-4 rounded-2xl bg-accent/8 px-4 py-3 transition-colors hover:bg-accent/12"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <HangerIcon size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Tu clóset</p>
              <p className="text-xs text-muted-foreground truncate">
                Aún no tienes prendas. Sumá la primera.
              </p>
            </div>
          </div>
          <ChevronRight />
        </Link>
      )}

      {/* Ocasión — se expande (flex-1) para llenar el alto disponible en
          móvil y PC, sin dejar un hueco entre el textarea y el botón. */}
      <div className="mb-4 flex min-h-0 flex-1 flex-col">
        <label
          htmlFor="occasion"
          className="mb-2 block shrink-0 text-sm font-semibold text-foreground"
        >
          ¿Qué vas a hacer hoy?
        </label>
        <textarea
          id="occasion"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Ej: Reunión con cliente por la mañana y salida casual por la tarde"
          className="custom-scroll w-full flex-1 resize-none rounded-2xl bg-accent/8 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:bg-accent/12 min-h-0"
        />
        <p className="mt-1 shrink-0 text-xs text-muted-foreground">
          {occasion.length}/300 · La IA usará esto para sugerir tu outfit.
        </p>
      </div>

      <Link
        href="/sugerencia"
        onClick={() => {
          if (occasion.trim()) {
            sessionStorage.setItem("drestyl:occasion", occasion);
          } else {
            sessionStorage.removeItem("drestyl:occasion");
          }
        }}
        className="mb-4 h-14 shrink-0 w-full inline-flex items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
      >
        Sugerir outfit
      </Link>
    </section>
  );
}

function WeatherCard({
  data,
  refreshing,
}: {
  data: Weather;
  refreshing: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-accent/8 p-4">
      {refreshing && (
        <span
          className="absolute right-3 top-3 size-1.5 rounded-full bg-accent animate-pulse"
          aria-label="Actualizando clima"
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-accent">
            Ahora
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
              {data.temperature ?? "--"}°
            </span>
          </div>
          <p className="mt-0.5 text-xs font-medium text-foreground">
            {data.description}
          </p>
          {data.city && (
            <p className="truncate text-[11px] text-muted-foreground">{data.city}</p>
          )}
        </div>
        <div className="shrink-0">
          <WeatherIcon code={data.weatherCode} isDay={data.isDay} size={48} />
        </div>
      </div>
      {/* Métricas en 3 cols — diseño original, solo más chico */}
      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-accent/15 pt-2.5">
        <Metric
          label="Mín / máx"
          value={
            data.tempMin != null && data.tempMax != null
              ? `${data.tempMin}° / ${data.tempMax}°`
              : "--"
          }
        />
        <Metric
          label="Sensación"
          value={data.apparent != null ? `${data.apparent}°` : "--"}
        />
        <Metric
          label="Humedad"
          value={data.humidity != null ? `${data.humidity}%` : "--"}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-semibold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}

function WeatherSkeleton() {
  return (
    <div className="rounded-2xl bg-accent/8 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-10 animate-pulse rounded bg-accent/15" />
          <div className="h-9 w-24 animate-pulse rounded bg-accent/15" />
          <div className="h-3 w-32 animate-pulse rounded bg-accent/10" />
          <div className="h-2.5 w-24 animate-pulse rounded bg-accent/10" />
        </div>
        <div className="size-14 animate-pulse rounded-full bg-accent/15" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-accent/15 pt-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-2 w-10 animate-pulse rounded bg-accent/10" />
            <div className="h-3 w-10 animate-pulse rounded bg-accent/15" />
          </div>
        ))}
      </div>
    </div>
  );
}

function WeatherIcon({
  code,
  isDay,
  size = 40,
}: {
  code: number | null;
  isDay: boolean;
  size?: number;
}) {
  // Iconos de marca (PNG) para los estados comunes. La luna (noche despejada)
  // y la nieve se quedan en SVG porque no hay PNG para esos casos.
  let src: string | null = null;
  if (code === 0) src = isDay ? "/icons/weather-sunny.png" : null;
  else if (code === 1 || code === 2) src = "/icons/weather-sunny.png";
  else if (code === 3 || code === 45 || code === 48) src = "/icons/weather-cloudy.png";
  else if ((code != null && code >= 51 && code <= 67) || (code != null && code >= 80 && code <= 82))
    src = "/icons/weather-rain.png";
  else if (code != null && code >= 95) src = "/icons/weather-storm.png";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "contain" }}
        aria-hidden
      />
    );
  }

  // Fallbacks SVG: luna (noche despejada), nieve, o desconocido.
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--color-accent)",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (code === 0 && !isDay) {
    return (
      <svg {...common}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  if (code != null && code >= 71 && code <= 77) {
    return (
      <svg {...common}>
        <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
        <path d="M8 16h.01M8 20h.01M12 18h.01M12 22h.01M16 16h.01M16 20h.01" />
      </svg>
    );
  }
  return <svg {...common} />;
}

function HangerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 18l9-7 9 7" />
      <path d="M12 11V7a2 2 0 1 1 2-2" />
      <path d="M3 18h18" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}
