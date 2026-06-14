import "server-only";
import crypto from "node:crypto";
import { query } from "./db";

/**
 * Fotos de prendas guardadas en la BD de acmsy (tabla garment_photos, bytea).
 * Se sirven por /api/photo con una firma HMAC en la URL (no requiere cookie),
 * así funciona en <img>, en next/image y en fetch del lado servidor.
 */

const secret = () => process.env.SESSION_SECRET || "dev-secret-change-me";

function sign(k: string, v: string): string {
  return crypto.createHmac("sha256", secret()).update(`${k}.${v}`).digest("base64url");
}

// key = "user-<uid>/<garmentId>/photo.<ext>"
export function keyFor(userId: string, photoPath: string): string {
  return `user-${userId}/${photoPath}`;
}

export function signedPhotoUrl(userId: string, photoPath: string, updatedAt: string): string {
  const key = keyFor(userId, photoPath);
  const v = String(updatedAt || "");
  const s = sign(key, v);
  const origin = process.env.ORIGIN || ""; // absoluto para que el fetch del servidor también sirva
  return `${origin}/api/photo?k=${encodeURIComponent(key)}&v=${encodeURIComponent(v)}&s=${s}`;
}

export function verifyPhotoSig(k: string, v: string, s: string): boolean {
  if (!k || !s) return false;
  const expected = sign(k, v || "");
  const a = Buffer.from(s);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function storePhoto(
  key: string,
  userId: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  await query(
    `insert into garment_photos (path, user_id, data, content_type, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (path) do update
       set data = excluded.data, content_type = excluded.content_type, updated_at = now()`,
    [key, userId, data, contentType],
  );
}

export async function deletePhotos(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await query("delete from garment_photos where path = any($1)", [keys]);
}

export async function getPhotoFromDb(
  key: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  const rows = await query<{ data: Buffer; content_type: string }>(
    "select data, content_type from garment_photos where path = $1 limit 1",
    [key],
  );
  const r = rows[0];
  return r ? { data: r.data, contentType: r.content_type } : null;
}
