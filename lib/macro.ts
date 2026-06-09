/**
 * MACRO market-context layer (the dashboard's second data source).
 *
 * Reads the market_series table (Lloyd's market aggregates, 2016-2024) on the read-only
 * role. This is CONTEXT data, returned grouped into chart-ready series. It is deliberately
 * separate from the per-syndicate (cited) path: a macro number is labelled market context
 * and is NEVER wired to the source-page viewer.
 */
import { execReadOnly } from "./db";

export type MacroPoint = { category: string; year: number; value: number; unit: string };
export type MacroSeries = {
  series_key: string;
  series_label: string;
  chart_type: string | null;
  source_slide: number | null;
  source_note: string | null;
  points: MacroPoint[];
};

/** Loads market-context series (optionally filtered to a list of keys), grouped for charts. */
export async function getMarketSeries(keys?: string[]): Promise<MacroSeries[]> {
  const filtered = keys && keys.length > 0;
  const rows = await execReadOnly({
    text: `
      SELECT series_key, series_label, chart_type, source_slide, source_note,
             category, year, value, unit
      FROM market_series
      ${filtered ? "WHERE series_key = ANY($1::text[])" : ""}
      ORDER BY series_key, category, year`,
    params: filtered ? [keys] : [],
  });

  const byKey = new Map<string, MacroSeries>();
  for (const r of rows as Array<Record<string, unknown>>) {
    const key = String(r.series_key);
    let s = byKey.get(key);
    if (!s) {
      s = {
        series_key: key,
        series_label: String(r.series_label),
        chart_type: r.chart_type == null ? null : String(r.chart_type),
        source_slide: r.source_slide == null ? null : Number(r.source_slide),
        source_note: r.source_note == null ? null : String(r.source_note),
        points: [],
      };
      byKey.set(key, s);
    }
    s.points.push({
      category: String(r.category ?? ""),
      year: Number(r.year),
      value: Number(r.value),
      unit: String(r.unit),
    });
  }
  return [...byKey.values()];
}
