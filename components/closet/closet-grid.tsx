"use client";

import Link from "next/link";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import { GarmentCard } from "@/components/closet/garment-card";
import { CategoryIcon } from "@/components/closet/category-icon";
import type { Garment } from "@/lib/garments";

type Filter = CategorySlug | "all" | null;

const ALL_HINT = "Todas tus prendas juntas";
const ALL_LABEL = "Ver todo";

export function ClosetGrid({
  garments,
  photoUrls,
  addHref,
  filter,
  onFilterChange,
  onSelectGarment,
}: {
  garments: Garment[];
  photoUrls: Record<string, string | undefined>;
  addHref: string;
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  onSelectGarment: (id: string) => void;
}) {

  const counts: Record<string, number> = {};
  for (const g of garments) {
    counts[g.category] = (counts[g.category] ?? 0) + 1;
  }

  const isOverview = filter === null;
  const activeLabel =
    filter === "all"
      ? ALL_LABEL
      : filter
        ? CATEGORIES.find((c) => c.slug === filter)?.label
        : "";
  const activeCount =
    filter === "all" ? garments.length : filter ? (counts[filter] ?? 0) : 0;

  return (
    <>
      {/* Header — siempre tipo "Mi clóset / título / subtitle" */}
      <header className="mb-6 flex items-center justify-between gap-3 animate-fade-in">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Mi clóset</p>
          {isOverview ? (
            <>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">
                Mis prendas
              </h1>
              <p className="mt-1 text-xs text-muted-foreground lg:text-sm">
                {garments.length}{" "}
                {garments.length === 1 ? "prenda" : "prendas"}
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
                  onClick={() => onFilterChange(null)}
                  className="font-medium text-accent transition-opacity hover:opacity-70"
                >
                  Volver a categorías
                </button>
              </p>
            </>
          )}
        </div>
        <Link
          href={addHref}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95"
        >
          <span className="text-base leading-none">+</span>
          <span>Agregar</span>
        </Link>
      </header>

      {isOverview ? (
        <OverviewBody
          counts={counts}
          total={garments.length}
          onSelect={onFilterChange}
        />
      ) : (
        <DetailBody
          key={filter}
          garments={
            filter === "all"
              ? garments
              : garments.filter((g) => g.category === filter)
          }
          photoUrls={photoUrls}
          onSelectGarment={onSelectGarment}
        />
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Overview: tarjetas con icono grande izquierda + título + descripción + chip
// Mobile: filas compactas. PC: cards generosas con layout horizontal.
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
      {/* Icono SOLO — sin container. SVG grande, color lila directo. */}
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
// Detail: grid de prendas con scroll interno + transición de entrada
// ──────────────────────────────────────────────────────────────────────

function DetailBody({
  garments,
  photoUrls,
  onSelectGarment,
}: {
  garments: Garment[];
  photoUrls: Record<string, string | undefined>;
  onSelectGarment: (id: string) => void;
}) {
  return (
    <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2 animate-fade-in">
      <div className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {garments.map((g) => (
          <GarmentCard
            key={g.id}
            garment={g}
            photoUrl={photoUrls[g.photo_path]}
            onClick={() => onSelectGarment(g.id)}
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
