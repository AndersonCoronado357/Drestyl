import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import * as auth from "@/lib/server/auth";
import { makeFrom } from "@/lib/server/sb";
import { storePhoto, deletePhotos } from "@/lib/server/photos";

// Cliente compatible con el subconjunto del cliente Supabase que usa Drestyl,
// pero 100% sobre acmsy:
//   - .from()    -> PostgreSQL gestionado + RLS (app.user_id de la sesión).
//   - .auth      -> usuario leído de la cookie de sesión firmada de acmsy.
//   - .storage   -> fotos en la BD de acmsy (tabla garment_photos), servidas
//                   por /api/photo con URL firmada.
//
// Las páginas, actions y rutas siguen llamando a `supabase.from(...)`,
// `supabase.storage.from(bucket).upload/remove(...)` y `supabase.auth.getUser()`.

function makeStorage() {
  return {
    from(bucket: string) {
      const uid = bucket.replace(/^user-/, "");
      return {
        async upload(path: string, file: Blob, opts?: { contentType?: string }) {
          try {
            const buf = Buffer.from(await file.arrayBuffer());
            const ct =
              opts?.contentType ||
              (file as { type?: string }).type ||
              "image/webp";
            await storePhoto(`${bucket}/${path}`, uid, buf, ct);
            return { data: { path }, error: null };
          } catch (e) {
            return {
              data: null,
              error: { message: e instanceof Error ? e.message : "upload failed" },
            };
          }
        },
        async remove(paths: string[]) {
          try {
            await deletePhotos(paths.map((p) => `${bucket}/${p}`));
            return { data: {}, error: null };
          } catch (e) {
            return {
              data: null,
              error: { message: e instanceof Error ? e.message : "remove failed" },
            };
          }
        },
      };
    },
  };
}

export async function createClient() {
  const store = await cookies();
  const sess = auth.readSession(store.get(auth.COOKIE)?.value);
  const user = sess ? { id: sess.uid, email: sess.email } : null;
  return {
    __user: user,
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({
        data: { session: user ? { user } : null },
        error: null,
      }),
    },
    from: makeFrom(user?.id ?? null),
    storage: makeStorage(),
    rpc: async () => ({ data: null, error: { message: "rpc no soportado en acmsy" } }),
  };
}

// Usuario + cliente para Server Components/páginas (dedup por render con cache()).
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  return { supabase, user: supabase.__user };
});
