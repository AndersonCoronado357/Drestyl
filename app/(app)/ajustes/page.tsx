export default function AjustesPage() {
  return (
    <section className="pt-8">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">Ajustes</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Configuración
        </h1>
      </header>

      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-muted-foreground">
            Tu perfil, ubicación por defecto y opciones se verán aquí.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Datos meteorológicos por Open-Meteo.
        </p>
      </div>
    </section>
  );
}
