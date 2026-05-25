import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con la SERVICE ROLE KEY. Salta RLS.
 *
 * DANGER: usar SOLO en código server-side que NO toque input del usuario sin
 * validar. Nunca importar este archivo desde Client Components ni exponer su
 * resultado a la respuesta sin filtrar. El `server-only` import previene el
 * uso accidental en cliente (rompe el build).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno",
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
