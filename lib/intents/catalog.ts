/**
 * The intent catalog: the ONLY queries that can run. Each entry pairs a zod param
 * schema (the validator) with a `run` that builds a FIXED, parameterized SQL template
 * (identifiers from allowlists, values bound) and maps rows to citations.
 *
 * Monetary metrics rank on their GBP-normalised value (gwp_gbp / nep_gbp) but return
 * the NATIVE value + currency + page too, so the UI shows the figure exactly as the
 * PDF prints it (with a currency badge) and a clicked number always matches the source.
 */
import { z } from "zod";
import {
  METRICS,
  type Metric,
  type Citation,
  type IntentContext,
  type IntentName,
  type AskRow,
} from "./types";

export type IntentDef = {
  name: IntentName;
  description: string;
  paramsHint: string;
  schema: z.ZodTypeAny;
  run: (params: any, ctx: IntentContext) => Promise<{ rows: AskRow[]; citations: Citation[] }>;
};

const metricEnum = z.enum(METRICS);

// Maps an allowlisted metric to fixed column expressions (alias `sy`). Safe to
// interpolate: the value is validated to one of METRICS, never raw user text.
function metricSql(metric: Metric): { value: string; native: string; page: string; dir: "ASC" | "DESC" } {
  switch (metric) {
    case "combined_ratio":
      return { value: "sy.combined_ratio", native: "NULL::numeric", page: "sy.combined_ratio_page", dir: "ASC" };
    case "gwp":
      return { value: "sy.gwp_gbp", native: "sy.gwp_native", page: "sy.gwp_page", dir: "DESC" };
    case "net_earned_premium":
      return { value: "sy.nep_gbp", native: "sy.nep_native", page: "sy.nep_page", dir: "DESC" };
  }
}

function toCitations(rows: AskRow[], synKey = "syndicate_number"): Citation[] {
  return rows.map((r) => ({
    report_id: r.source_report_id == null ? 0 : Number(r.source_report_id),
    page_no: r.source_page == null ? null : Number(r.source_page),
    syndicate_number: r[synKey] == null ? null : Number(r[synKey]),
  }));
}

function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

// ---- rank_syndicates ------------------------------------------------------
const rankSchema = z.object({
  metric: metricEnum,
  year_of_account: z.number().int().gte(1990).lte(2030),
  order: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().gte(1).lte(100).optional(),
});
const rank: IntentDef = {
  name: "rank_syndicates",
  description:
    "League table: rank syndicates by a metric for one year. combined_ratio asc = best underwriters; gwp/net_earned_premium desc = largest. Monetary metrics are GBP-normalised.",
  paramsHint: `{ metric: ${METRICS.join("|")}, year_of_account: int, order?: "asc"|"desc", limit?: int }`,
  schema: rankSchema,
  run: async (p: z.infer<typeof rankSchema>, ctx) => {
    const m = metricSql(p.metric);
    const dir = p.order ? (p.order === "asc" ? "ASC" : "DESC") : m.dir;
    const cap = Math.min(p.limit ?? ctx.rowLimit, ctx.rowLimit);
    const rows = await ctx.execReadOnly({
      text: `
        SELECT s.syndicate_number, s.name, sy.year_of_account, sy.currency,
               ${m.value} AS value_gbp, ${m.native} AS value_native,
               ${m.page} AS source_page, sy.source_report_id, sy.verified
        FROM syndicate_year sy JOIN syndicate s USING (syndicate_number)
        WHERE sy.year_of_account = $1 AND ${m.value} IS NOT NULL
        ORDER BY ${m.value} ${dir} LIMIT ${cap}`,
      params: [p.year_of_account],
    });
    return { rows, citations: toCitations(rows) };
  },
};

// ---- trend ----------------------------------------------------------------
const trendSchema = z.object({
  syndicate_number: z.number().int(),
  metric: metricEnum,
  year_from: z.number().int().gte(1990).lte(2030),
  year_to: z.number().int().gte(1990).lte(2030),
});
const trend: IntentDef = {
  name: "trend",
  description: "Time series of one metric for one syndicate across a year range.",
  paramsHint: `{ syndicate_number: int, metric: ${METRICS.join("|")}, year_from: int, year_to: int }`,
  schema: trendSchema,
  run: async (p: z.infer<typeof trendSchema>, ctx) => {
    const m = metricSql(p.metric);
    const rows = await ctx.execReadOnly({
      text: `
        SELECT sy.syndicate_number, sy.year_of_account, sy.currency,
               ${m.value} AS value_gbp, ${m.native} AS value_native,
               ${m.page} AS source_page, sy.source_report_id, sy.verified
        FROM syndicate_year sy
        WHERE sy.syndicate_number = $1 AND sy.year_of_account BETWEEN $2 AND $3 AND ${m.value} IS NOT NULL
        ORDER BY sy.year_of_account`,
      params: [p.syndicate_number, p.year_from, p.year_to],
    });
    return { rows, citations: toCitations(rows) };
  },
};

// ---- compare --------------------------------------------------------------
const compareSchema = z.object({
  syndicate_numbers: z.array(z.number().int()).min(2).max(8),
  year_of_account: z.number().int().gte(1990).lte(2030),
});
const compare: IntentDef = {
  name: "compare",
  description: "Side-by-side comparison of named syndicates across all metrics for one year.",
  paramsHint: `{ syndicate_numbers: int[2..8], year_of_account: int }`,
  schema: compareSchema,
  run: async (p: z.infer<typeof compareSchema>, ctx) => {
    const rows = await ctx.execReadOnly({
      text: `
        SELECT s.syndicate_number, s.name, sy.currency, sy.combined_ratio,
               sy.gwp_native, sy.gwp_gbp, sy.nep_native, sy.nep_gbp,
               sy.combined_ratio_page AS source_page, sy.source_report_id, sy.verified
        FROM syndicate_year sy JOIN syndicate s USING (syndicate_number)
        WHERE sy.syndicate_number = ANY($1::int[]) AND sy.year_of_account = $2
        ORDER BY sy.combined_ratio ASC NULLS LAST`,
      params: [p.syndicate_numbers, p.year_of_account],
    });
    return { rows, citations: toCitations(rows) };
  },
};

// ---- growers_improvers (the hero combo query) -----------------------------
const growersSchema = z.object({
  year_from: z.number().int().gte(1990).lte(2030),
  year_to: z.number().int().gte(1990).lte(2030),
  limit: z.number().int().gte(1).lte(100).optional(),
});
const growers: IntentDef = {
  name: "growers_improvers",
  description:
    "Syndicates that grew gross premium AND improved (lowered) their combined ratio between two years. The flagship cross-metric query.",
  paramsHint: `{ year_from: int, year_to: int, limit?: int }`,
  schema: growersSchema,
  run: async (p: z.infer<typeof growersSchema>, ctx) => {
    const cap = Math.min(p.limit ?? ctx.rowLimit, ctx.rowLimit);
    const rows = await ctx.execReadOnly({
      text: `
        SELECT s.syndicate_number, s.name, b.currency,
               a.combined_ratio AS combined_ratio_from, b.combined_ratio AS combined_ratio_to,
               a.combined_ratio - b.combined_ratio AS combined_ratio_improvement,
               a.gwp_gbp AS gwp_gbp_from, b.gwp_gbp AS gwp_gbp_to,
               b.gwp_native, b.gwp_gbp - a.gwp_gbp AS gwp_gbp_growth,
               (b.gwp_gbp - a.gwp_gbp) / NULLIF(a.gwp_gbp, 0) AS gwp_growth_pct,
               b.gwp_page AS source_page, b.source_report_id, b.verified
        FROM syndicate_year a
        JOIN syndicate_year b ON a.syndicate_number = b.syndicate_number
        JOIN syndicate s ON s.syndicate_number = a.syndicate_number
        WHERE a.year_of_account = $1 AND b.year_of_account = $2
          AND a.gwp_gbp IS NOT NULL AND b.gwp_gbp IS NOT NULL
          AND a.combined_ratio IS NOT NULL AND b.combined_ratio IS NOT NULL
          -- like-for-like only: an "improvement" vs a differently-adjusted prior-year
          -- ratio (e.g. an excluding-LPT 2022 basis) is an artifact, not a comparison
          AND a.combined_ratio_adjusted = b.combined_ratio_adjusted
          AND b.gwp_gbp > a.gwp_gbp AND b.combined_ratio < a.combined_ratio
        ORDER BY (b.gwp_gbp - a.gwp_gbp) DESC LIMIT ${cap}`,
      params: [p.year_from, p.year_to],
    });
    return { rows, citations: toCitations(rows) };
  },
};

// ---- peer_percentile ------------------------------------------------------
const peerSchema = z.object({
  syndicate_number: z.number().int(),
  metric: z.enum(["combined_ratio", "gwp"]),
  year_of_account: z.number().int().gte(1990).lte(2030),
});
const peer: IntentDef = {
  name: "peer_percentile",
  description: "Where a syndicate ranks vs all peers on a metric for a year (percentile).",
  paramsHint: `{ syndicate_number: int, metric: "combined_ratio"|"gwp", year_of_account: int }`,
  schema: peerSchema,
  run: async (p: z.infer<typeof peerSchema>, ctx) => {
    const rows = await ctx.execReadOnly({
      text: `
        SELECT pp.syndicate_number, s.name, pp.year_of_account,
               pp.combined_ratio, pp.combined_ratio_pctile, pp.gwp_gbp, pp.gwp_pctile,
               sy.combined_ratio_page AS source_page, sy.source_report_id, sy.verified
        FROM mv_peer_percentiles pp
        JOIN syndicate s USING (syndicate_number)
        JOIN syndicate_year sy ON sy.syndicate_number = pp.syndicate_number
          AND sy.year_of_account = pp.year_of_account
        WHERE pp.syndicate_number = $1 AND pp.year_of_account = $2`,
      params: [p.syndicate_number, p.year_of_account],
    });
    return { rows, citations: toCitations(rows) };
  },
};

// ---- market_overview ------------------------------------------------------
const marketSchema = z.object({ year_of_account: z.number().int().gte(1990).lte(2030) });
const market: IntentDef = {
  name: "market_overview",
  description: "Aggregate market stats for a year: syndicate count, average/median combined ratio, total GBP gross premium.",
  paramsHint: `{ year_of_account: int }`,
  schema: marketSchema,
  run: async (p: z.infer<typeof marketSchema>, ctx) => {
    const rows = await ctx.execReadOnly({
      text: `
        SELECT $1::int AS year_of_account,
               count(*) FILTER (WHERE combined_ratio IS NOT NULL) AS n_combined_ratio,
               round(avg(combined_ratio)::numeric, 1) AS avg_combined_ratio,
               round((percentile_cont(0.5) WITHIN GROUP (ORDER BY combined_ratio))::numeric, 1) AS median_combined_ratio,
               round(sum(gwp_gbp)::numeric, 1) AS total_gwp_gbp
        FROM syndicate_year WHERE year_of_account = $1`,
      params: [p.year_of_account],
    });
    return { rows, citations: [] };
  },
};

// ---- explain_change (structured delta + scoped narrative; the fusion intent) ----
const explainSchema = z.object({
  syndicate_number: z.number().int(),
  metric: metricEnum,
  year_from: z.number().int().gte(1990).lte(2030),
  year_to: z.number().int().gte(1990).lte(2030),
  topic: z.string().max(200).optional(),
});
const explain: IntentDef = {
  name: "explain_change",
  description:
    "Explain why a syndicate's metric moved between two years: the structured delta PLUS the most relevant narrative passages from its report, cited.",
  paramsHint: `{ syndicate_number: int, metric: ${METRICS.join("|")}, year_from: int, year_to: int, topic?: string }`,
  schema: explainSchema,
  run: async (p: z.infer<typeof explainSchema>, ctx) => {
    const m = metricSql(p.metric);
    const deltaRows = await ctx.execReadOnly({
      text: `
        SELECT sy.syndicate_number, sy.year_of_account, sy.currency,
               ${m.value} AS value_gbp, ${m.native} AS value_native,
               ${m.page} AS source_page, sy.source_report_id, sy.verified
        FROM syndicate_year sy
        WHERE sy.syndicate_number = $1 AND sy.year_of_account IN ($2, $3)
        ORDER BY sy.year_of_account`,
      params: [p.syndicate_number, p.year_from, p.year_to],
    });
    const probe = p.topic ?? `drivers of ${p.metric} change underwriting result`;
    const vec = toVectorLiteral(await ctx.embedQuery(probe));
    const narrativeRows = await ctx.execReadOnly({
      text: `
        SELECT rc.report_id, rc.page_no, rc.section, rc.text, r.syndicate_number, r.source_url,
               1 - (rc.embedding <=> $1::vector) AS score
        FROM report_chunk rc JOIN report r ON r.id = rc.report_id
        WHERE r.syndicate_number = $2
        ORDER BY rc.embedding <=> $1::vector LIMIT 4`,
      params: [vec, p.syndicate_number],
    });
    const rows: AskRow[] = [
      ...deltaRows.map((r) => ({ _kind: "metric", ...r })),
      ...narrativeRows.map((r) => ({ _kind: "narrative", ...r })),
    ];
    const citations: Citation[] = [
      ...toCitations(deltaRows),
      ...narrativeRows.map((r) => ({
        report_id: Number(r.report_id),
        page_no: r.page_no == null ? null : Number(r.page_no),
        section: (r.section as string) ?? null,
        source_url: (r.source_url as string) ?? null,
        syndicate_number: r.syndicate_number == null ? null : Number(r.syndicate_number),
      })),
    ];
    return { rows, citations };
  },
};

// ---- narrative_search (the qualitative pillar) ----------------------------
const narrativeSchema = z.object({
  topic: z.string().min(2).max(400),
  keyword: z.string().max(80).optional(),
  syndicate_number: z.number().int().optional(),
  k: z.number().int().gte(1).lte(20).optional(),
});
const narrative: IntentDef = {
  name: "narrative_search",
  description: "Semantic search over report narrative for qualitative questions (why/what are syndicates saying).",
  paramsHint: `{ topic: string, keyword?: string, syndicate_number?: int, k?: int }`,
  schema: narrativeSchema,
  run: async (p: z.infer<typeof narrativeSchema>, ctx) => {
    const vec = toVectorLiteral(await ctx.embedQuery(p.keyword ? `${p.topic} ${p.keyword}` : p.topic));
    const k = Math.min(p.k ?? 8, 20);
    const params: unknown[] = [vec];
    const where: string[] = [];
    if (p.syndicate_number != null) {
      params.push(p.syndicate_number);
      where.push(`r.syndicate_number = $${params.length}`);
    }
    if (p.keyword) {
      params.push(p.keyword);
      where.push(`rc.tsv @@ plainto_tsquery('english', $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await ctx.execReadOnly({
      text: `
        SELECT rc.report_id, rc.page_no, rc.section, rc.text, r.syndicate_number, r.source_url,
               1 - (rc.embedding <=> $1::vector) AS score
        FROM report_chunk rc JOIN report r ON r.id = rc.report_id
        ${whereSql}
        ORDER BY rc.embedding <=> $1::vector LIMIT ${k}`,
      params,
    });
    return {
      rows,
      citations: rows.map((r) => ({
        report_id: Number(r.report_id),
        page_no: r.page_no == null ? null : Number(r.page_no),
        section: (r.section as string) ?? null,
        source_url: (r.source_url as string) ?? null,
        syndicate_number: r.syndicate_number == null ? null : Number(r.syndicate_number),
      })),
    };
  },
};

export const CATALOG: Record<IntentName, IntentDef> = {
  rank_syndicates: rank,
  trend,
  compare,
  growers_improvers: growers,
  peer_percentile: peer,
  market_overview: market,
  explain_change: explain,
  narrative_search: narrative,
};

/** Compact description of every intent, injected into the router prompt. */
export function catalogPromptSpec(): string {
  return Object.values(CATALOG)
    .map((d) => `- ${d.name}: ${d.description}\n    params: ${d.paramsHint}`)
    .join("\n");
}
