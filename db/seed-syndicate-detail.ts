/**
 * Seeds the syndicate_detail table from data/syndicate-detail.json (the dashboard's
 * per-syndicate drill-down layer: 11,613 rows of native-currency millions, one row per
 * syndicate / year / dataset / segment / metric). Idempotent (UPSERT on the 5-col PK).
 * No Bedrock needed. Owner connection.
 *
 *   npm run seed:detail
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

type DetailRecord = {
  syndicate_number: number;
  year: number;
  dataset: string;
  segment: string;
  metric: string;
  value: number | null;
  currency: string | null;
};
type SeedFile = { as_of: string; source: string; records: DetailRecord[] };

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "..", "data", "syndicate-detail.json");

async function main() {
  if (!existsSync(seedPath)) throw new Error(`${seedPath} not found.`);
  const data: SeedFile = JSON.parse(readFileSync(seedPath, "utf8"));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (owner connection).");

  const client = new Client({ connectionString: url });
  await client.connect();
  let n = 0;
  try {
    // Dedup by PK (last wins) so a single multi-row INSERT never hits the same
    // ON CONFLICT target twice (Postgres rejects that). Then batch inserts: one
    // round-trip per 500 rows instead of per row (Aurora is cross-region, so the
    // per-row loop was latency-bound and far too slow for ~11k rows).
    const byPk = new Map<string, DetailRecord>();
    for (const r of data.records) {
      byPk.set(`${r.syndicate_number}|${r.year}|${r.dataset}|${r.segment}|${r.metric}`, r);
    }
    const records = [...byPk.values()];
    const BATCH = 500;
    for (let i = 0; i < records.length; i += BATCH) {
      const chunk = records.slice(i, i + BATCH);
      const vals: unknown[] = [];
      const tuples = chunk
        .map((r, j) => {
          const b = j * 7;
          vals.push(r.syndicate_number, r.year, r.dataset, r.segment, r.metric, r.value ?? null, r.currency ?? null);
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`;
        })
        .join(",");
      await client.query(
        `INSERT INTO syndicate_detail
           (syndicate_number, year_of_account, dataset, segment, metric, value, currency)
         VALUES ${tuples}
         ON CONFLICT (syndicate_number, year_of_account, dataset, segment, metric) DO UPDATE SET
           value = EXCLUDED.value, currency = EXCLUDED.currency`,
        vals
      );
      n += chunk.length;
      console.log(`  ...${n} rows`);
    }

    const syndicateCount = new Set(data.records.map((r) => r.syndicate_number)).size;
    console.log(`\nsyndicate_detail: ${n} rows across ${syndicateCount} syndicates.`);

    // Per-dataset breakdown (datasets derived from the data, not hardcoded).
    const datasets = [...new Set(data.records.map((r) => r.dataset))].sort();
    for (const ds of datasets) {
      const rows = data.records.filter((r) => r.dataset === ds);
      const syns = new Set(rows.map((r) => r.syndicate_number)).size;
      console.log(`  ${ds}: ${rows.length} rows, ${syns} syndicates.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
