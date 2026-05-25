#!/usr/bin/env node
/**
 * Aplica un archivo SQL a la base de datos Postgres de Supabase.
 *
 * Uso:
 *   PG_HOST=... PG_USER=... PG_PASSWORD=... node scripts/run-migration.mjs <ruta-al-sql>
 *
 * No persiste credenciales — solo las lee del entorno del proceso actual.
 */
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/run-migration.mjs <ruta-al-sql>");
  process.exit(1);
}

const host = process.env.PG_HOST;
const user = process.env.PG_USER;
const password = process.env.PG_PASSWORD;
const port = Number(process.env.PG_PORT ?? 5432);

if (!host || !user || !password) {
  console.error("Faltan PG_HOST, PG_USER o PG_PASSWORD en el entorno.");
  process.exit(1);
}

const sql = await readFile(file, "utf8");
const client = new Client({
  host,
  port,
  user,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  application_name: "drestyl-migration",
});

try {
  await client.connect();
  console.log(`Conectado a ${host}:${port}`);
  await client.query(sql);
  console.log("✓ Migración aplicada");

  const { rows: tables } = await client.query(
    "select table_name from information_schema.tables where table_schema='public' order by table_name",
  );
  console.log("Tablas en public:", tables.map((r) => r.table_name).join(", "));

  const { rows: policies } = await client.query(
    "select tablename, policyname from pg_policies where schemaname='public' order by tablename, policyname",
  );
  console.log(
    "Policies RLS:",
    policies.map((r) => `${r.tablename}.${r.policyname}`).join(", "),
  );

  const { rows: triggers } = await client.query(
    "select trigger_name, event_object_table from information_schema.triggers where trigger_schema in ('public','auth') and trigger_name in ('on_auth_user_created','profiles_touch_updated_at')",
  );
  console.log(
    "Triggers:",
    triggers
      .map((r) => `${r.trigger_name} on ${r.event_object_table}`)
      .join(", "),
  );
} catch (err) {
  console.error("Error aplicando migración:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
