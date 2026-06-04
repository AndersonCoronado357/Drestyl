import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { AddGarmentFlow } from "@/components/closet/add-garment-flow";

export default async function NuevaPrendaPage() {
  // El proxy ya redirige sin sesión; acá solo confirmamos que hay user
  // (vía cookie, sin round-trip) para el render. El server action de
  // subida valida con getUser() real, ahí sí importa.
  const { user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return <AddGarmentFlow />;
}
