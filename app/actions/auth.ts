"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import * as auth from "@/lib/server/auth";
import { isValidGender, type GenderSlug } from "@/lib/gender";

export type AuthState = { error?: string; info?: string } | undefined;

async function originFromHeaders(): Promise<string> {
  // Detrás del proxy preferimos el origen público fijo (ORIGIN) sobre el de la
  // request, que puede venir como localhost:3000.
  if (process.env.ORIGIN) return process.env.ORIGIN;
  const h = await headers();
  return h.get("origin") || `https://${h.get("host")}` || "http://localhost:3000";
}

async function setSessionCookie(user: { id: string; email: string }) {
  const store = await cookies();
  store.set(auth.COOKIE, auth.sessionValue(user), auth.cookieOptions());
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Ingresa tu correo y tu contraseña." };

  const user = await auth.findByEmail(email);
  if (!user) return { error: "Este correo no está registrado." };
  if (!user.password_hash) {
    return { error: "Esta cuenta usa Google. Entra con el botón de Google." };
  }
  if (!auth.verifyPassword(password, user.password_hash)) {
    return { error: "Contraseña incorrecta." };
  }

  await auth.recordLogin(user.id);
  await setSessionCookie({ id: user.id, email: user.email });
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const rawGender = String(formData.get("gender") ?? "").trim();
  const gender: GenderSlug = isValidGender(rawGender) ? rawGender : "mixto";

  if (!email || !password) return { error: "Ingresa tu correo y una contraseña." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const existing = await auth.findByEmail(email);
  if (existing) return { error: "Este correo ya tiene una cuenta. Inicia sesión." };

  let user: auth.AuthUser;
  try {
    user = await auth.createUserPassword(email, password, displayName || null, gender);
  } catch {
    return { error: "No pudimos crear la cuenta. Intenta de nuevo." };
  }

  await auth.recordLogin(user.id);
  await setSessionCookie({ id: user.id, email: user.email });
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Ingresa tu correo." };

  const user = await auth.findByEmail(email);
  if (user) {
    try {
      const token = await auth.createResetToken(user.id);
      await auth.sendResetEmail(user.email, token, await originFromHeaders());
    } catch {
      /* no revelamos fallos de envío para no enumerar usuarios */
    }
  }
  // Mensaje genérico — no confirmamos si el correo existe (evita enumeración).
  return {
    info: "Si el correo está registrado, te enviamos un enlace para recuperar tu cuenta. Revisa tu bandeja.",
  };
}

// Usado desde /restablecer con el token del enlace del correo.
export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");
  const token = String(formData.get("token") ?? "");

  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirm) return { error: "Las contraseñas no coinciden." };
  if (!token) return { error: "El enlace no es válido. Pide otro en Recuperar." };

  const uid = await auth.useResetToken(token);
  if (!uid) return { error: "El enlace expiró o ya se usó. Pide otro en Recuperar." };

  await auth.setPassword(uid, password);
  const user = await auth.findById(uid);
  if (user) {
    await setSessionCookie({ id: user.id, email: user.email });
  }
  revalidatePath("/", "layout");
  redirect("/");
}

// Cambiar contraseña desde Ajustes (usuario logueado). Verifica la actual.
export async function changePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const current = String(formData.get("current_password") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");

  if (!current) return { error: "Ingresa tu contraseña actual." };
  if (password.length < 8) return { error: "La contraseña nueva debe tener al menos 8 caracteres." };
  if (password !== confirm) return { error: "Las contraseñas nuevas no coinciden." };
  if (password === current) return { error: "La nueva contraseña debe ser distinta a la actual." };

  const store = await cookies();
  const uid = auth.readSessionUid(store.get(auth.COOKIE)?.value);
  const user = uid ? await auth.findById(uid) : null;
  if (!user) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };

  if (!user.password_hash || !auth.verifyPassword(current, user.password_hash)) {
    return { error: "La contraseña actual es incorrecta." };
  }
  await auth.setPassword(user.id, password);
  return { info: "Contraseña actualizada." };
}

export async function logout() {
  const store = await cookies();
  store.delete(auth.COOKIE);
  revalidatePath("/", "layout");
  redirect("/login");
}

// Inicia el flujo OAuth con Google (vía el relevo de acmsy.com).
export async function signInWithGoogle() {
  if (!auth.googleEnabled()) redirect("/login?oauth=error");
  const { randomToken } = await import("@/lib/server/security");
  const state = randomToken(16) + auth.oauthStateSuffix();
  const store = await cookies();
  store.set("drestyl_oauth", state, { ...auth.cookieOptions(1), maxAge: 600 });
  const url = auth.googleAuthUrl(await originFromHeaders(), state);
  redirect(url);
}
