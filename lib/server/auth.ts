import "server-only";
import { query } from "./db";
import * as sec from "./security";
import * as google from "./google";
import { sendEmail, passwordResetEmail } from "./mailer";

// Auth de acmsy para Drestyl (sobre el PostgreSQL gestionado, reemplaza a
// Supabase Auth). Los usuarios viven en auth.users (UUID); el trigger
// handle_new_user crea su public.profiles. Sesión = cookie firmada.

export const APP_NAME = "Drestyl";
export const COOKIE = "drestyl_session";
const RESET_MINUTES = 30;

export type AuthUser = {
  id: string;
  email: string;
  raw_user_meta_data: Record<string, unknown>;
  password_hash: string | null;
  google_id: string | null;
  email_verified: boolean;
  created_at: string;
};

const norm = (e: string) => String(e || "").trim().toLowerCase();

export async function findByEmail(email: string): Promise<AuthUser | null> {
  const rows = await query<AuthUser>("select * from auth.users where email = $1 limit 1", [norm(email)]);
  return rows[0] ?? null;
}
export async function findById(id: string): Promise<AuthUser | null> {
  const rows = await query<AuthUser>("select * from auth.users where id = $1 limit 1", [id]);
  return rows[0] ?? null;
}

// Crea cuenta de correo/contraseña. El trigger crea el profile (lee display_name
// y gender de raw_user_meta_data).
export async function createUserPassword(
  email: string,
  password: string,
  displayName: string | null,
  gender: string,
): Promise<AuthUser> {
  const meta = { display_name: displayName, name: displayName, gender };
  const rows = await query<AuthUser>(
    `insert into auth.users (email, password_hash, email_verified, raw_user_meta_data)
     values ($1, $2, true, $3::jsonb) returning *`,
    [norm(email), sec.hashPassword(password), JSON.stringify(meta)],
  );
  return rows[0];
}

// Vincula Google por correo; si no existe, la crea (gender 'mixto' por defecto;
// se ajusta luego en Ajustes). Misma cuenta por correo: no se duplica.
export async function upsertGoogleUser(p: google.GoogleProfile): Promise<AuthUser> {
  const existing = await findByEmail(p.email);
  if (existing) {
    const meta = JSON.stringify({ name: p.name, picture: p.picture });
    const rows = await query<AuthUser>(
      `update auth.users set google_id = coalesce(google_id, $2), email_verified = true,
       raw_user_meta_data = raw_user_meta_data || $3::jsonb where id = $1 returning *`,
      [existing.id, p.googleId, meta],
    );
    return rows[0];
  }
  const meta = JSON.stringify({ display_name: p.name, name: p.name, picture: p.picture, gender: "mixto" });
  const rows = await query<AuthUser>(
    `insert into auth.users (email, google_id, email_verified, raw_user_meta_data)
     values ($1, $2, true, $3::jsonb) returning *`,
    [norm(p.email), p.googleId, meta],
  );
  return rows[0];
}

export async function setPassword(id: string, password: string): Promise<void> {
  await query("update auth.users set password_hash = $2 where id = $1", [id, sec.hashPassword(password)]);
}
export async function recordLogin(id: string): Promise<void> {
  await query(
    "update auth.users set last_login_at = now(), last_seen_at = now(), login_count = login_count + 1 where id = $1",
    [id],
  );
}

export const verifyPassword = sec.verifyPassword;

// --- Tokens de recuperación (un solo uso) ---
export async function createResetToken(userId: string): Promise<string> {
  const token = sec.randomToken(32);
  const expires = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
  await query("insert into auth.tokens (user_id, kind, token_hash, expires_at) values ($1,$2,$3,$4)", [
    userId,
    "reset",
    sec.sha256(token),
    expires,
  ]);
  return token;
}
export async function useResetToken(rawToken: string): Promise<string | null> {
  const rows = await query<{ id: string; user_id: string; expires_at: string }>(
    "select * from auth.tokens where kind = $1 and token_hash = $2 and used = false limit 1",
    ["reset", sec.sha256(rawToken)],
  );
  const t = rows[0];
  if (!t || new Date(t.expires_at).getTime() < Date.now()) return null;
  await query("update auth.tokens set used = true where id = $1", [t.id]);
  return t.user_id;
}
export async function sendResetEmail(email: string, token: string, origin: string): Promise<void> {
  const url = `${origin}/restablecer?token=${token}`;
  const t = passwordResetEmail({ appName: APP_NAME, url, minutes: RESET_MINUTES });
  await sendEmail({ to: email, subject: t.subject, html: t.html, text: t.text, displayName: APP_NAME });
}

// --- Google (URL + intercambio), callback directo ---
export function googleEnabled(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
// Origen PÚBLICO fijo. Detrás de Caddy/Cloudflare, request.url puede llegar
// como http://localhost:3000; por eso para OAuth y redirecciones usamos
// ORIGIN (inyectado en el deploy = https://drestyl.acmsy.com), NO la request.
export function publicOrigin(fallback?: string): string {
  return process.env.ORIGIN || process.env.APP_URL || fallback || "http://localhost:3000";
}
// El redirect_uri DEBE ser idéntico en el authorize y en el intercambio del
// code; por eso ambos usan el origen público fijo (no el de la request).
function googleRedirectUri(): string {
  return `${publicOrigin()}/auth/callback`;
}
export function oauthStateSuffix(): string {
  return "";
}
export function googleAuthUrl(_origin: string, state: string): string {
  return google.authUrl({ clientId: process.env.GOOGLE_CLIENT_ID!, redirectUri: googleRedirectUri(), state });
}
export async function googleProfileFromCode(code: string, _origin?: string): Promise<google.GoogleProfile> {
  const tokens = await google.exchangeCode({
    code,
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: googleRedirectUri(),
  });
  return google.fetchProfile(tokens.access_token);
}

// --- Sesión (cookie firmada) ---
export function sessionValue(user: { id: string; email: string }): string {
  return sec.sign({ uid: user.id, email: user.email });
}
export function readSessionUid(raw: string | undefined): string | null {
  const data = raw ? sec.unsign<{ uid: string; email: string }>(raw) : null;
  return data?.uid ?? null;
}
export function readSession(raw: string | undefined): { uid: string; email: string } | null {
  return raw ? sec.unsign<{ uid: string; email: string }>(raw) : null;
}
export function cookieOptions(maxAgeDays = 30) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * maxAgeDays,
  };
}
