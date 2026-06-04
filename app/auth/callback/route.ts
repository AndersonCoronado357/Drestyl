import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import * as auth from "@/lib/server/auth";

/**
 * Callback OAuth de Google (auth de acmsy). Google vuelve directo aquí con
 * `code` + `state`. Validamos el state contra la cookie, intercambiamos el
 * code y creamos/vinculamos el usuario + la sesión.
 *
 * Importante: detrás del proxy, request.url puede llegar como localhost:3000,
 * así que TODAS las redirecciones usan el origen público fijo (ORIGIN).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const base = auth.publicOrigin();
  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? "";
  const err = searchParams.get("error");

  if (err || !code) {
    return NextResponse.redirect(`${base}/login?oauth=missing_code`);
  }

  const store = await cookies();
  const expected = store.get("drestyl_oauth")?.value;
  if (!expected || expected !== state) {
    return NextResponse.redirect(`${base}/login?oauth=state`);
  }
  store.delete("drestyl_oauth");

  try {
    const profile = await auth.googleProfileFromCode(code);
    if (!profile.email) {
      return NextResponse.redirect(`${base}/login?oauth=no_email`);
    }
    const user = await auth.upsertGoogleUser(profile);
    await auth.recordLogin(user.id);

    const res = NextResponse.redirect(`${base}/`);
    res.cookies.set(
      auth.COOKIE,
      auth.sessionValue({ id: user.id, email: user.email }),
      auth.cookieOptions(),
    );
    return res;
  } catch (e) {
    console.error("[auth/callback] exchange failed:", e);
    return NextResponse.redirect(`${base}/login?oauth=exchange_failed`);
  }
}
