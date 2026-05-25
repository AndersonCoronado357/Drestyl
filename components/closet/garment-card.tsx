import Link from "next/link";
import type { Garment } from "@/lib/garments";
import { getCategoryLabel } from "@/lib/categories";

type Props = {
  garment: Garment;
  photoUrl: string | undefined;
};

export function GarmentCard({ garment, photoUrl }: Props) {
  const label = garment.name?.trim() || getCategoryLabel(garment.category);

  return (
    <Link
      href={`/closet/${garment.id}`}
      className="group block overflow-hidden rounded-xl border border-border bg-background"
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
    </Link>
  );
}
