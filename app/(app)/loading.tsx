/**
 * Skeleton instantáneo de la pantalla Hoy. Next App Router lo muestra apenas
 * el usuario toca la pestaña, mientras corre el server fetch (perfil + conteo
 * de prendas). Refleja el layout real: clima, card del clóset, ocasión y CTA.
 */
export default function Loading() {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-6 lg:pt-10 animate-fade-in">
      <header className="mb-5 shrink-0">
        <div className="h-4 w-40 animate-pulse rounded bg-accent/10" />
        <div className="mt-2 h-8 w-60 animate-pulse rounded bg-accent/15 lg:h-10 lg:w-72" />
      </header>

      {/* Clima */}
      <div className="mb-4 shrink-0 rounded-2xl bg-accent/8 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-10 animate-pulse rounded bg-accent/15" />
            <div className="h-9 w-24 animate-pulse rounded bg-accent/15" />
            <div className="h-3 w-32 animate-pulse rounded bg-accent/10" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-accent/10" />
          </div>
          <div className="size-12 animate-pulse rounded-full bg-accent/15" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-accent/15 pt-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2 w-10 animate-pulse rounded bg-accent/10" />
              <div className="h-3 w-10 animate-pulse rounded bg-accent/15" />
            </div>
          ))}
        </div>
      </div>

      {/* Card del clóset */}
      <div className="mb-4 shrink-0 flex items-center gap-3 rounded-2xl bg-accent/8 px-4 py-3">
        <div className="size-9 shrink-0 animate-pulse rounded-full bg-accent/15" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-20 animate-pulse rounded bg-accent/15" />
          <div className="h-2.5 w-28 animate-pulse rounded bg-accent/10" />
        </div>
      </div>

      {/* Ocasión — compacta en mobile, expandida en PC (como la real) */}
      <div className="mb-4 shrink-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div className="mb-2 h-4 w-40 shrink-0 animate-pulse rounded bg-accent/15" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-accent/8 lg:min-h-0 lg:flex-1" />
      </div>

      {/* CTA */}
      <div className="h-14 w-full shrink-0 animate-pulse rounded-2xl bg-accent/15" />
    </section>
  );
}
