import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para el browser (Client Components).
 * Usa la publishable key — segura de exponer al cliente porque RLS protege
 * los datos. (Supabase la llama "publishable" en proyectos nuevos; antes
 * era la "anon" key — funcionalmente equivalente.)
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
