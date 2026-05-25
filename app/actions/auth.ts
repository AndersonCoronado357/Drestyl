"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidGender, type GenderSlug } from "@/lib/gender";

export type AuthState =
  | { error?: string; info?: string }
  | undefined;

/**
 * Verifica si un correo ya está registrado en auth.users.
 * Usa admin client (service_role) para saltarse RLS. Si falla, devuelve null
 * para que el caller decida un mensaje genérico.
 *
 * NOTA: esto revela si un correo está o no registrado — útil para la UX
 * que pidió el usuario, pero rompe la práctica de "no enumerar usuarios"
 * que Supabase respeta por defecto. Aceptable para un grupo cerrado de
 * 10-15 personas; en una app pública convendría volver al mensaje genérico.
 */
async function emailExists(email: string): Promise<boolean | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) return null;
    const target = email.toLowerCase();
    return data.users.some((u) => u.email?.toLowerCase() === target);
  } catch {
    return null;
  }
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y tu contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();

    if (msg.includes("email not confirmed")) {
      return {
        error: "Confirma tu correo antes de entrar. Revisa tu bandeja.",
      };
    }

    // Para "Invalid login credentials", distinguir si el correo existe.
    const exists = await emailExists(email);
    if (exists === true) {
      return { error: "Contraseña incorrecta." };
    }
    if (exists === false) {
      return { error: "Este correo no está registrado." };
    }
    // Si no pudimos verificar (admin client falló), mensaje neutro.
    return { error: "Correo o contraseña incorrectos." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const rawGender = String(formData.get("gender") ?? "").trim();
  const gender: GenderSlug = isValidGender(rawGender) ? rawGender : "mixto";

  if (!email || !password) {
    return { error: "Ingresa tu correo y una contraseña." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  // Antes de intentar, ver si el correo ya está registrado para dar mejor mensaje.
  const exists = await emailExists(email);
  if (exists === true) {
    return { error: "Este correo ya tiene una cuenta. Inicia sesión." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName || null,
        gender,
      },
    },
  });

  if (error) {
    return { error: "No pudimos crear la cuenta. Intenta de nuevo." };
  }

  // Si Supabase tiene "Confirm email" activado (default), el usuario debe
  // confirmar antes de poder entrar. Si está desactivado, la sesión queda
  // creada y signInWithPassword no es necesario.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      info: "Te enviamos un correo para confirmar tu cuenta. Ábrelo y vuelve.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Pide a Supabase enviar un correo con el enlace para recuperar la contraseña.
 * El correo lleva al usuario a /auth/callback?next=/restablecer, que crea una
 * sesión temporal y lo manda a /restablecer para poner la nueva contraseña.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { error: "Ingresa tu correo." };
  }

  const supabase = await createClient();
  const headerStore = await headers();
  const origin =
    headerStore.get("origin") ||
    `https://${headerStore.get("host")}` ||
    "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/restablecer`,
  });

  if (error) {
    return { error: "No pudimos enviar el correo. Intenta de nuevo." };
  }

  // Mensaje genérico — no confirmamos si el correo existe o no para no
  // permitir enumeración de usuarios desde el formulario de recuperación.
  return {
    info: "Si el correo está registrado, te enviamos un enlace para recuperar tu cuenta. Revisa tu bandeja.",
  };
}

/**
 * Cambia la contraseña del usuario actualmente logueado. Solo se debe llamar
 * desde /restablecer (tras llegar del correo con sesión recovery).
 */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirm) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "El enlace expiró. Vuelve a /recuperar para pedir otro correo.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "No pudimos actualizar la contraseña. Intenta de nuevo." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * Inicia el flow OAuth con Google.
 *
 * Pasos:
 * 1. Supabase genera una URL especial de Google con el client_id.
 * 2. Redirigimos al usuario a esa URL.
 * 3. Google le pide login y consentimiento.
 * 4. Google redirige a la callback URL de Supabase con un `code`.
 * 5. Supabase redirige a NUESTRA callback (`/auth/callback?code=...&next=/`).
 * 6. El route handler intercambia el code por sesión y redirige a `next`.
 */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const headerStore = await headers();
  const origin =
    headerStore.get("origin") ||
    `https://${headerStore.get("host")}` ||
    "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=/`,
    },
  });

  if (error) {
    // Si Google OAuth no está configurado en Supabase, mandamos al login con
    // un parámetro para mostrar un mensaje.
    redirect("/login?oauth=error");
  }

  if (data.url) {
    redirect(data.url);
  }

  redirect("/login");
}
