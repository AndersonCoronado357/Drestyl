"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import { GarmentCard } from "@/components/closet/garment-card";
import type { Garment } from "@/lib/garments";

type Props = {
  garments: Garment[];
  photoUrls: Record<string, string | null>;
  totalActive: number;
};

/**
 * Vista de sugerencia de outfit.
 *
 * Layout:
 *  - FIJO arriba: header (Volver + título) + card "Por qué este outfit".
 *  - Debajo, dos vistas separadas según viewport:
 *      • Mobile (block, lg:hidden): scroll vertical de toda la lista +
 *        los botones al fondo del scroll.
 *      • PC (hidden lg:flex): carrusel horizontal que llena el alto
 *        disponible, con los botones FIJOS abajo (no scrollan).
 *
 * Scrollbars ocultos (reset global).
 */
export function OutfitPreview({ garments, photoUrls, totalActive }: Props) {
  const router = useRouter();

  if (totalActive === 0) {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 animate-fade-in">
        <div className="grid size-16 place-items-center rounded-full bg-accent/15 text-accent">
          <ClothesIcon />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
          Tu clóset está vacío
        </h1>
        <p className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
          Para sugerirte un outfit primero necesitamos prendas. Sumá algunas
          desde tu clóset.
        </p>
        <div className="mt-6 w-full max-w-xs space-y-2">
          <Link
            href="/closet/nueva"
            className="block h-12 w-full rounded-2xl bg-primary text-center text-base font-semibold leading-[3rem] text-primary-foreground transition-transform active:scale-[0.99]"
          >
            Sumar prendas
          </Link>
          <Link
            href="/"
            className="block h-11 w-full rounded-2xl bg-accent/8 text-center text-sm font-medium leading-[2.75rem] text-foreground transition-colors hover:bg-accent/15"
          >
            Volver
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col pt-4 lg:pt-6 animate-fade-in">
      {/* FIJO: Header */}
      <header className="mb-3 shrink-0 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <Link
          href="/"
          className="h-9 inline-flex items-center rounded-full bg-accent/8 px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent/15"
        >
          Volver
        </Link>
        <div className="text-center min-w-0">
          <p className="text-xs text-muted-foreground">Tu outfit</p>
          <h1 className="mt-0.5 text-base font-semibold tracking-tight lg:text-lg">
            para hoy
          </h1>
        </div>
        <span className="h-9 w-[4.5rem]" aria-hidden />
      </header>

      {/* FIJO: Por qué este outfit — placeholder hasta Fase 4 (la IA
          generará el reasoning real al elegir). No usamos la ocasión
          del usuario aquí: la IA la consumirá directamente cuando arme
          el outfit y entregará su propio mensaje. */}
      <div className="mb-4 shrink-0 rounded-2xl bg-accent/8 px-4 py-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-foreground">
            <SparkleIcon />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            Por qué este outfit
          </p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Combinación armada con prendas activas de tu clóset. Cuando la IA
          se conecte va a explicarte aquí por qué eligió este outfit según
          tu clima y plan del día.
        </p>
      </div>

      {/* MOBILE: GarmentCards uno por fila (full width). Scroll vertical
          + botones al final del scroll. */}
      <div className="min-h-0 flex-1 overflow-y-auto lg:hidden">
        <div className="space-y-3">
          {garments.map((g) => (
            <GarmentCard
              key={g.id}
              garment={g}
              photoUrl={photoUrls[g.id] ?? undefined}
              onClick={() => router.push(`/closet/${g.id}`)}
            />
          ))}
        </div>
        <div className="mt-5 pb-2">
          <Actions onRefresh={() => router.refresh()} />
        </div>
      </div>

      {/* PC: carrusel horizontal que ocupa todo el alto, botones fijos abajo */}
      <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-4">
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1">
          {garments.map((g) => (
            <DesktopSlot
              key={g.id}
              garment={g}
              photoUrl={photoUrls[g.id]}
              onTap={() => router.push(`/closet/${g.id}`)}
            />
          ))}
        </div>
        <div className="shrink-0">
          <Actions onRefresh={() => router.refresh()} />
        </div>
      </div>
    </section>
  );
}

function Actions({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled
        title="Disponible cuando la IA esté activa"
        className="h-12 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition-colors disabled:opacity-40"
      >
        Usar
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled
          title="Disponible cuando la IA esté activa"
          className="h-10 rounded-2xl bg-accent/8 text-sm font-medium text-foreground transition-colors hover:bg-accent/15 disabled:opacity-40"
        >
          Cambiar pieza
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="h-10 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-accent/8 text-sm font-medium text-foreground transition-colors hover:bg-accent/15"
        >
          <RefreshIcon />
          Regenerar
        </button>
      </div>
    </div>
  );
}

function DesktopSlot({
  garment,
  photoUrl,
  onTap,
}: {
  garment: Garment;
  photoUrl: string | null;
  onTap: () => void;
}) {
  const categoryLabel =
    CATEGORIES.find((c) => c.slug === (garment.category as CategorySlug))
      ?.label ?? garment.category;

  return (
    <button
      type="button"
      onClick={onTap}
      className="group flex h-full w-[calc((100%-3rem)/5)] min-w-[8rem] shrink-0 flex-col gap-2 text-left"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-accent/8 transition-transform group-active:scale-[0.98]">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={garment.name ?? categoryLabel}
            className="size-full object-contain"
          />
        ) : (
          <div className="grid size-full place-items-center text-xs text-muted-foreground">
            Sin foto
          </div>
        )}
      </div>
      <div className="shrink-0">
        <p className="truncate text-xs font-medium text-foreground">
          {garment.name ?? categoryLabel}
        </p>
        <p className="truncate text-[9px] uppercase tracking-wider text-muted-foreground">
          {categoryLabel}
        </p>
      </div>
    </button>
  );
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

function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function ClothesIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2l-3 3 3 3 3-3-3-3z" />
      <path d="M9 5L3 9l3 5h12l3-5-6-4" />
      <path d="M6 14v7h12v-7" />
    </svg>
  );
}
