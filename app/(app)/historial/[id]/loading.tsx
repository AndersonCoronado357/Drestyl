import { TshirtLoader } from "@/components/ui/tshirt-loader";

/**
 * Loader instantáneo mientras el server fetch del detalle del outfit
 * corre. Next App Router lo muestra apenas el usuario navega.
 */
export default function Loading() {
  return (
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 animate-fade-in">
      <TshirtLoader size={80} />
      <p className="mt-5 text-base font-semibold tracking-tight text-foreground">
        Cargando outfit…
      </p>
    </section>
  );
}
