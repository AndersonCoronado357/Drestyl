"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GarmentCard } from "@/components/closet/garment-card";
import { CategoryIcon } from "@/components/closet/category-icon";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";
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
  swapAt?: number;
};

type Filter = CategorySlug | "all" | null;

const ALL_LABEL = "Ver todo";
const ALL_HINT = "Todas tus prendas disponibles";

type Props = {
  garments: Garment[];
  photoUrls: Record<string, string>;
};

/**
 * Picker para SUMAR una prenda al outfit actual.
 *
 * Layout idéntico al closet:
 *  - Overview: cards de categorías (icono + nombre + count de disponibles).
 *    Solo aparecen las categorías que tienen al menos 1 prenda disponible.
 *  - Detail: tap en una categoría → grid de prendas de esa categoría.
 *    Tap en una prenda → la suma al outfit y vuelve a /sugerencia.
 *
 * Filtra las prendas que ya están en el outfit para no permitir duplicados.
 */
export function AddPieceView({ garments, photoUrls }: Props) {
  const router = useRouter();
  const [outfit, setOutfit] = useState<SessionOutfit | null>(null);
  const [missing, setMissing] = useState(false);
  const [filter, setFilter] = useState<Filter>(null);

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

  // Prendas disponibles para sumar (todas las activas MENOS las que ya
  // están en el outfit).
  const available = useMemo(() => {
    const inOutfit = new Set(outfit?.garments.map((g) => g.id) ?? []);
    return garments.filter((g) => !inOutfit.has(g.id));
  }, [garments, outfit]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const g of available) {
      c[g.category] = (c[g.category] ?? 0) + 1;
    }
    return c;
  }, [available]);

  function addToOutfit(newGarment: Garment) {
    if (!outfit) return;
    const newGarments = [...outfit.garments, newGarment];
    const newPhotoUrls: Record<string, string> = { ...outfit.photoUrls };
    const newUrl = photoUrls[newGarment.id];
    if (newUrl) newPhotoUrls[newGarment.id] = newUrl;

    const updated: SessionOutfit = {
      ...outfit,
      garments: newGarments,
      photoUrls: newPhotoUrls,
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

  if (missing) {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          No hay outfit activo
        </h1>
        <p className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
          Para sumar una pieza, primero generá un outfit desde Hoy.
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

  const isOverview = filter === null;
  const activeLabel =
    filter === "all"
      ? ALL_LABEL
      : filter
        ? CATEGORIES.find((c) => c.slug === filter)?.label
        : "";
  const activeCount =
    filter === "all" ? available.length : filter ? (counts[filter] ?? 0) : 0;
  const detailGarments =
    filter === "all"
      ? available
      : filter
        ? available.filter((g) => g.category === filter)
        : [];

  return (
    <section className="flex min-h-0 flex-1 flex-col pt-4 lg:pt-6 animate-fade-in">
      {/* Header — cambia según overview / detail */}
      <header className="mb-5 shrink-0 flex items-center justify-between gap-3 animate-fade-in">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Sumar al outfit</p>
          {isOverview ? (
            <>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">
                Tu clóset
              </h1>
              <p className="mt-1 text-xs text-muted-foreground lg:text-sm">
                {available.length}{" "}
                {available.length === 1
                  ? "prenda disponible"
                  : "prendas disponibles"}
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">
                {activeLabel}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground lg:text-sm">
                {activeCount} {activeCount === 1 ? "prenda" : "prendas"} ·{" "}
                <button
                  type="button"
                  onClick={() => setFilter(null)}
                  className="font-medium text-accent transition-opacity hover:opacity-70"
                >
                  Volver a categorías
                </button>
              </p>
            </>
          )}
        </div>
        <Link
          href="/sugerencia"
          className="h-10 inline-flex shrink-0 items-center rounded-full bg-accent/8 px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent/15"
        >
          Cancelar
        </Link>
      </header>

      {isOverview ? (
        <OverviewBody
          counts={counts}
          total={available.length}
          onSelect={setFilter}
        />
      ) : (
        <DetailBody
          key={filter ?? "all"}
          garments={detailGarments}
          photoUrls={photoUrls}
          onSelectGarment={addToOutfit}
        />
      )}
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Overview: categorías con icono + count
// ──────────────────────────────────────────────────────────────────────

function OverviewBody({
  counts,
  total,
  onSelect,
}: {
  counts: Record<string, number>;
  total: number;
  onSelect: (f: Filter) => void;
}) {
  if (total === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center pt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Todas tus prendas activas ya están en el outfit.
        </p>
      </div>
    );
  }
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 animate-fade-in lg:auto-rows-fr lg:grid-cols-3 lg:gap-4">
      <CategoryButton
        label={ALL_LABEL}
        hint={ALL_HINT}
        count={total}
        active
        onClick={() => onSelect("all")}
      >
        <AllIcon />
      </CategoryButton>
      {CATEGORIES.map((c) => {
        const count = counts[c.slug] ?? 0;
        return (
          <CategoryButton
            key={c.slug}
            label={c.label}
            hint={c.hint}
            count={count}
            active={count > 0}
            onClick={() => count > 0 && onSelect(c.slug)}
          >
            <CategoryIcon slug={c.slug} size={28} />
          </CategoryButton>
        );
      })}
    </div>
  );
}

function CategoryButton({
  children,
  label,
  hint,
  count,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  hint: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!active}
      className="group flex items-center gap-3 rounded-2xl bg-accent/8 p-3 text-left transition-colors duration-300 hover:bg-accent/12 disabled:cursor-not-allowed disabled:bg-muted/30 disabled:hover:bg-muted/30 lg:gap-5 lg:p-4"
    >
      <span className="flex aspect-square h-10 shrink-0 items-center justify-center text-accent transition-colors group-disabled:text-muted-foreground lg:h-[calc(100%-0.5rem)]">
        <span className="lg:scale-[4]">{children}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 lg:gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground group-disabled:text-muted-foreground">
            {label}
          </span>
          <span
            className={`tabular-nums shrink-0 rounded-md px-2 py-0.5 text-xs font-medium lg:hidden ${
              active
                ? "bg-accent/15 text-accent"
                : "bg-transparent text-muted-foreground"
            }`}
          >
            {count}
          </span>
        </div>
        <p className="hidden truncate text-xs text-muted-foreground group-disabled:text-muted-foreground/70 lg:block">
          {hint}
        </p>
        <span
          className={`hidden w-fit tabular-nums rounded-md px-2 py-0.5 text-xs font-medium lg:inline-flex ${
            active
              ? "bg-accent/15 text-accent"
              : "bg-transparent text-muted-foreground"
          }`}
        >
          {count} {count === 1 ? "prenda" : "prendas"}
        </span>
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Detail: grid de prendas. Tap = agregar al outfit.
// ──────────────────────────────────────────────────────────────────────

function DetailBody({
  garments,
  photoUrls,
  onSelectGarment,
}: {
  garments: Garment[];
  photoUrls: Record<string, string>;
  onSelectGarment: (g: Garment) => void;
}) {
  if (garments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center pt-8 text-center">
        <p className="text-sm text-muted-foreground">
          No hay más prendas disponibles en esta categoría.
        </p>
      </div>
    );
  }
  return (
    <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2 animate-fade-in">
      <div className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {garments.map((g) => (
          <GarmentCard
            key={g.id}
            garment={g}
            photoUrl={photoUrls[g.id] ?? undefined}
            onClick={() => onSelectGarment(g)}
          />
        ))}
      </div>
    </div>
  );
}

function AllIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
