"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GarmentCard } from "@/components/closet/garment-card";
import { getCategoryLabel } from "@/lib/categories";
import type { Garment } from "@/lib/garments";

const SESSION_KEY = "drestyl:current-outfit:v1";

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
  /** Timestamp del swap. Expira en ~10s (ver SWAP_FLAG_TTL_MS en
   *  outfit-view.tsx). Si está vieja, OutfitView ignora el flag y
   *  llama a la IA fresca. */
  swapAt?: number;
};

type Props = {
  currentGarment: Garment;
  options: Garment[];
  photoUrls: Record<string, string>;
};

/**
 * Picker para cambiar una prenda del outfit sin llamar a la IA.
 *
 * Flujo:
 *  1. Lee el outfit actual del sessionStorage (que OutfitView dejó).
 *  2. Muestra la grilla de prendas activas de la misma categoría.
 *  3. Al tap: actualiza el outfit en memoria reemplazando la prenda,
 *     guarda con flag `pendingSwap: true` y navega a /sugerencia.
 *  4. /sugerencia lee el flag, hidrata del cache, no llama a la IA.
 *
 * Si no hay outfit en sessionStorage (deep link), avisa y manda a /sugerencia.
 */
export function SwapPieceView({ currentGarment, options, photoUrls }: Props) {
  const router = useRouter();
  const [outfit, setOutfit] = useState<SessionOutfit | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) {
        setMissing(true);
        return;
      }
      setOutfit(JSON.parse(raw) as SessionOutfit);
    } catch {
      setMissing(true);
    }
  }, []);

  function pickReplacement(newGarment: Garment) {
    if (!outfit) return;
    const newGarments = outfit.garments.map((g) =>
      g.id === currentGarment.id ? newGarment : g,
    );
    const newPhotoUrls: Record<string, string> = { ...outfit.photoUrls };
    delete newPhotoUrls[currentGarment.id];
    const newUrl = photoUrls[newGarment.id];
    if (newUrl) newPhotoUrls[newGarment.id] = newUrl;

    const updated: SessionOutfit = {
      ...outfit,
      garments: newGarments,
      photoUrls: newPhotoUrls,
      // Si era IA, ahora es edición manual del usuario.
      source: "user_edited",
      pendingSwap: true,
      swapAt: Date.now(),
    };
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    } catch {
      /* sin sessionStorage */
    }
    router.push("/sugerencia");
  }

  const categoryLabel = getCategoryLabel(currentGarment.category);

  if (missing) {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          No hay outfit activo
        </h1>
        <p className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
          Para cambiar una pieza, primero generá un outfit desde Hoy.
        </p>
        <Link
          href="/sugerencia"
          className="mt-6 h-12 w-full max-w-xs inline-flex items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
        >
          Ir a Sugerencia
        </Link>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col pt-4 lg:pt-6 animate-fade-in">
      {/* Header — fijo arriba */}
      <header className="mb-3 shrink-0 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <Link
          href="/sugerencia"
          className="h-9 inline-flex items-center rounded-full bg-accent/8 px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent/15"
        >
          Cancelar
        </Link>
        <div className="text-center min-w-0">
          <p className="text-xs text-muted-foreground">Cambiar</p>
          <h1 className="mt-0.5 truncate text-base font-semibold tracking-tight lg:text-lg">
            {categoryLabel}
          </h1>
        </div>
        <span className="h-9 w-[5rem]" aria-hidden />
      </header>

      {/* Card de la prenda actual — referencia */}
      <div className="mb-4 shrink-0 flex items-center gap-3 rounded-2xl bg-accent/8 p-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-accent/12">
          {photoUrls[currentGarment.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrls[currentGarment.id]}
              alt={currentGarment.name ?? categoryLabel}
              className="size-full object-contain"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Cambiando
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            {currentGarment.name ?? categoryLabel}
          </p>
        </div>
      </div>

      {/* Grilla de opciones — scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {options.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              No tenés otras prendas activas en esta categoría.
            </p>
            <Link
              href="/closet/nueva"
              className="mt-4 inline-flex h-10 items-center rounded-full bg-accent/15 px-4 text-sm font-medium text-accent transition-colors hover:bg-accent/25"
            >
              Sumar una
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3 lg:grid-cols-5">
            {options.map((g) => (
              <GarmentCard
                key={g.id}
                garment={g}
                photoUrl={photoUrls[g.id] ?? undefined}
                onClick={() => pickReplacement(g)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tip al pie */}
      <p className="mt-3 shrink-0 text-center text-xs text-muted-foreground">
        Tap a una prenda para reemplazar
      </p>
    </section>
  );
}
