import { TshirtLoader } from "@/components/ui/tshirt-loader";

/**
 * Loader instantáneo mientras el server fetch del picker corre.
 * Next App Router muestra esto apenas el usuario navega (antes incluso
 * que llegue el server component) — no se ve la pantalla anterior
 * quedando "pegada" por segundos.
 */
export default function Loading() {
  return (
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 animate-fade-in">
      <TshirtLoader size={80} />
      <p className="mt-5 text-base font-semibold tracking-tight text-foreground">
        Cargando opciones…
      </p>
    </section>
  );
}
