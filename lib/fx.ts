/**
 * Display-currency conversion for the dashboard's currency toggle. Figures rank and
 * store in GBP (gwp_gbp); the toggle re-bases the COMPARABLE displays into GBP/USD/EUR.
 * fx_rate stores target -> GBP, so the GBP -> target multiplier is 1 / rate_to_gbp.
 * Native (as-filed) values are shown unchanged in the peek + source viewer for citation.
 */
import { execReadOnly } from "./db";

export const DISPLAY_CURRENCIES = ["GBP", "USD", "EUR"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];
export const CURRENCY_SYMBOL: Record<DisplayCurrency, string> = { GBP: "£", USD: "$", EUR: "€" };

/** GBP -> target multiplier for the year. GBP = 1; falls back to 1 if no rate is seeded. */
export async function getDisplayRate(ccy: DisplayCurrency, year: number): Promise<number> {
  if (ccy === "GBP") return 1;
  const rows = await execReadOnly({
    text: `SELECT rate_to_gbp FROM fx_rate WHERE currency = $1 AND year_of_account = $2 LIMIT 1`,
    params: [ccy, year],
  });
  const toGbp = rows[0]?.rate_to_gbp == null ? null : Number(rows[0].rate_to_gbp);
  return toGbp && toGbp > 0 ? 1 / toGbp : 1;
}
