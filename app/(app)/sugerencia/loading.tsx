import { TshirtLoader } from "@/components/ui/tshirt-loader";

/**
 * Loader instantáneo de /sugerencia. Usa el MISMO loader de camiseta que
 * muestra OutfitView mientras la IA piensa, así la transición es continua:
 * tocar la pestaña → camiseta → respuesta, sin saltos de skeleton.
 */
export default function Loading() {
  return (
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 animate-fade-in">
      <TshirtLoader size={100} />
      <p className="mt-6 text-base font-semibold tracking-tight text-foreground">
        Pensando tu outfit…
      </p>
      <p className="mt-1 text-sm text-muted-foreground text-center">
        La IA está revisando tus prendas, el clima y tu plan del día.
      </p>
    </section>
  );
}
