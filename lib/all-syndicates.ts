/**
 * Full-market syndicate summary layer (the dashboard's BREADTH data source).
 *
 * Reads the syndicate_summary table (132 syndicates x 2020-2025, native-currency
 * millions) on the read-only role. This is the wide-coverage path: every row carries
 * a `cited` flag that is true only when the syndicate has a verified syndicate_year
 * entry, so the frontend can tell reconciled figures from extracted-only ones.
 */
import { execReadOnly } from "./db";

export type SyndicateSummary = {
  syndicateNumber: number;
  managingAgent: string | null;
  yearOfAccount: number;
  currency: string | null;
  combinedRatio: number | null;
  nepNative: number | null;
  gwpNative: number | null;
  profitNative: number | null;
  totalAssetsNative: number | null;
  cited: boolean;
};

/** Loads every syndicate-year summary row, ordered by year then combined ratio (nulls last). */
export async function getAllSyndicates(): Promise<SyndicateSummary[]> {
  const rows = await execReadOnly({
    text: `
      SELECT syndicate_number, managing_agent, year_of_account, currency, combined_ratio,
             nep_native, gwp_native, profit_native, total_assets_native, cited
      FROM syndicate_summary
      ORDER BY year_of_account, combined_ratio NULLS LAST`,
    params: [],
  });

  return (rows as Array<Record<string, unknown>>).map((r) => ({
    syndicateNumber: Number(r.syndicate_number),
    managingAgent: r.managing_agent == null ? null : String(r.managing_agent),
    yearOfAccount: Number(r.year_of_account),
    currency: r.currency == null ? null : String(r.currency),
    combinedRatio: r.combined_ratio == null ? null : Number(r.combined_ratio),
    nepNative: r.nep_native == null ? null : Number(r.nep_native),
    gwpNative: r.gwp_native == null ? null : Number(r.gwp_native),
    profitNative: r.profit_native == null ? null : Number(r.profit_native),
    totalAssetsNative: r.total_assets_native == null ? null : Number(r.total_assets_native),
    cited: Boolean(r.cited),
  }));
}
