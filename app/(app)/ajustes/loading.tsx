/**
 * Skeleton instantáneo de Ajustes. Refleja el header con avatar y las
 * secciones de tarjetas (preferencias, perfil, acceso, cuenta).
 */
export default function Loading() {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-8 animate-fade-in">
      <header className="mb-8 shrink-0 flex items-center gap-4">
        <div className="size-16 shrink-0 animate-pulse rounded-full bg-accent/15" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-16 animate-pulse rounded bg-accent/10" />
          <div className="h-6 w-40 animate-pulse rounded bg-accent/15" />
          <div className="h-3 w-48 animate-pulse rounded bg-accent/10" />
        </div>
      </header>

      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mb-8 last:mb-0">
          <div className="mb-3 h-2.5 w-24 animate-pulse rounded bg-accent/10" />
          <div className="h-20 w-full animate-pulse rounded-xl bg-accent/8" />
        </div>
      ))}
    </section>
  );
}
