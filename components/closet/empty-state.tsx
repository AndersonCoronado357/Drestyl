import Link from "next/link";

export function EmptyState() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center pt-12 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-accent/10">
        <svg
          viewBox="0 0 24 24"
          width="40"
          height="40"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-accent"
          aria-hidden="true"
        >
          <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23Z" />
        </svg>
      </div>

      <h2 className="text-xl font-semibold tracking-tight">
        Tu clóset está vacío
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Sube tu primera prenda para que Drestyl pueda empezar a armarte
        outfits.
      </p>

      <Link
        href="/closet/nueva"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground active:scale-[0.99]"
      >
        Agregar primera prenda
      </Link>
    </div>
  );
}
