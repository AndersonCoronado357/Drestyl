import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/closet/empty-state";
import { GarmentCard } from "@/components/closet/garment-card";
import { getSignedPhotoUrls, type Garment } from "@/lib/garments";

export default async function ClosetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: garments } = await supabase
    .from("garments")
    .select(
      "id, user_id, name, category, photo_path, is_active, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  const list = (garments ?? []) as Garment[];

  if (list.length === 0) {
    return (
      <section className="pt-8">
        <header className="mb-2">
          <p className="text-sm text-muted-foreground">Mi clóset</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Tus prendas
          </h1>
        </header>
        <EmptyState />
      </section>
    );
  }

  // Generar URLs firmadas para todas las fotos en una sola llamada.
  const photoMap = await getSignedPhotoUrls(
    supabase,
    list.map((g) => g.photo_path),
  );

  return (
    <section className="pt-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Mi clóset</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Tus prendas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.length} {list.length === 1 ? "prenda" : "prendas"}
          </p>
        </div>
        <Link
          href="/closet/nueva"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground active:scale-[0.99]"
        >
          + Agregar
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((garment) => (
          <GarmentCard
            key={garment.id}
            garment={garment}
            photoUrl={photoMap.get(garment.photo_path)}
          />
        ))}
      </div>
    </section>
  );
}
