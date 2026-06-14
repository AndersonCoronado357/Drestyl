"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { OutfitPreview } from "@/components/today/outfit-preview";
import { TshirtLoader } from "@/components/ui/tshirt-loader";
import { saveOutfit } from "@/app/actions/outfits";
import type { Garment } from "@/lib/garments";

// React 19 + Strict Mode en dev dispara useEffect DOS veces al montar.
// Sin abort, eso = 2 POSTs al endpoint a la IA en paralelo. Como cada uno
// puede dispararle 503 a Gemini independientemente, uno suele suceder y
// el otro fallar — el cliente ve el 502 del request perdedor. Usamos
// AbortController para cancelar el primero cuando el effect se re-corre.

type ApiResponse = {
  garments: Garment[];
  photoUrls: Record<string, string>;
  reasoning: string;
  weather: unknown;
  occasion: string;
  source: "ai_suggested" | "fallback" | "user_edited";
  /** Cuántas llamadas a la IA le quedan al usuario hoy. El server lo
   *  calcula desde `profiles.ai_calls_count` — el cliente NO lo manipula. */
  callsLeft: number;
  /** Si el usuario tiene cupo ilimitado (testing/dueño). Cuando es true
   *  el cliente ignora `callsLeft` y muestra el botón sin contador. */
  unlimited?: boolean;
};

type State =
  | { status: "loading" }
  | {
      status: "ok";
      data: ApiResponse;
      regenerating: boolean;
    }
  | { status: "error"; code: string; message: string };

// El límite de llamadas a la IA por día es AUTORITATIVO en el server
// (profiles.ai_calls_count). El cliente solo refleja `callsLeft` que viene
// en la respuesta del endpoint. localStorage NO se usa para esto: era
// manipulable desde DevTools y rompía el límite.

// Persistimos el outfit actual en sessionStorage para el flujo "Cambiar
// pieza". El picker lee este outfit, reemplaza una prenda, y vuelve a
// /sugerencia. El flag `pendingSwap` + `swapAt` (timestamp) le indica a
// OutfitView que hidrate del cache en vez de llamar a la IA.
//
// El flag NO se borra explícitamente — expira por timestamp. Esto evita
// el bug donde React Strict Mode (que monta el componente dos veces en
// dev) hacía que el primer mount limpiara el flag y el segundo llamara
// a la IA. Con expiración de 10s, ambos mounts ven el flag igual.
const SESSION_KEY = "drestyl:current-outfit:v1";
const SWAP_FLAG_TTL_MS = 10_000;

type SessionOutfit = {
  garments: Garment[];
  photoUrls: Record<string, string>;
  reasoning: string;
  weather: unknown;
  occasion: string;
  source: "ai_suggested" | "fallback" | "user_edited";
  callsLeft: number;
  unlimited: boolean;
  pendingSwap: boolean;
  /** Timestamp del swap. Solo se considera "pendiente" si está dentro
   *  de SWAP_FLAG_TTL_MS. Más viejo = stale, se ignora. */
  swapAt?: number;
};

function readPendingSwap(): SessionOutfit | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionOutfit;
    if (!parsed.pendingSwap) return null;
    const swapAt = parsed.swapAt ?? 0;
    if (Date.now() - swapAt > SWAP_FLAG_TTL_MS) return null; // stale
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionOutfit(outfit: SessionOutfit) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(outfit));
  } catch {
    /* sin sessionStorage o cuota llena */
  }
}

/**
 * Cliente que envuelve la pantalla /sugerencia. En cuanto monta llama al
 * endpoint `/api/suggest-outfit` con la ocasión guardada en sessionStorage.
 * Mientras la IA piensa muestra el TshirtLoader. Cuando llega la respuesta
 * renderiza `OutfitPreview` con las prendas elegidas + reasoning real.
 *
 * "Regenerar" dispara un nuevo POST sin perder la pantalla — solo cambia
 * el outfit. Estado intermedio: `regenerating: true` (deshabilita el botón).
 */
export function OutfitView({ totalActive }: { totalActive: number }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  // callsLeft viene del server en cada respuesta. Hasta que llega la primera
  // respuesta no sabemos cuántas le quedan, así que arrancamos con null.
  // Si el usuario es `unlimited` lo seteamos a Infinity (sin counter, sin disable).
  const [callsLeft, setCallsLeft] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [savingUse, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  // Cancelar el request anterior si el usuario regenera mientras está en curso,
  // o si el componente se desmonta. Evita race conditions.
  const inflightRef = useRef<AbortController | null>(null);

  const fetchOutfit = useCallback(async (regenerate: boolean) => {
    // Cancelar request en vuelo antes de disparar uno nuevo.
    inflightRef.current?.abort();
    const ac = new AbortController();
    inflightRef.current = ac;

    if (regenerate) {
      setState((prev) =>
        prev.status === "ok" ? { ...prev, regenerating: true } : prev,
      );
    } else {
      setState({ status: "loading" });
    }

    const occasion = sessionStorage.getItem("drestyl:occasion") ?? "";

    try {
      const res = await fetch("/api/suggest-outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasion }),
        signal: ac.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (ac.signal.aborted) return; // cancelado mientras leíamos

      // El server siempre devuelve callsLeft (en éxito o en daily_limit_reached).
      if (typeof data?.callsLeft === "number") {
        setCallsLeft(data.callsLeft);
      }
      if (typeof data?.unlimited === "boolean") {
        setUnlimited(data.unlimited);
      }

      if (!res.ok) {
        const code = (data?.error as string) ?? "ai_failed";
        setState({
          status: "error",
          code,
          message: errorMessageFor(code),
        });
        return;
      }
      const ok = data as ApiResponse;
      setState({ status: "ok", data: ok, regenerating: false });
      // Cachear el outfit para que la pantalla "Cambiar pieza" lo lea.
      writeSessionOutfit({
        garments: ok.garments,
        photoUrls: ok.photoUrls,
        reasoning: ok.reasoning,
        weather: ok.weather,
        occasion: ok.occasion,
        source: ok.source,
        callsLeft: ok.callsLeft,
        unlimited: ok.unlimited ?? false,
        pendingSwap: false,
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return; // cancelación normal
      console.warn("[outfit-view] fetch error:", err);
      if (!ac.signal.aborted) {
        setState({
          status: "error",
          code: "network",
          message:
            "No pudimos comunicarnos con la IA. Revisá tu conexión y reintentá.",
        });
      }
    } finally {
      if (inflightRef.current === ac) inflightRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Si venimos de "Cambiar pieza", hidrato del sessionStorage en vez de
    // llamar a la IA. Limpio el flag para que la próxima visita SÍ llame.
    const pending = readPendingSwap();
    if (pending) {
      setState({
        status: "ok",
        data: {
          garments: pending.garments,
          photoUrls: pending.photoUrls,
          reasoning: pending.reasoning,
          weather: pending.weather,
          occasion: pending.occasion,
          source: pending.source,
          callsLeft: pending.callsLeft,
          unlimited: pending.unlimited,
        },
        regenerating: false,
      });
      setCallsLeft(pending.callsLeft);
      setUnlimited(pending.unlimited);
      // NO limpiamos el flag — expira solo por timestamp (SWAP_FLAG_TTL_MS).
      // Limpiarlo aquí causaba que el segundo mount de Strict Mode no lo
      // viera y dispare la IA innecesariamente.
      return;
    }
    fetchOutfit(false);
    return () => {
      // Strict Mode en dev re-corre el effect: cancela el primer fetch
      // así no llega al servidor por duplicado.
      inflightRef.current?.abort();
      inflightRef.current = null;
    };
  }, [fetchOutfit]);

  // Loader visible tanto en la primera carga como mientras se regenera.
  // El usuario quería ver el loader explícito en vez del outfit viejo con
  // el botón pulsando.
  const isLoading =
    state.status === "loading" ||
    (state.status === "ok" && state.regenerating);
  if (isLoading) {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 animate-fade-in">
        <TshirtLoader size={100} />
        <p className="mt-6 text-base font-semibold tracking-tight text-foreground">
          Pensando tu outfit…
        </p>
        <p className="mt-1 text-sm text-muted-foreground text-center">
          La IA está revisando tus prendas, el clima y tu plan del día.
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    const isHardLimit =
      state.code === "daily_limit_reached" || state.code === "quota_exceeded";
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 animate-fade-in">
        <div
          className={`grid size-14 place-items-center rounded-full ${
            isHardLimit
              ? "bg-accent/15 text-accent"
              : "bg-destructive/15 text-destructive"
          }`}
        >
          <AlertIcon />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
          {state.code === "daily_limit_reached"
            ? "Ya viste tus outfits del día"
            : state.code === "quota_exceeded"
              ? "La IA descansa por hoy"
              : "No pudimos armar tu outfit"}
        </h1>
        <p className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
          {state.message}
        </p>
        <div className="mt-6 w-full max-w-xs space-y-2">
          {!isHardLimit && (
            <button
              type="button"
              onClick={() => fetchOutfit(false)}
              className="block h-12 w-full rounded-2xl bg-primary text-center text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
            >
              Reintentar
            </button>
          )}
          <Link
            href="/"
            className={`block w-full rounded-2xl text-center font-medium transition-colors ${
              isHardLimit
                ? "h-12 bg-primary text-base leading-[3rem] text-primary-foreground"
                : "h-11 bg-accent/8 text-sm leading-[2.75rem] text-foreground hover:bg-accent/15"
            }`}
          >
            Volver
          </Link>
        </div>
      </section>
    );
  }

  // Si el usuario tiene cupo ilimitado, pasamos Infinity para que el botón
  // no muestre contador ni se deshabilite nunca. El componente Actions ya
  // sabe manejar Infinity (default del prop).
  const shownLeft = unlimited
    ? Infinity
    : (callsLeft ?? state.data.callsLeft);

  // "Usar" — guarda el outfit aceptado en la tabla `outfits` y vuelve a Hoy.
  // Cuando vuelva, la sección "outfit de hoy" (a construir) lo mostrará.
  const handleUse = () => {
    if (savingUse) return;
    setSaveError(null);
    const data = state.data;
    startSaving(async () => {
      const result = await saveOutfit({
        garmentIds: data.garments.map((g) => g.id),
        occasion: data.occasion,
        weather: data.weather,
        reasoning: data.reasoning,
        source: data.source,
      });
      if ("ok" in result) {
        router.push("/");
      } else {
        setSaveError(result.error);
      }
    });
  };

  return (
    <OutfitPreview
      garments={state.data.garments}
      photoUrls={state.data.photoUrls}
      totalActive={totalActive}
      reasoning={state.data.reasoning}
      onRegenerate={() => fetchOutfit(true)}
      regenerating={state.regenerating}
      regenerationsLeft={shownLeft}
      onUse={handleUse}
      using={savingUse}
      useError={saveError}
    />
  );
}

function errorMessageFor(code: string): string {
  switch (code) {
    case "no_location":
      return "Falta configurar tu ubicación antes de pedir un outfit.";
    case "no_garments":
      return "No tenés prendas activas en el clóset.";
    case "daily_limit_reached":
      return "Ya usaste tus 4 outfits del día. Volvé mañana para más.";
    case "quota_exceeded":
      return "Se agotó la cuota de la IA por hoy. Probá de nuevo más tarde.";
    case "ai_overloaded":
      return "La IA está saturada en este momento. Probá en un par de minutos.";
    case "parse_failed":
    case "no_valid_ids":
      return "La IA respondió raro. Reintentá — suele funcionar.";
    case "no_key":
      return "Falta configurar la clave de la IA en el servidor.";
    default:
      return "Algo falló al hablar con la IA. Reintentá.";
  }
}

function AlertIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
