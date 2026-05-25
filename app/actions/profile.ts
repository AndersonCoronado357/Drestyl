"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidGender } from "@/lib/gender";

export type ProfileUpdateState =
  | { error?: string; info?: string }
  | undefined;

export async function updateGender(
  _prev: ProfileUpdateState,
  formData: FormData,
): Promise<ProfileUpdateState> {
  const gender = String(formData.get("gender") ?? "").trim();

  if (!isValidGender(gender)) {
    return { error: "Selecciona una opción válida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ gender })
    .eq("id", user.id);

  if (error) {
    // Mostramos el mensaje real para diagnosticar. La causa típica:
    // la migration 003 no se corrió y la columna `gender` no existe todavía.
    return { error: `No pudimos guardar: ${error.message}` };
  }

  revalidatePath("/ajustes");
  return { info: "Guardado." };
}
