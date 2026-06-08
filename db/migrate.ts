/**
 * Minimal forward-only migration runner. Applies db/migrations/*.sql in filename
 * order against the OWNER connection (DATABASE_URL) and records applied files in
 * a _migrations table. Idempotent: already-applied files are skipped.
 *
 *   npm run migrate
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" }); // Next.js convention; falls back to .env below
config();

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (owner connection).");

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS _migrations (
         filename text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`
    );
    const applied = new Set(
      (await client.query<{ filename: string }>("SELECT filename FROM _migrations")).rows.map(
        (r) => r.filename
      )
    );

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file}`);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      console.log(`apply ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`migration ${file} failed: ${(err as Error).message}`);
      }
    }
    console.log("migrations complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
