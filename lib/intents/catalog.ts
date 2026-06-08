/**
 * The intent catalog: the ONLY queries that can run. Each entry pairs a zod param
 * schema (the validator) with a `run` that builds a FIXED, parameterized SQL
 * template (identifiers from allowlists, values bound) and maps rows to citations.
 *
 * Spike scope = 3 intents (rank / trend / narrative_search). Days 4-7 add the rest
 * (compare, lob_breakdown, peer_percentile, growers_improvers, explain_change, ...).
 */
import { z } from "zod";
import {
  METRICS,
  LINES_OF_BUSINESS,
  type Citation,
  type IntentContext,
  type IntentName,
  type AskRow,
} from "./types";

export type IntentDef = {
  name: IntentName;
  description: string; // shown to the router so it can pick correctly
  paramsHint: string; // human description of params for the router prompt
  schema: z.ZodTypeAny;
  run: (params: any, ctx: IntentContext) => Promise<{ rows: AskRow[]; citations: Citation[] }>;
};

const metricEnum = z.enum(METRICS);
const lobEnum = z.enum(LINES_OF_BUSINESS);

function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

// ---- rank_syndicates ------------------------------------------------------
const rankSchema = z.object({
  metric: metricEnum,
  year_of_account: z.number().int().gte(1990).lte(2030),
  order: z.enum(["asc", "desc"]).default("desc"),
  limit: z.number().int().gte(1).lte(100).optional(),
});

const rank: IntentDef = {
  name: "rank_syndicates",
  description: "League table: rank syndicates by a single metric for one year of account.",
  paramsHint: `{ metric: one of ${METRICS.join("|")}, year_of_account: int, order: "asc"|"desc", limit?: int }`,
  schema: rankSchema,
  run: async (p: z.infer<typeof rankSchema>, ctx) => {
    const metric = p.metric; // allowlisted literal -> safe identifier
    const dir = p.order === "asc" ? "ASC" : "DESC";
    const cap = Math.min(p.limit ?? ctx.rowLimit, ctx.rowLimit);
    const rows = await ctx.execReadOnly({
      text: `
        SELECT s.syndicate_number, s.name, sy.year_of_account,
               sy.${metric} AS value, sy.source_report_id, sy.source_page, sy.verified
        FROM syndicate_year sy
        JOIN syndicate s USING (syndicate_number)
        WHERE sy.year_of_account = $1 AND sy.${metric} IS NOT NULL
        ORDER BY sy.${metric} ${dir}
        LIMIT ${cap}`,
      params: [p.year_of_account],
    });
    return {
      rows,
      citations: rows.map((r) => ({
        report_id: Number(r.source_report_id),
        page_no: r.source_page == null ? null : Number(r.source_page),
        syndicate_number: Number(r.syndicate_number),
      })),
    };
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
  paramsHint: `{ syndicate_number: int, metric: one of ${METRICS.join("|")}, year_from: int, year_to: int }`,
  schema: trendSchema,
  run: async (p: z.infer<typeof trendSchema>, ctx) => {
    const metric = p.metric;
    const rows = await ctx.execReadOnly({
      text: `
        SELECT year_of_account, ${metric} AS value, source_report_id, source_page, verified
        FROM syndicate_year
        WHERE syndicate_number = $1 AND year_of_account BETWEEN $2 AND $3
        ORDER BY year_of_account`,
      params: [p.syndicate_number, p.year_from, p.year_to],
    });
    return {
      rows,
      citations: rows.map((r) => ({
        report_id: Number(r.source_report_id),
        page_no: r.source_page == null ? null : Number(r.source_page),
        syndicate_number: p.syndicate_number,
      })),
    };
  },
};

// ---- narrative_search (the qualitative pillar) ----------------------------
const narrativeSchema = z.object({
  topic: z.string().min(2).max(400),
  keyword: z.string().max(80).optional(), // anchors retrieval, beats boilerplate
  syndicate_number: z.number().int().optional(),
  k: z.number().int().gte(1).lte(20).optional(),
});

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
