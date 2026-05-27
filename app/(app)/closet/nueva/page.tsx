import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddGarmentFlow } from "@/components/closet/add-garment-flow";

export default async function NuevaPrendaPage() {
  // Defensa en profundidad: el proxy ya redirige sin sesión, pero validamos
  // también aquí porque el server action necesita un user real.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return <AddGarmentFlow />;
}
