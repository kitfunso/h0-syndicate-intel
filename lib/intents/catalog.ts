/**
 * The intent catalog: the ONLY queries that can run. Each entry pairs a zod param
 * schema (the validator) with a `run` that builds a FIXED, parameterized SQL template
 * (identifiers from allowlists, values bound) and maps rows to citations.
 *
 * Monetary metrics rank on their GBP-normalised value (gwp_gbp / nep_gbp) but return
 * the NATIVE value + currency + page too, so the UI shows the figure exactly as the
 * PDF prints it (with a currency badge) and a clicked number always matches the source.
 *
 * Spike scope = 3 intents. Days 4-7 add compare / lob_breakdown / peer_percentile /
 * growers_improvers / explain_change.
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
function metricSql(metric: Metric): {
  value: string;
  native: string;
  page: string;
  dir: "ASC" | "DESC";
} {
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
    report_id: Number(r.source_report_id),
    page_no: r.source_page == null ? null : Number(r.source_page),
    syndicate_number: r[synKey] == null ? null : Number(r[synKey]),
  }));
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
        FROM syndicate_year sy
        JOIN syndicate s USING (syndicate_number)
        WHERE sy.year_of_account = $1 AND ${m.value} IS NOT NULL
        ORDER BY ${m.value} ${dir}
        LIMIT ${cap}`,
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
        WHERE sy.syndicate_number = $1 AND sy.year_of_account BETWEEN $2 AND $3
          AND ${m.value} IS NOT NULL
        ORDER BY sy.year_of_account`,
      params: [p.syndicate_number, p.year_from, p.year_to],
    });
    return { rows, citations: toCitations(rows) };
  },
};

// ---- narrative_search (the qualitative pillar) ----------------------------
const narrativeSchema = z.object({
  topic: z.string().min(2).max(400),
  keyword: z.string().max(80).optional(),
  syndicate_number: z.number().int().optional(),
  k: z.number().int().gte(1).lte(20).optional(),
});

function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

const narrative: IntentDef = {
  name: "narrative_search",
  description:
    "Semantic search over report narrative for qualitative questions (why/what are syndicates saying).",
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
        SELECT rc.report_id, rc.page_no, rc.section, rc.text,
               r.syndicate_number, r.source_url,
               1 - (rc.embedding <=> $1::vector) AS score
        FROM report_chunk rc
        JOIN report r ON r.id = rc.report_id
        ${whereSql}
        ORDER BY rc.embedding <=> $1::vector
        LIMIT ${k}`,
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
  narrative_search: narrative,
};

/** Compact description of every intent, injected into the router prompt. */
export function catalogPromptSpec(): string {
  return Object.values(CATALOG)
    .map((d) => `- ${d.name}: ${d.description}\n    params: ${d.paramsHint}`)
    .join("\n");
}
