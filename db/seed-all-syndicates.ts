/**
 * Seeds the syndicate_summary table from data/all-syndicates.json (the dashboard's
 * full-market breadth layer: 132 syndicates x 2020-2025, native-currency millions).
 * Idempotent (UPSERT on syndicate_number+year_of_account). No Bedrock needed. Owner
 * connection. After loading, flags cited=true for every row whose syndicate has a
 * verified syndicate_year entry (figures reconciled against a source PDF).
 *
 *   npm run seed:all
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

type SyndicateRecord = {
  syndicate_number: number;
  managing_agent: string;
  year: number;
  currency: string | null;
  combined_ratio: number | null;
  gwp_native_m: number | null;
  nep_native_m: number | null;
  profit_native_m: number | null;
  total_assets_native_m: number | null;
};
type SeedFile = { as_of: string; source: string; records: SyndicateRecord[] };

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "..", "data", "all-syndicates.json");

async function main() {
  if (!existsSync(seedPath)) throw new Error(`${seedPath} not found.`);
  const data: SeedFile = JSON.parse(readFileSync(seedPath, "utf8"));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (owner connection).");

  const client = new Client({ connectionString: url });
  await client.connect();
  let n = 0;
  try {
    for (const r of data.records) {
      await client.query(
        `INSERT INTO syndicate_summary
           (syndicate_number, managing_agent, year_of_account, currency, combined_ratio,
            nep_native, gwp_native, profit_native, total_assets_native)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (syndicate_number, year_of_account) DO UPDATE SET
           managing_agent = EXCLUDED.managing_agent, currency = EXCLUDED.currency,
           combined_ratio = EXCLUDED.combined_ratio, nep_native = EXCLUDED.nep_native,
           gwp_native = EXCLUDED.gwp_native, profit_native = EXCLUDED.profit_native,
           total_assets_native = EXCLUDED.total_assets_native`,
        [
          r.syndicate_number, r.managing_agent ?? null, r.year, r.currency ?? null,
          r.combined_ratio ?? null, r.nep_native_m ?? null, r.gwp_native_m ?? null,
          r.profit_native_m ?? null, r.total_assets_native_m ?? null,
        ]
      );
      n++;
      if (n % 100 === 0) console.log(`  ...${n} rows`);
    }

    // Citation flag: a row is cited iff its syndicate has a verified syndicate_year
    // entry. cited defaults false on insert; this is the only place it is set true.
    const cited = await client.query(
      `UPDATE syndicate_summary SET cited = true
       WHERE syndicate_number IN (SELECT syndicate_number FROM syndicate_year WHERE verified = true)`
    );

    const syndicateCount = new Set(data.records.map((r) => r.syndicate_number)).size;
    console.log(`\nsyndicate_summary: ${n} rows across ${syndicateCount} syndicates.`);
    console.log(`cited=true set on ${cited.rowCount} rows (syndicates with a verified syndicate_year).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
