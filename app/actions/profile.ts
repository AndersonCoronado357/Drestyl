"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { isValidGender } from "@/lib/gender";
import { storePhoto, avatarKey } from "@/lib/server/photos";

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

/**
 * Actualiza el nombre visible del usuario (profiles.display_name). Es el que
 * aparece en el saludo del inicio y en Ajustes. Cap 60 chars.
 */
export async function updateDisplayName(
  _prev: ProfileUpdateState,
  formData: FormData,
): Promise<ProfileUpdateState> {
  const name = String(formData.get("display_name") ?? "").trim().slice(0, 60);
  if (!name) {
    return { error: "Escribe un nombre." };
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
    .update({ display_name: name })
    .eq("id", user.id);
  if (error) {
    return { error: `No pudimos guardar el nombre: ${error.message}` };
  }

  revalidatePath("/ajustes");
  revalidatePath("/");
  return { info: "Guardado." };
}

/**
 * Sube la foto de perfil. Reusa la tabla garment_photos con clave fija
 * (avatar/photo); la imagen se recorta a 256x256 webp para que pese poco.
 */
export async function uploadAvatar(
  _prev: ProfileUpdateState,
  formData: FormData,
): Promise<ProfileUpdateState> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elige una foto." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "Debe ser una imagen." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { error: "Imagen muy pesada (máx 8MB)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu sesión expiró." };
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const out = await sharp(buf)
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
    await storePhoto(avatarKey(user.id), user.id, out, "image/webp");
  } catch {
    return { error: "No pudimos procesar la imagen." };
  }

  revalidatePath("/ajustes");
  revalidatePath("/");
  return { info: "Foto actualizada." };
}
