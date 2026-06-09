/**
 * Seeds the MACRO market_series table from data/market-series.json (the dashboard's
 * market-context layer). Wide -> long expansion: each (category, year) becomes one row.
 * Idempotent (UPSERT on series_key+category+year). No Bedrock needed. Owner connection.
 *
 *   npm run seed:market
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

type Series = {
  series_key: string;
  series_label: string;
  unit: string;
  chart_type?: string;
  source_slide?: number;
  years: number[];
  categories: Record<string, number[]>;
  units?: Record<string, string>;
};
type SeedFile = { as_of: string; source: string; series: Series[] };

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "..", "data", "market-series.json");

async function main() {
  if (!existsSync(seedPath)) throw new Error(`${seedPath} not found.`);
  const data: SeedFile = JSON.parse(readFileSync(seedPath, "utf8"));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (owner connection).");

  const client = new Client({ connectionString: url });
  await client.connect();
  let n = 0;
  try {
    for (const s of data.series) {
      for (const [category, values] of Object.entries(s.categories)) {
        if (values.length !== s.years.length) {
          throw new Error(
            `${s.series_key}/${category || "(single)"}: ${values.length} values vs ${s.years.length} years`
          );
        }
        const unit = s.units?.[category] ?? s.unit;
        for (let i = 0; i < s.years.length; i++) {
          await client.query(
            `INSERT INTO market_series
               (series_key, series_label, category, year, value, unit, chart_type, source_slide, source_note)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (series_key, category, year) DO UPDATE SET
               value = EXCLUDED.value, unit = EXCLUDED.unit, series_label = EXCLUDED.series_label,
               chart_type = EXCLUDED.chart_type, source_slide = EXCLUDED.source_slide,
               source_note = EXCLUDED.source_note`,
            [s.series_key, s.series_label, category, s.years[i], values[i], unit, s.chart_type ?? null, s.source_slide ?? null, data.source]
          );
          n++;
        }
      }
      console.log(`seeded series ${s.series_key} (${Object.keys(s.categories).length} categories)`);
    }
    console.log(`\nmarket_series: ${n} points across ${data.series.length} series.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
