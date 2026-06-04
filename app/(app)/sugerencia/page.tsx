import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/supabase/server";
import { OutfitView } from "@/components/today/outfit-view";

/**
 * Entry point de la pantalla de sugerencia.
 *
 * El server hace lo mínimo: auth + count de prendas activas. Si el clóset
 * está vacío mostramos un empty state estático (no tiene sentido pegarle a
 * la IA sin prendas). Si hay prendas, delegamos al componente client que
 * llama a `/api/suggest-outfit` y se encarga del loader/error/render.
 */
export default async function SugerenciaPage() {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { count } = await supabase
    .from("garments")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  const totalActive = count ?? 0;

  if (totalActive === 0) {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 animate-fade-in">
        <div className="grid size-16 place-items-center rounded-full bg-accent/15 text-accent">
          <ClothesIcon />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
          Tu clóset está vacío
        </h1>
        <p className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
          Para sugerirte un outfit primero necesitamos prendas. Sumá algunas
          desde tu clóset.
        </p>
        <div className="mt-6 w-full max-w-xs space-y-2">
          <Link
            href="/closet/nueva"
            className="block h-12 w-full rounded-2xl bg-primary text-center text-base font-semibold leading-[3rem] text-primary-foreground transition-transform active:scale-[0.99]"
          >
            Sumar prendas
          </Link>
          <Link
            href="/"
            className="block h-11 w-full rounded-2xl bg-accent/8 text-center text-sm font-medium leading-[2.75rem] text-foreground transition-colors hover:bg-accent/15"
          >
            Volver
          </Link>
        </div>
      </section>
    );
  }

  return <OutfitView totalActive={totalActive} />;
}

function ClothesIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2l-3 3 3 3 3-3-3-3z" />
      <path d="M9 5L3 9l3 5h12l3-5-6-4" />
      <path d="M6 14v7h12v-7" />
    </svg>
  );
}
