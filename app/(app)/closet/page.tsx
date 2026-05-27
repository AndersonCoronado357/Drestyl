import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/closet/empty-state";
import { ClosetView } from "@/components/closet/closet-view";
import { BgRemovalQueue } from "@/components/closet/bg-removal-queue";
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
      "id, user_id, name, category, photo_path, is_active, bg_cleaned, formality, climate, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  const list = (garments ?? []) as Garment[];

  if (list.length === 0) {
    return (
      <section className="flex min-h-0 flex-1 flex-col pt-8">
        <header className="mb-2">
          <p className="text-sm text-muted-foreground">Mi clóset</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Mis prendas
          </h1>
        </header>
        <EmptyState />
      </section>
    );
  }

  const photoMap = await getSignedPhotoUrls(supabase, user.id, list);

  const pendingBg = list
    .filter((g) => !g.bg_cleaned)
    .map((g) => ({
      id: g.id,
      photoUrl: photoMap.get(g.photo_path) ?? "",
    }))
    .filter((p) => p.photoUrl !== "");

  return (
    <section className="flex min-h-0 flex-1 flex-col pt-6 lg:pt-10">
      <BgRemovalQueue pending={pendingBg} />
      <ClosetView
        garments={list}
        photoUrls={Object.fromEntries(photoMap.entries())}
        addHref="/closet/nueva"
      />
    </section>
  );
}
