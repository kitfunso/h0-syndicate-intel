import Link from "next/link";
import type { MacroSeries } from "@/lib/macro";
import { ColumnChart, StackedAreaChart, MultiLineChart } from "./macro-charts";

/** Homepage market-context teaser: two headline aggregates + the full research page link. */
export function MacroContext({ series }: { series: MacroSeries[] }) {
  const result = series.find((s) => s.series_key === "result_before_tax");
  const gwp = series.find((s) => s.series_key === "gwp_by_line");
  const pools = series.find((s) => s.series_key === "asset_pools");
  const cov = series.find((s) => s.series_key === "alm_coverage");
  if (!result && !gwp) return null;
  return (
    <section className="macro-sec">
      <h2 className="sec">Market context</h2>
      <p className="dek">
        Lloyd&apos;s market aggregates, 2016 to 2024. Context only: not syndicate-level, and not click-to-source.{" "}
        <Link href="/market" className="m-link">Full market research &rarr;</Link>
      </p>
      <div className="macro-grid">
        {result && (
          <figure className="macro-card">
            <figcaption>{result.series_label} (&pound;bn)</figcaption>
            <ColumnChart s={result} />
          </figure>
        )}
        {gwp && (
          <figure className="macro-card">
            <figcaption>{gwp.series_label} (&pound;bn)</figcaption>
            <StackedAreaChart s={gwp} />
          </figure>
        )}
        {pools && (
          <figure className="macro-card">
            <figcaption>Syndicate asset pools (&pound;bn)</figcaption>
            <MultiLineChart s={pools} order={["Syndicate financial investments", "Members' FAL", "Cash", "Members' balances", "Central reserves"]} />
          </figure>
        )}
        {cov && (
          <figure className="macro-card">
            <figcaption>Interest-rate coverage ratio (%)</figcaption>
            <MultiLineChart s={cov} />
          </figure>
        )}
      </div>
    </section>
  );
}
