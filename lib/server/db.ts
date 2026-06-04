import "server-only";
import pg from "pg";

// pg parsea date/timestamp a objetos Date; Supabase (PostgREST) los devolvía como
// strings y la app los trata así (worn_date, created_at). Forzamos string para no
// romper el formateo.
pg.types.setTypeParser(1082, (v) => v); // date        -> 'YYYY-MM-DD'
pg.types.setTypeParser(1114, (v) => v); // timestamp
pg.types.setTypeParser(1184, (v) => v); // timestamptz

// Pool único (cachéado en global para sobrevivir al hot-reload de dev).
const g = globalThis as unknown as { __drestylPool?: pg.Pool };
export const pool =
  g.__drestylPool ??
  new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (!g.__drestylPool) g.__drestylPool = pool;

// Consulta como superusuario (sin RLS). Para auth y tareas administrativas.
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const r = await pool.query(text, params);
  return r.rows as T[];
}

// Ejecuta `fn` en una transacción con rol 'authenticated' y el usuario fijado en
// app.user_id, de modo que auth.uid() y TODAS las políticas RLS aplican igual que
// en Supabase. `uid` = UUID del usuario (o null para anónimo).
export async function withUser<T>(
  uid: string | null,
  fn: (c: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('app.user_id', $1, true)", [uid ?? ""]);
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    try {
      await client.query("rollback");
    } catch {
      /* noop */
    }
    throw e;
  } finally {
    client.release();
  }
}
