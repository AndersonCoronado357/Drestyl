import { redirect } from "next/navigation";
import { ResetForm } from "@/components/auth/reset-form";

/**
 * Página para crear una nueva contraseña desde el enlace del correo. El token
 * llega por la URL (?token=...). Si no hay token, mandamos a /recuperar.
 */
export default async function RestablecerPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    redirect("/recuperar");
  }
  return <ResetForm token={token} />;
}
