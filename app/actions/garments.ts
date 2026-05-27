"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidCategory } from "@/lib/categories";

export type CreateGarmentState = { error?: string } | undefined;
export type GarmentMutationState = { error?: string; ok?: boolean } | undefined;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Crea una prenda: sube la foto al bucket `garments` y crea la fila en la
 * tabla. RLS y storage policies garantizan que el usuario solo escribe en
 * SU propio path. El `user_id` sale de la sesión del server client, nunca
 * del cliente, así no se puede forjar.
 */
export async function createGarment(
  formData: FormData,
): Promise<CreateGarmentState> {
  const file = formData.get("photo");
  const category = String(formData.get("category") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Falta la foto." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "El archivo debe ser una imagen." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "La foto es muy pesada (máx 10MB)." };
  }
  if (!isValidCategory(category)) {
    return { error: "Selecciona una categoría." };
  }
  if (name.length > 80) {
    return { error: "El nombre es muy largo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const garmentId = crypto.randomUUID();
  const ext = MIME_TO_EXT[file.type.toLowerCase()] ?? "jpg";
  // Bucket personal por usuario: user-{user_id}. Path interno solo lleva
  // {garment_id}/photo.{ext} porque el user_id ya está implícito en el bucket.
  const bucket = `user-${user.id}`;
  const path = `${garmentId}/photo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[createGarment] storage upload failed:", uploadError);
    return { error: `Subida falló: ${uploadError.message}` };
  }

  const { error: insertError } = await supabase.from("garments").insert({
    id: garmentId,
    user_id: user.id,
    name: name || null,
    category,
    photo_path: path,
    is_active: isActive,
  });

  if (insertError) {
    // Si el insert falla, dejamos un huérfano en storage. No es crítico —
    // el bucket es de bajo costo y podemos limpiar después. Mejor que dejar
    // una fila sin foto.
    console.error("[createGarment] db insert failed:", insertError);
    return { error: `Guardado falló: ${insertError.message}` };
  }

  revalidatePath("/closet");
  redirect("/closet");
}

/**
 * Actualiza nombre, categoría y estado activo de una prenda. RLS asegura
 * que solo el dueño pueda actualizar.
 */
export async function updateGarment(
  id: string,
  _prev: GarmentMutationState,
  formData: FormData,
): Promise<GarmentMutationState> {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const isActive = formData.get("is_active") === "on";

  const FORMALITIES = ["formal", "elegante", "casual", "deportivo"];
  const CLIMATES = ["frio", "templado", "calor", "mixto"];
  const formalityRaw = String(formData.get("formality") ?? "");
  const climateRaw = String(formData.get("climate") ?? "");
  const formality = FORMALITIES.includes(formalityRaw) ? formalityRaw : null;
  const climate = CLIMATES.includes(climateRaw) ? climateRaw : null;

  if (!isValidCategory(category)) {
    return { error: "Selecciona una categoría válida." };
  }
  if (name.length > 80) {
    return { error: "El nombre es muy largo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu sesión expiró." };
  }

  const { error } = await supabase
    .from("garments")
    .update({
      name: name || null,
      category,
      is_active: isActive,
      formality,
      climate,
    })
    .eq("id", id);

  if (error) {
    return { error: "No pudimos guardar los cambios." };
  }

  revalidatePath("/closet");
  revalidatePath(`/closet/${id}`);
  return { ok: true };
}

/**
 * Elimina una prenda: borra la fila Y el archivo del storage. RLS y storage
 * policies aseguran que solo el dueño pueda hacerlo.
 */
/**
 * Crea VARIAS prendas en una sola llamada. Para cada item recibe foto +
 * categoría + nombre. Sube todas a storage, inserta todas en DB. Si una
 * falla, las demás se mantienen — devolvemos qué falló.
 *
 * El FormData debe traer:
 *   - `count` (string del número de items)
 *   - `photo_0`, `photo_1`, ... (los archivos)
 *   - `category_0`, `category_1`, ... (los slugs)
 *   - `name_0`, `name_1`, ... (los nombres, pueden ir vacíos)
 *   - `bg_cleaned_0`, `bg_cleaned_1`, ... ("true" si ya viene limpia desde el cliente)
 */
export async function createGarmentsBatch(
  formData: FormData,
): Promise<{ created: number; failed: number; errors: string[] }> {
  const count = parseInt(String(formData.get("count") ?? "0"), 10);
  if (!count || count > 30) {
    return { created: 0, failed: 0, errors: ["count inválido"] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { created: 0, failed: count, errors: ["Sin sesión"] };
  }

  const bucket = `user-${user.id}`;
  let created = 0;
  let failed = 0;
  const errors: string[] = [];

  const FORMALITIES = ["formal", "elegante", "casual", "deportivo"];
  const CLIMATES = ["frio", "templado", "calor", "mixto"];

  for (let i = 0; i < count; i++) {
    const file = formData.get(`photo_${i}`);
    const category = String(formData.get(`category_${i}`) ?? "");
    const name = String(formData.get(`name_${i}`) ?? "").trim();
    const bgCleaned = formData.get(`bg_cleaned_${i}`) === "true";
    const formalityRaw = String(formData.get(`formality_${i}`) ?? "");
    const climateRaw = String(formData.get(`climate_${i}`) ?? "");
    const formality = FORMALITIES.includes(formalityRaw) ? formalityRaw : null;
    const climate = CLIMATES.includes(climateRaw) ? climateRaw : null;

    if (!(file instanceof File) || file.size === 0) {
      failed++;
      errors.push(`Item ${i}: falta foto`);
      continue;
    }
    if (!isValidCategory(category)) {
      failed++;
      errors.push(`Item ${i}: categoría inválida`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      failed++;
      errors.push(`Item ${i}: foto muy pesada`);
      continue;
    }

    const garmentId = crypto.randomUUID();
    const ext = MIME_TO_EXT[file.type.toLowerCase()] ?? "jpg";
    const path = `${garmentId}/photo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      failed++;
      errors.push(`Item ${i}: upload — ${uploadError.message}`);
      continue;
    }

    const { error: insertError } = await supabase.from("garments").insert({
      id: garmentId,
      user_id: user.id,
      name: name || null,
      category,
      photo_path: path,
      is_active: true,
      bg_cleaned: bgCleaned,
      formality,
      climate,
    });
    if (insertError) {
      failed++;
      errors.push(`Item ${i}: db — ${insertError.message}`);
      continue;
    }
    created++;
  }

  revalidatePath("/closet");
  return { created, failed, errors };
}

/**
 * Reemplaza la foto de una prenda con su versión limpia (bg removed) y
 * marca bg_cleaned=true. Lo llama el BgRemovalQueue del cliente después
 * de procesar el bg removal en background. RLS asegura que solo el dueño
 * pueda hacerlo.
 */
export async function replaceCleanedPhoto(
  garmentId: string,
  cleanedFile: File,
): Promise<{ ok: true } | { error: string }> {
  if (!(cleanedFile instanceof File) || cleanedFile.size === 0) {
    return { error: "Archivo inválido." };
  }
  if (cleanedFile.size > 5 * 1024 * 1024) {
    return { error: "Archivo demasiado pesado." };
  }
  if (!cleanedFile.type.startsWith("image/")) {
    return { error: "Debe ser imagen." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sin sesión." };
  }

  // Verifica que la prenda exista, sea del usuario, y aún esté sin limpiar.
  const { data: garment } = await supabase
    .from("garments")
    .select("photo_path, bg_cleaned")
    .eq("id", garmentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!garment) return { error: "Prenda no existe." };
  if (garment.bg_cleaned) return { ok: true }; // ya estaba lista, no hacemos nada

  // Reemplaza el archivo en storage (mismo path, upsert).
  const bucket = `user-${user.id}`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(garment.photo_path, cleanedFile, {
      contentType: cleanedFile.type,
      upsert: true,
    });
  if (uploadError) {
    console.error("[replaceCleanedPhoto] storage:", uploadError);
    return { error: uploadError.message };
  }

  const { error: updateError } = await supabase
    .from("garments")
    .update({ bg_cleaned: true })
    .eq("id", garmentId);
  if (updateError) {
    console.error("[replaceCleanedPhoto] db:", updateError);
    return { error: updateError.message };
  }

  revalidatePath("/closet");
  return { ok: true };
}

export async function deleteGarment(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Obtener el photo_path antes de borrar la fila, para limpiar storage.
  const { data: garment } = await supabase
    .from("garments")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();

  if (garment?.photo_path) {
    const bucket = `user-${user.id}`;
    await supabase.storage.from(bucket).remove([garment.photo_path]);
  }

  await supabase.from("garments").delete().eq("id", id);

  revalidatePath("/closet");
  redirect("/closet");
}
