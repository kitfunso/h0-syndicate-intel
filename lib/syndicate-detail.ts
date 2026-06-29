/**
 * Per-syndicate detail layer (the dashboard's DRILL-DOWN data source).
 *
 * Reads the syndicate_detail table (11,613 rows, native-currency millions) on the
 * read-only role, filtered to a single syndicate. This is the long/tidy companion to
 * the syndicate_summary breadth layer: one row per (year, dataset, segment, metric),
 * which the syndicate page groups into chart-ready series (one MacroSeries per
 * dataset+metric, points = { category: segment, year, value }).
 */
import { execReadOnly } from "./db";

export type SyndicateDetailRow = {
  syndicateNumber: number;
  yearOfAccount: number;
  dataset: string;
  segment: string;
  metric: string;
  value: number | null;
  currency: string | null;
};

/** Loads every detail row for one syndicate, ordered by dataset, year, then segment. */
export async function getSyndicateDetail(syn: number): Promise<SyndicateDetailRow[]> {
  const rows = await execReadOnly({
    text: `
      SELECT syndicate_number, year_of_account, dataset, segment, metric, value, currency
      FROM syndicate_detail
      WHERE syndicate_number = $1
      ORDER BY dataset, year_of_account, segment`,
    params: [syn],
  });

  return (rows as Array<Record<string, unknown>>).map((r) => ({
    syndicateNumber: Number(r.syndicate_number),
    yearOfAccount: Number(r.year_of_account),
    dataset: String(r.dataset),
    segment: String(r.segment),
    metric: String(r.metric),
    value: r.value == null ? null : Number(r.value),
    currency: r.currency == null ? null : String(r.currency),
  }));
}
