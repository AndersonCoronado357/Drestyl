export default function HoyPage() {
  return (
    <section className="pt-8">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">Hoy</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Buenos días
        </h1>
      </header>

      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-muted-foreground">
          Esta pantalla mostrará el clima de tu ubicación y tu outfit del día.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Por ahora es solo un placeholder de la Fase 0.
        </p>
      </div>
    </section>
  );
}
