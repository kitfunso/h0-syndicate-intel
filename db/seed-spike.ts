/**
 * Loads the spike dataset (data/spike-seed.json, produced by scripts/synth-to-seed.ts)
 * into Aurora and embeds every narrative chunk via Vertex (gemini-embedding-001 @ 768).
 * Computes the GBP-normalised value from native value x fx_rate. Uses the OWNER
 * connection. Shape documented in data/spike-seed.example.json.
 *
 *   npm run seed:spike
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { config } from "dotenv";
import { embedTexts } from "../lib/llm";

config({ path: ".env.local" });
config();

type Chunk = { page_no: number; section: string; text: string };
type Year = {
  year_of_account: number;
  currency: string;
  combined_ratio?: number | null;
  combined_ratio_adjusted?: boolean;
  combined_ratio_page?: number | null;
  gwp_native?: number | null;
  gwp_page?: number | null;
  nep_native?: number | null;
  nep_page?: number | null;
  verified?: boolean;
  report?: { title: string; source_url: string; n_pages: number };
  chunks?: Chunk[];
};
type Syndicate = {
  syndicate_number: number;
  name: string;
  managing_agent: string;
  inception_year?: number | null;
  years: Year[];
};
type Seed = {
  fx_rates: { currency: string; year_of_account: number; rate_to_gbp: number }[];
  syndicates: Syndicate[];
};

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "..", "data", "spike-seed.json");

function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

async function main() {
  if (!existsSync(seedPath)) {
    throw new Error(`${seedPath} not found. Run: npm run convert`);
  }
  const seed: Seed = JSON.parse(readFileSync(seedPath, "utf8"));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (owner connection).");

  const fx = new Map<string, number>();
  for (const r of seed.fx_rates) fx.set(`${r.currency}:${r.year_of_account}`, Number(r.rate_to_gbp));
  const toGbp = (native: number | null | undefined, ccy: string, year: number): number | null => {
    if (native == null) return null;
    const rate = fx.get(`${ccy}:${year}`) ?? (ccy === "GBP" ? 1 : null);
    if (rate == null) throw new Error(`no fx_rate for ${ccy}:${year}`);
    return Number(native) * rate;
  };

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const r of seed.fx_rates) {
      await client.query(
        `INSERT INTO fx_rate (currency, year_of_account, rate_to_gbp) VALUES ($1,$2,$3)
         ON CONFLICT (currency, year_of_account) DO UPDATE SET rate_to_gbp = EXCLUDED.rate_to_gbp`,
        [r.currency, r.year_of_account, r.rate_to_gbp]
      );
    }

    for (const syn of seed.syndicates) {
      const agentId = (
        await client.query<{ id: number }>(
          `INSERT INTO managing_agent (name) VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [syn.managing_agent]
        )
      ).rows[0].id;

      await client.query(
        `INSERT INTO syndicate (syndicate_number, name, managing_agent_id, inception_year)
         VALUES ($1,$2,$3,$4) ON CONFLICT (syndicate_number) DO UPDATE
         SET name = EXCLUDED.name, managing_agent_id = EXCLUDED.managing_agent_id`,
        [syn.syndicate_number, syn.name, agentId, syn.inception_year ?? null]
      );

      for (const y of syn.years) {
        let reportId: number | null = null;
        if (y.report) {
          reportId = (
            await client.query<{ id: number }>(
              `INSERT INTO report (syndicate_number, year_of_account, title, source_url, n_pages)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (syndicate_number, year_of_account) DO UPDATE SET title = EXCLUDED.title
               RETURNING id`,
              [syn.syndicate_number, y.year_of_account, y.report.title, y.report.source_url, y.report.n_pages]
            )
          ).rows[0].id;
        }

        await client.query(
          `INSERT INTO syndicate_year
             (syndicate_number, year_of_account, currency, combined_ratio, combined_ratio_adjusted,
              combined_ratio_page, gwp_native, gwp_gbp, gwp_page, nep_native, nep_gbp, nep_page,
              source_report_id, verified)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (syndicate_number, year_of_account) DO UPDATE SET
             combined_ratio = EXCLUDED.combined_ratio, gwp_native = EXCLUDED.gwp_native,
             gwp_gbp = EXCLUDED.gwp_gbp, nep_native = EXCLUDED.nep_native,
             nep_gbp = EXCLUDED.nep_gbp, verified = EXCLUDED.verified`,
          [
            syn.syndicate_number, y.year_of_account, y.currency, y.combined_ratio ?? null,
            y.combined_ratio_adjusted ?? false, y.combined_ratio_page ?? null,
            y.gwp_native ?? null, toGbp(y.gwp_native, y.currency, y.year_of_account), y.gwp_page ?? null,
            y.nep_native ?? null, toGbp(y.nep_native, y.currency, y.year_of_account), y.nep_page ?? null,
            reportId, y.verified ?? false,
          ]
        );

        const chunks = y.chunks ?? [];
        if (chunks.length && reportId != null && process.env.SKIP_EMBED !== "1") {
          const vectors = await embedTexts(chunks.map((c) => c.text));
          for (let i = 0; i < chunks.length; i++) {
            await client.query(
              `INSERT INTO report_chunk (report_id, page_no, section, text, embedding)
               VALUES ($1,$2,$3,$4,$5::vector)`,
              [reportId, chunks[i].page_no, chunks[i].section, chunks[i].text, toVectorLiteral(vectors[i])]
            );
          }
        }
      }
      console.log(`seeded syndicate ${syn.syndicate_number} (${syn.name})`);
    }

    await client.query("REFRESH MATERIALIZED VIEW mv_peer_percentiles");
    await client.query("REFRESH MATERIALIZED VIEW mv_syndicate_trend");
    console.log("seed complete + materialised views refreshed.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
