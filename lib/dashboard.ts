/**
 * Dashboard data layer (the "discovery surface" behind the charts).
 *
 * The default dashboard charts are FIXED analytical questions, not natural language, so
 * they run the allowlisted catalog intents DIRECTLY — no LLM router, no embeddings. That
 * means the dashboard renders from verified data even when Bedrock is unavailable, and
 * every chart datum carries syndicate_number + source_page so the frontend can wire
 * "click a bar/dot -> ask a cited question / open the source page".
 *
 * This is the MICRO (per-syndicate, page-cited) layer only. The MACRO market-aggregate
 * series (docs/private/opportunity-set.md) is a separate, clearly-labelled context layer
 * and must never be wired to the page-viewer.
 */
import { CATALOG } from "./intents/catalog";
import { execReadOnly } from "./db";
import { rowLimit, type AskRow, type IntentContext } from "./intents/types";

// Analytical intents never embed; a throwing stub makes that explicit (and keeps the
// dashboard free of any Bedrock dependency).
const ctx: IntentContext = {
  execReadOnly,
  embedQuery: async () => {
    throw new Error("dashboard charts are analytical; embeddings are never needed");
  },
  rowLimit: rowLimit(),
  // The research desk is the page-cited depth layer: 25 syndicates only.
  scope: "cited",
};

export type DashboardPayload = {
  ok: true;
  year: number;
  year_from: number;
  year_to: number;
  overview: AskRow | null;
  growers_improvers: AskRow[];
  rank_by_gwp: AskRow[];
  rank_by_combined_ratio: AskRow[];
};

export type DashboardOptions = {
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  limit?: number;
};

/**
 * Builds the full dashboard payload in one round-trip's worth of concurrent read-only
 * queries. Defaults: latest verified year (2023), prior-year comparison for the scatter.
 */
export async function buildDashboard(opts: DashboardOptions = {}): Promise<DashboardPayload> {
  const year = opts.year ?? 2023;
  const yearFrom = opts.yearFrom ?? year - 1;
  const yearTo = opts.yearTo ?? year;
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 50);

  const [overview, growers, byGwp, byCombinedRatio] = await Promise.all([
    CATALOG.market_overview.run({ year_of_account: year }, ctx),
    CATALOG.growers_improvers.run({ year_from: yearFrom, year_to: yearTo, limit }, ctx),
    CATALOG.rank_syndicates.run({ metric: "gwp", year_of_account: year, order: "desc", limit }, ctx),
    CATALOG.rank_syndicates.run({ metric: "combined_ratio", year_of_account: year, order: "asc", limit }, ctx),
  ]);

  return {
    ok: true,
    year,
    year_from: yearFrom,
    year_to: yearTo,
    overview: overview.rows[0] ?? null,
    growers_improvers: growers.rows,
    rank_by_gwp: byGwp.rows,
    rank_by_combined_ratio: byCombinedRatio.rows,
  };
}
