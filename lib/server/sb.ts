import "server-only";
import { withUser } from "./db";

// Adaptador compatible con el subconjunto del cliente Supabase que usa Drestyl,
// sobre PostgreSQL + RLS. Expone `.from(tabla).select()/insert()/update()/delete()`
// con `.eq/.in/.gte/.order/.limit/.maybeSingle`, devolviendo `{ data, error }`.
// Por dentro corre con rol 'authenticated' y app.user_id fijado, así RLS aplica
// igual que en Supabase. NO hay que reescribir las queries de la app.

type SbError = { message: string } | null;
/* eslint-disable @typescript-eslint/no-explicit-any */
type Result<T = any> = { data: T; error: SbError; count?: number | null };

function ident(s: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(String(s))) throw new Error("identificador inválido: " + s);
  return s;
}

// jsonb (objeto plano) -> string para insertar en columnas jsonb; arrays (uuid[])
// y escalares pasan tal cual a pg.
function pval(v: unknown): unknown {
  if (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    !(v instanceof Date) &&
    !Buffer.isBuffer(v)
  ) {
    return JSON.stringify(v);
  }
  return v;
}

type Filter = { col: string; op: "eq" | "in" | "gte" | "lte" | "neq"; val: unknown };

class QueryBuilder<T = any> implements PromiseLike<Result<T>> {
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private cols = "*";
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private single = false;
  private countMode: string | null = null;
  private headOnly = false;

  constructor(
    private uid: string | null,
    private table: string,
  ) {
    ident(table);
  }

  select(
    cols = "*",
    opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean },
  ) {
    if (this.mode === "select") this.cols = cols || "*";
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Record<string, unknown>) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col: ident(col), op: "eq", val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push({ col: ident(col), op: "neq", val });
    return this;
  }
  in(col: string, val: unknown[]) {
    this.filters.push({ col: ident(col), op: "in", val });
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push({ col: ident(col), op: "gte", val });
    return this;
  }
  lte(col: string, val: unknown) {
    this.filters.push({ col: ident(col), op: "lte", val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col: ident(col), asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitN = Number(n);
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this as unknown as QueryBuilder<T>;
  }

  private buildWhere(params: unknown[]): string {
    if (!this.filters.length) return "";
    const parts = this.filters.map((f) => {
      params.push(f.op === "in" ? f.val : pval(f.val));
      const ph = "$" + params.length;
      if (f.op === "in") return `${f.col} = ANY(${ph})`;
      if (f.op === "gte") return `${f.col} >= ${ph}`;
      if (f.op === "lte") return `${f.col} <= ${ph}`;
      if (f.op === "neq") return `${f.col} <> ${ph}`;
      return `${f.col} = ${ph}`;
    });
    return " where " + parts.join(" and ");
  }

  private build(): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    const t = this.table;
    if (this.mode === "select") {
      let sql = `select ${this.cols} from ${t}`;
      sql += this.buildWhere(params);
      if (this.orders.length)
        sql +=
          " order by " + this.orders.map((o) => `${o.col} ${o.asc ? "asc" : "desc"}`).join(", ");
      if (this.limitN != null) sql += ` limit ${this.limitN}`;
      return { sql, params };
    }
    if (this.mode === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).map(ident);
      const tuples = rows.map((r) => {
        const ph = cols.map((c) => {
          params.push(pval((r as Record<string, unknown>)[c]));
          return "$" + params.length;
        });
        return "(" + ph.join(", ") + ")";
      });
      return {
        sql: `insert into ${t} (${cols.join(", ")}) values ${tuples.join(", ")}`,
        params,
      };
    }
    if (this.mode === "update") {
      const obj = (this.payload ?? {}) as Record<string, unknown>;
      const sets = Object.keys(obj).map((k) => {
        params.push(pval(obj[k]));
        return `${ident(k)} = $${params.length}`;
      });
      return { sql: `update ${t} set ${sets.join(", ")}${this.buildWhere(params)}`, params };
    }
    // delete
    return { sql: `delete from ${t}${this.buildWhere(params)}`, params };
  }

  async run(): Promise<Result<T>> {
    try {
      // count: 'exact' → corre un count(*) con los MISMOS filtros (Supabase lo
      // devuelve en `count`). head: true → solo el count, sin traer filas.
      let count: number | null = null;
      if (this.mode === "select" && this.countMode) {
        const cparams: unknown[] = [];
        const cwhere = this.buildWhere(cparams);
        const crows = await withUser(this.uid, async (c) =>
          (
            await c.query(
              `select count(*)::int as count from ${this.table}${cwhere}`,
              cparams,
            )
          ).rows,
        );
        count = (crows[0] as { count?: number } | undefined)?.count ?? 0;
        if (this.headOnly) {
          return { data: (this.single ? null : []) as unknown as T, error: null, count };
        }
      }
      const { sql, params } = this.build();
      const rows = await withUser(this.uid, async (c) => (await c.query(sql, params)).rows);
      if (this.mode === "select") {
        const data = this.single ? ((rows[0] ?? null) as T) : (rows as unknown as T);
        return { data, error: null, count };
      }
      return { data: null as unknown as T, error: null };
    } catch (e) {
      return { data: null as unknown as T, error: { message: (e as Error).message } };
    }
  }

  then<R1 = Result<T>, R2 = never>(
    onfulfilled?: ((v: Result<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

export function makeFrom(uid: string | null) {
  return (table: string) => new QueryBuilder(uid, table);
}
