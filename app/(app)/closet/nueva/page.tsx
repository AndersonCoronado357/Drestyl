import Link from "next/link";

export default function NuevaPrendaPage() {
  return (
    <section className="pt-8">
      <header className="mb-6">
        <Link
          href="/closet"
          className="text-sm font-medium text-accent"
        >
          ← Mi clóset
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Agregar prenda
        </h1>
      </header>

      <div className="rounded-xl border border-border bg-background p-8 text-center">
        <p className="text-base text-muted-foreground">
          El flujo para agregar prendas (foto, procesamiento, categoría) llega
          en el siguiente paso.
        </p>
      </div>
    </section>
  );
}
