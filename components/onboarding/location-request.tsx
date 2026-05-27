"use client";

import { useEffect, useState, useTransition } from "react";
import { saveLocation } from "@/app/actions/location";

type GeoStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable"
  | "timeout";

/**
 * Pide la geolocalización del browser apenas se monta. Si el usuario la
 * concede, guarda lat/lng en el profile vía server action y redirige a /.
 * Si la deniega, queda bloqueado con un mensaje claro + botón reintentar.
 *
 * Usamos `useTransition` (no `useActionState`) porque el action lo dispara
 * un useEffect, no un submit. Eso evita el warning de React 19 sobre
 * "async function called outside of a transition".
 */
export function LocationRequest() {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    requestGeo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestGeo() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else if (err.code === err.TIMEOUT) setStatus("timeout");
        else setStatus("unavailable");
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }

  // Cuando ya tenemos coords, llamamos al server action dentro de una
  // transition. Sólo una vez (`submitted` lo evita).
  useEffect(() => {
    if (status !== "granted" || !coords || submitted || pending) return;
    setSubmitted(true);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("lat", String(coords.lat));
      fd.append("lng", String(coords.lng));
      const result = await saveLocation(fd);
      // `saveLocation` redirige en éxito (throw NEXT_REDIRECT). Si vuelve
      // con error, lo mostramos y permitimos reintentar.
      if (result?.error) {
        setError(result.error);
        setSubmitted(false);
      }
    });
  }, [status, coords, submitted, pending]);

  function retry() {
    setError(null);
    setSubmitted(false);
    requestGeo();
  }

  return (
    <section className="flex min-h-dvh flex-col items-center justify-center px-6 pt-safe pb-safe">
      <div className="w-full max-w-md text-center animate-fade-in">
        <div className="mb-8 flex justify-center">
          <PinIcon />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Necesitamos tu ubicación
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Para sugerirte outfits según el clima real de tu ciudad cada
          mañana. Tu ubicación queda guardada de forma privada en tu cuenta.
        </p>

        <div className="mt-8 min-h-[3rem]">
          {(status === "idle" || status === "requesting" || pending) && (
            <p className="text-sm text-muted-foreground animate-fade-in">
              {pending
                ? "Guardando tu ciudad…"
                : "Concedé el permiso de ubicación en tu navegador."}
            </p>
          )}
          {status === "denied" && !pending && (
            <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in">
              Negaste el permiso. Activalo en los ajustes del navegador y
              tocá &quot;Reintentar&quot;.
            </p>
          )}
          {status === "timeout" && !pending && (
            <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in">
              Tardó demasiado. Tocá &quot;Reintentar&quot;.
            </p>
          )}
          {status === "unavailable" && !pending && (
            <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in">
              Tu navegador no soporta geolocalización. Probá desde otro
              navegador o dispositivo.
            </p>
          )}
          {error && !pending && (
            <p className="mt-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in">
              {error}
            </p>
          )}
        </div>

        {(status === "denied" ||
          status === "timeout" ||
          status === "unavailable" ||
          error) &&
          !pending && (
            <button
              type="button"
              onClick={retry}
              className="mt-6 h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Reintentar
            </button>
          )}

        <p className="mt-10 text-xs text-muted-foreground">
          Datos meteorológicos por Open-Meteo · Ciudad por OpenStreetMap
        </p>
      </div>
    </section>
  );
}

function PinIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
