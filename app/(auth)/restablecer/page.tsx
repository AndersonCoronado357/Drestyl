import { redirect } from "next/navigation";
import { ResetForm } from "@/components/auth/reset-form";
import { createClient } from "@/lib/supabase/server";

export default async function RestablecerPage() {
  // Solo permitir esta página si hay sesión activa (la creó /auth/callback
  // al canjear el token del correo de recuperación). Si alguien llega aquí
  // directo sin sesión, lo mandamos a /recuperar.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/recuperar");
  }

  return <ResetForm />;
}
