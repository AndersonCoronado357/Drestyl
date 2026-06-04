/**
 * Skeleton instantáneo del clóset. Refleja la vista overview: header con
 * "Agregar" y la columna de categorías (Ver todo + 5 categorías).
 */
export default function Loading() {
  return (
    <section className="flex min-h-0 flex-1 flex-col pt-6 lg:pt-10 animate-fade-in">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-accent/10" />
          <div className="h-7 w-40 animate-pulse rounded bg-accent/15 lg:h-8 lg:w-48" />
          <div className="h-3 w-16 animate-pulse rounded bg-accent/10" />
        </div>
        <div className="h-10 w-28 shrink-0 animate-pulse rounded-xl bg-accent/15" />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 pb-4 lg:auto-rows-fr lg:grid-cols-3 lg:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl bg-accent/8 p-3 lg:gap-5 lg:p-4"
          >
            <div className="aspect-square h-10 shrink-0 animate-pulse rounded-xl bg-accent/15 lg:h-[calc(100%-0.5rem)]" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 lg:gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="h-4 w-28 animate-pulse rounded bg-accent/15 lg:w-32" />
                <div className="h-5 w-8 shrink-0 animate-pulse rounded-md bg-accent/10 lg:hidden" />
              </div>
              <div className="h-3 w-40 animate-pulse rounded bg-accent/10 lg:w-48" />
              <div className="hidden h-5 w-20 animate-pulse rounded-md bg-accent/10 lg:block" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
