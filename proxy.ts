import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy de Drestyl (middleware de Next 16).
 *  - Verifica la cookie de sesión firmada de acmsy (HMAC-SHA256) con Web Crypto
 *    (compatible con el runtime Edge), SIN viaje de red.
 *  - Redirige rutas protegidas a /login si no hay sesión, y /login|/signup|
 *    /recuperar a / si ya hay sesión.
 *
 * Verificación optimista para UX; la seguridad real de los datos la impone RLS
 * en Postgres (cada query corre como el usuario de la sesión).
 */
const COOKIE = "drestyl_session";

function b64url(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hasValidSession(
  token: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!token || !secret || !token.includes(".")) return false;
  const i = token.lastIndexOf(".");
  const json = token.slice(0, i);
  const mac = token.slice(i + 1);
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(json));
    return b64url(sig) === mac;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  const user = await hasValidSession(token, process.env.SESSION_SECRET);
  const path = request.nextUrl.pathname;

  const isPublicLogin = path === "/login" || path === "/signup" || path === "/recuperar";
  const isAuthTechnical = path === "/restablecer" || path.startsWith("/auth/");
  // /api/photo tiene su propia firma HMAC (no depende de la cookie de sesión),
  // así que la dejamos pasar siempre (sirve <img>, next/image y fetch interno).
  const isPublicApi = path.startsWith("/api/photo");

  if (!user && !isPublicLogin && !isAuthTechnical && !isPublicApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isPublicLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon\\.svg|manifest\\.webmanifest|sw\\.js|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg)).*)",
  ],
};
