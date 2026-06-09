/**
 * Verifies the dashboard data layer against a loaded DB (READONLY_DATABASE_URL), printing
 * every chart's rows. No Bedrock needed — these are pure analytical intents.
 *
 *   READONLY_DATABASE_URL=postgres://app_readonly:...@host/db npx tsx scripts/verify-dashboard.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { buildDashboard } from "../lib/dashboard";

(async () => {
  const d = await buildDashboard({ year: 2023, yearFrom: 2022, yearTo: 2023, limit: 12 });
  console.log(`\n## market_overview (tiles) — year ${d.year}`);
  console.table([d.overview]);
  console.log(`\n## growers_improvers (hero scatter) — ${d.year_from} -> ${d.year_to}`);
  console.table(d.growers_improvers);
  console.log(`\n## rank_by_gwp (bar)`);
  console.table(d.rank_by_gwp);
  console.log(`\n## rank_by_combined_ratio (bar, best first)`);
  console.table(d.rank_by_combined_ratio);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
