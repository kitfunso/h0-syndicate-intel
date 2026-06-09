/**
 * Verifies the MACRO market_series layer against a loaded DB (READONLY_DATABASE_URL),
 * printing every series grouped for charts. Confirms the read-only role can SELECT it.
 *
 *   READONLY_DATABASE_URL=postgres://app_readonly:...@host/db npx tsx scripts/verify-macro.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { getMarketSeries } from "../lib/macro";

(async () => {
  const series = await getMarketSeries();
  for (const s of series) {
    console.log(`\n## ${s.series_key} — ${s.series_label}  [${s.chart_type}] (slide ${s.source_slide}, ${s.points.length} points)`);
    console.table(s.points);
  }
  console.log(`\n${series.length} market-context series loaded.`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
