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

/**
 * Actualiza el texto libre de preferencias de estilo. Va al prompt de
 * Gemini cuando arma outfits. Cap 500 chars (constraint en DB también).
 */
export async function updateStylePreferences(
  text: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = (text ?? "").trim().slice(0, 500);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu sesión expiró." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ style_preferences: trimmed || null })
    .eq("id", user.id);
  if (error) {
    return { error: "No pudimos guardar tus preferencias." };
  }

  revalidatePath("/ajustes");
  return { ok: true };
}

/**
 * Actualiza la ventana de "no repetir prendas" del usuario (1-30 días).
 * La IA usa este valor al armar outfits para evitar prendas usadas
 * recientemente. La columna ya tiene check constraint en DB (1-60).
 */
export async function updateRepeatWindow(
  days: number,
): Promise<{ ok: true } | { error: string }> {
  const value = Math.round(Number(days));
  if (!Number.isFinite(value) || value < 1 || value > 30) {
    return { error: "El valor debe estar entre 1 y 30." };
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
    .update({ repeat_window_days: value })
    .eq("id", user.id);

  if (error) {
    return { error: "No pudimos guardar la ventana." };
  }

  revalidatePath("/ajustes");
  return { ok: true };
}
