"use client";

import { useState } from "react";
import { ClosetGrid } from "./closet-grid";
import { GarmentDetail } from "./garment-detail";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import type { Garment } from "@/lib/garments";

// "all" = filtro "Ver todo". null = vista overview de categorías.
export type Filter = CategorySlug | "all" | null;

/**
 * Shell del closet — gestiona dos modos SIN tocar URL:
 *   - grid: categorías overview o prendas filtradas
 *   - detail: una prenda con prev/next que RESPETA la categoría actual
 *
 * El filter se mantiene cuando navegás detail → volver, así al cerrar
 * el detail estás en la misma categoría.
 */
export function ClosetView({
  garments,
  photoUrls,
  addHref,
}: {
  garments: Garment[];
  photoUrls: Record<string, string | undefined>;
  addHref: string;
}) {
  const [filter, setFilter] = useState<Filter>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Lista filtrada según la categoría actual. Si no hay filter activo,
  // usamos todas (caso edge: deep link a un detail sin haber filtrado).
  const filteredGarments =
    filter === null || filter === "all"
      ? garments
      : garments.filter((g) => g.category === filter);

  // Navigation context: si hay filtro activo, prev/next solo recorre las
  // prendas filtradas. Si no, recorre todas.
  const navList = filter && filter !== "all" ? filteredGarments : garments;

  if (selectedId) {
    const urlsByGarmentId: Record<string, string | null> = {};
    for (const g of navList) {
      urlsByGarmentId[g.id] = photoUrls[g.photo_path] ?? null;
    }

    return (
      <GarmentDetail
        garments={navList}
        photoUrls={urlsByGarmentId}
        initialId={selectedId}
        onBack={() => setSelectedId(null)}
        contextLabel={
          filter && filter !== "all"
            ? CATEGORIES.find((c) => c.slug === filter)?.label
            : undefined
        }
      />
    );
  }

  return (
    <ClosetGrid
      garments={garments}
      photoUrls={photoUrls}
      addHref={addHref}
      filter={filter}
      onFilterChange={setFilter}
      onSelectGarment={setSelectedId}
    />
  );
}
