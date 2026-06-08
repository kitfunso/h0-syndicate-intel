/**
 * Loads the spike dataset (data/spike-seed.json) into Aurora and embeds every
 * narrative chunk via Vertex (gemini-embedding-001 @ 768). Uses the OWNER
 * connection. Replace data/spike-seed.json with verified Synth output; the shape
 * is documented in data/spike-seed.example.json.
 *
 *   npm run seed:spike
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { config } from "dotenv";
import { embedTexts } from "../lib/vertex";

config({ path: ".env.local" }); // Next.js convention; falls back to .env below
config();

type Lob = {
  line_of_business: string;
  gwp_gbp?: number;
  loss_ratio?: number;
  combined_ratio?: number;
  source_page?: number;
  verified?: boolean;
};
type Chunk = { page_no: number; section: string; text: string };
type Year = {
  year_of_account: number;
  facts: Record<string, number | boolean | null>;
  lob?: Lob[];
  report: { title: string; source_url: string; n_pages: number };
  chunks?: Chunk[];
};
type Syndicate = {
  syndicate_number: number;
  name: string;
  managing_agent: string;
  inception_year?: number;
  years: Year[];
};

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "..", "data", "spike-seed.json");

function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

async function main() {
  if (!existsSync(seedPath)) {
    throw new Error(
      `${seedPath} not found. Copy data/spike-seed.example.json -> data/spike-seed.json and fill with verified Synth output.`
    );
  }
  const data: Syndicate[] = JSON.parse(readFileSync(seedPath, "utf8"));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (owner connection).");

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const syn of data) {
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
        const reportId = (
          await client.query<{ id: number }>(
            `INSERT INTO report (syndicate_number, year_of_account, title, source_url, n_pages)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (syndicate_number, year_of_account) DO UPDATE SET title = EXCLUDED.title
             RETURNING id`,
            [syn.syndicate_number, y.year_of_account, y.report.title, y.report.source_url, y.report.n_pages]
          )
        ).rows[0].id;

        const f = y.facts;
        await client.query(
          `INSERT INTO syndicate_year
             (syndicate_number, year_of_account, capacity_gbp, gwp_gbp, nwp_gbp,
              combined_ratio, result_gbp, return_on_capacity, source_report_id, source_page, verified)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (syndicate_number, year_of_account) DO UPDATE SET
             gwp_gbp = EXCLUDED.gwp_gbp, combined_ratio = EXCLUDED.combined_ratio,
             verified = EXCLUDED.verified`,
          [
            syn.syndicate_number, y.year_of_account, f.capacity_gbp ?? null, f.gwp_gbp ?? null,
            f.nwp_gbp ?? null, f.combined_ratio ?? null, f.result_gbp ?? null,
            f.return_on_capacity ?? null, reportId, f.source_page ?? null, f.verified ?? false,
          ]
        );

        for (const l of y.lob ?? []) {
          await client.query(
            `INSERT INTO lob_result
               (syndicate_number, year_of_account, line_of_business, gwp_gbp, loss_ratio,
                combined_ratio, source_report_id, source_page, verified)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (syndicate_number, year_of_account, line_of_business) DO NOTHING`,
            [
              syn.syndicate_number, y.year_of_account, l.line_of_business, l.gwp_gbp ?? null,
              l.loss_ratio ?? null, l.combined_ratio ?? null, reportId, l.source_page ?? null,
              l.verified ?? false,
            ]
          );
        }

        const chunks = y.chunks ?? [];
        if (chunks.length) {
          const vectors = await embedTexts(chunks.map((c) => c.text), "RETRIEVAL_DOCUMENT");
          for (let i = 0; i < chunks.length; i++) {
            const c = chunks[i];
            await client.query(
              `INSERT INTO report_chunk (report_id, page_no, section, text, embedding)
               VALUES ($1,$2,$3,$4,$5::vector)`,
              [reportId, c.page_no, c.section, c.text, toVectorLiteral(vectors[i])]
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
