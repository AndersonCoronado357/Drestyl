/**
 * Skeleton instantáneo del historial. Refleja las filas compactas: texto
 * (fecha + ocasión) arriba y la tira de thumbnails abajo.
 */
export default function Loading() {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-8 animate-fade-in">
      <header className="mb-6 shrink-0 space-y-2">
        <div className="h-4 w-20 animate-pulse rounded bg-accent/10" />
        <div className="h-8 w-48 animate-pulse rounded bg-accent/15" />
        <div className="h-3 w-32 animate-pulse rounded bg-accent/10" />
      </header>

      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-2xl bg-accent/8 p-3"
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-24 animate-pulse rounded bg-accent/15" />
                <div className="h-2.5 w-36 animate-pulse rounded bg-accent/10" />
              </div>
              <div className="size-4 shrink-0 animate-pulse rounded bg-accent/10" />
            </div>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="aspect-square flex-1 animate-pulse rounded-xl bg-accent/12"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
