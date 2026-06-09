/**
 * Shared types + allowlists for the intent layer.
 *
 * SAFETY MODEL: the LLM only ever chooses an intent name + params. It never writes
 * SQL. Column choices (metric, sort direction, display currency) are constrained to
 * the allowlisted literals below, so even an identifier injected into a query template
 * comes from a fixed set; all values are bound as parameters.
 */

// Queryable metrics. combined_ratio is unitless (%); gwp/net_earned_premium are
// monetary and ranked on their GBP-normalised value, displayed in any currency.
export const METRICS = ["combined_ratio", "gwp", "net_earned_premium"] as const;
export type Metric = (typeof METRICS)[number];

// Currencies the UI can display in (native values converted via fx_rate).
export const CURRENCIES = ["GBP", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const LINES_OF_BUSINESS = [
  "Property",
  "Casualty",
  "Marine",
  "Aviation",
  "Energy",
  "Cyber",
  "Reinsurance",
  "Specialty",
] as const;

export const INTENT_NAMES = ["rank_syndicates", "trend", "narrative_search"] as const;
export type IntentName = (typeof INTENT_NAMES)[number];

/** A compiled analytical query: a fixed SQL template + bound params. */
export type SqlQuery = { text: string; params: unknown[] };

/** What the router returns; validated against the catalog before anything runs. */
export type RoutedQuery = { intent: IntentName; params: Record<string, unknown> };

export type Citation = {
  report_id: number;
  page_no: number | null;
  section?: string | null;
  source_url?: string | null;
  syndicate_number?: number | null;
};

export type AskRow = Record<string, unknown>;

/** Services an intent needs to run, injected so intents stay unit-testable. */
export type IntentContext = {
  execReadOnly: (q: SqlQuery) => Promise<Record<string, unknown>[]>;
  embedQuery: (text: string) => Promise<number[]>;
  rowLimit: number;
};

export type AskResult =
  | {
      ok: true;
      intent: IntentName;
      answer: string;
      rows: AskRow[];
      citations: Citation[];
    }
  | { ok: false; degraded: true; reason: string; suggestions: string[] };

/** Server-side, env-derived row cap. Never user input, so safe to interpolate. */
export function rowLimit(): number {
  const n = Number(process.env.QUERY_ROW_LIMIT ?? 200);
  return Math.max(1, Math.min(500, Number.isFinite(n) ? n : 200));
}
