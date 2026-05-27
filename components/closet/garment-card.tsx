"use client";

import type { Garment } from "@/lib/garments";
import { getCategoryLabel } from "@/lib/categories";
import { CategoryIcon } from "@/components/closet/category-icon";

type Props = {
  garment: Garment;
  photoUrl: string | undefined;
  onClick: () => void;
};

export function GarmentCard({ garment, photoUrl, onClick }: Props) {
  const label = garment.name?.trim() || getCategoryLabel(garment.category);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-full overflow-hidden rounded-xl bg-accent/5 text-left transition-all hover:bg-accent/10 hover:-translate-y-0.5"
    >
      <div className="relative aspect-square bg-accent/5">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={label}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid size-full place-items-center text-xs text-muted-foreground">
            Sin foto
          </div>
        )}

        <span className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-background/85 text-accent backdrop-blur-sm">
          <CategoryIcon slug={garment.category} size={16} />
        </span>

        {!garment.bg_cleaned && (
          <span
            className="absolute bottom-2 right-2 size-2 rounded-full bg-accent/70"
            aria-label="Procesando fondo"
            title="Limpiando fondo en background"
          />
        )}

        {!garment.is_active && (
          <span className="absolute right-2 top-2 rounded-md bg-foreground/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-background">
            Inactiva
          </span>
        )}
      </div>

      <div className="px-3 py-2.5">
        <p className="truncate text-sm font-medium text-foreground">
          {label}
        </p>
        <p className="text-xs text-muted-foreground">
          {getCategoryLabel(garment.category)}
        </p>
      </div>
    </button>
  );
}
