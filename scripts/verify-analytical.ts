/**
 * Runs the analytical intents against a loaded DB (READONLY_DATABASE_URL) and prints
 * results, to verify the catalog SQL + GBP normalisation on real data. The narrative/
 * explain intents need embeddings (Bedrock) so they are skipped here.
 *
 *   READONLY_DATABASE_URL=postgres://app_readonly:...@host/db npx tsx scripts/verify-analytical.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { CATALOG } from "../lib/intents/catalog";
import { execReadOnly } from "../lib/db";
import { rowLimit, type IntentContext, type IntentName } from "../lib/intents/types";

const ctx: IntentContext = {
  execReadOnly,
  embedQuery: async () => {
    throw new Error("embeddings not available in analytical check");
  },
  rowLimit: rowLimit(),
};

async function run(intent: IntentName, params: Record<string, unknown>) {
  const { rows } = await CATALOG[intent].run(params, ctx);
  console.log(`\n## ${intent} ${JSON.stringify(params)}  (${rows.length} rows)`);
  console.table(rows);
}

(async () => {
  await run("rank_syndicates", { metric: "combined_ratio", year_of_account: 2023, order: "asc" });
  await run("rank_syndicates", { metric: "gwp", year_of_account: 2023 });
  await run("compare", { syndicate_numbers: [1183, 1414, 2001], year_of_account: 2023 });
  await run("market_overview", { year_of_account: 2023 });
  await run("peer_percentile", { syndicate_number: 1183, metric: "combined_ratio", year_of_account: 2023 });
  await run("trend", { syndicate_number: 2525, metric: "combined_ratio", year_from: 2019, year_to: 2024 });
  await run("growers_improvers", { year_from: 2022, year_to: 2023 });
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
