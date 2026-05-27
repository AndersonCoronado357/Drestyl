#!/usr/bin/env node
import { Client } from "pg";

const client = new Client({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT ?? 5432),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const buckets = await client.query(
  "select id, name, public from storage.buckets order by created_at",
);
console.log("Buckets:");
buckets.rows.forEach((b) => console.log(`  - ${b.name} (public=${b.public})`));

const policies = await client.query(
  "select policyname from pg_policies where schemaname='storage' and policyname like 'garments%' order by policyname",
);
console.log("\nStorage policies del bucket 'garments':");
policies.rows.forEach((p) => console.log(`  - ${p.policyname}`));

await client.end();
