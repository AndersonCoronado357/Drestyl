import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy de Drestyl (lo que en Next 15 se llamaba middleware).
 *
 * 1. Refresca el token de Supabase para que las cookies siempre estén al día.
 * 2. Redirige rutas protegidas a /login si no hay sesión.
 * 3. Redirige /login y /signup a / si ya hay sesión.
 *
 * Esta es una verificación "optimista" basada en la cookie. La verificación
 * de seguridad real (acceso a datos) la hace Postgres con RLS — esto solo
 * mejora la UX evitando renderizar pantallas que vamos a redirigir.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refrescar la sesión si está por expirar.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Pantallas públicas para usuarios SIN sesión. Si hay sesión, redirigir
  // a / (no tiene sentido ver "Iniciar sesión" si ya estás dentro).
  const isPublicLogin =
    path === "/login" || path === "/signup" || path === "/recuperar";

  // Rutas técnicas del flow auth: callbacks, restablecer contraseña.
  // Permiten visita sin sesión (la creación de sesión ocurre AHÍ) o con
  // sesión recovery (caso de /restablecer). No las redirigimos ni para
  // un lado ni para otro — cada una decide en su handler.
  const isAuthTechnical =
    path === "/restablecer" || path.startsWith("/auth/");

  if (!user && !isPublicLogin && !isAuthTechnical) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublicLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * El proxy corre en todas las rutas EXCEPTO:
     * - assets estáticos de Next (_next/...)
     * - assets públicos (icon.svg, manifest.webmanifest, sw.js, favicon)
     * - archivos con extensión (imágenes, etc.)
     */
    "/((?!_next/static|_next/image|icon\\.svg|manifest\\.webmanifest|sw\\.js|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg)).*)",
  ],
};
