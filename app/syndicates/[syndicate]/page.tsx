import Link from "next/link";
import { notFound } from "next/navigation";
import { getSyndicateDetail, type SyndicateDetailRow } from "@/lib/syndicate-detail";
import { getAllSyndicates, type SyndicateSummary } from "@/lib/all-syndicates";
import { shortName } from "@/lib/short-name";
import type { MacroSeries } from "@/lib/macro";
import {
  ColumnChart,
  StackedAreaChart,
  MultiLineChart,
  StackedColumns,
  SeriesTable,
} from "../../components/macro-charts";

// pg runs server-side; read the DB per request, not at build time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The per-SYNDICATE profile page: one syndicate's extracted detail, drawn with the same
 * editorial chart primitives as the market research page. Underwriting (GWP + result by
 * business line), the asset fair-value hierarchy and fixed-income credit quality come from
 * syndicate_detail; the combined-ratio and premium trend come from the syndicate_summary
 * rows. Every figure is an extracted number in the syndicate's native reporting currency;
 * each chart section is skipped entirely when that dataset has no rows for this syndicate.
 */

const SYM: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };

// "£m" / "$m" / "m" when the currency is unknown. Unit label for a card title.
function unit(ccy: string | null): string {
  const s = ccy ? SYM[ccy] ?? "" : "";
  return s ? `${s}m` : "m";
}

// KPI tile money, native currency, losses in parentheses: "$1,376m", "(£45m)".
function money(v: number, ccy: string | null): string {
  const sym = ccy ? SYM[ccy] ?? "" : "";
  const abs = Math.abs(v);
  // Sub-million premiums keep one decimal ("$0.2m") rather than rounding to "$0m".
  const a = abs > 0 && abs < 1 ? abs.toFixed(1) : Math.round(abs).toLocaleString("en-GB");
  return v < 0 ? `(${sym}${a}m)` : `${sym}${a}m`;
}

// First non-null currency in a set of detail rows (a dataset can be filed in its own ccy).
function ccyOf(rows: SyndicateDetailRow[]): string | null {
  return rows.find((r) => r.currency != null)?.currency ?? null;
}

// Group detail rows of one dataset+metric into a chart-ready MacroSeries (category = segment).
// MacroPoint.unit is required by the type but unused by the primitives; it stays a plain tag.
function detailSeries(
  rows: SyndicateDetailRow[],
  metric: string,
  key: string,
  label: string,
  unitTag: string,
): MacroSeries {
  const points = rows
    .filter((r) => r.metric === metric && r.value != null)
    .map((r) => ({ category: r.segment, year: r.yearOfAccount, value: r.value as number, unit: unitTag }));
  return { series_key: key, series_label: label, chart_type: null, source_slide: null, source_note: null, points };
}

// One '' -category MacroSeries from the summary rows (combined ratio / NEP over the years).
function summarySeries(
  rows: SyndicateSummary[],
  pick: (r: SyndicateSummary) => number | null,
  key: string,
  label: string,
  unitTag: string,
): MacroSeries {
  const points = rows
    .filter((r) => pick(r) != null)
    .map((r) => ({ category: "", year: r.yearOfAccount, value: pick(r) as number, unit: unitTag }));
  return { series_key: key, series_label: label, chart_type: null, source_slide: null, source_note: null, points };
}

// The latest reported value of one metric, with its year and currency (latest available, honest year).
function latestKpi(
  rows: SyndicateSummary[],
  pick: (r: SyndicateSummary) => number | null,
): { value: number; year: number; currency: string | null } | null {
  const r = rows
    .filter((x) => pick(x) != null)
    .sort((a, b) => b.yearOfAccount - a.yearOfAccount)[0];
  return r ? { value: pick(r) as number, year: r.yearOfAccount, currency: r.currency } : null;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <figure className="macro-card">
      <figcaption>{title}</figcaption>
      {children}
    </figure>
  );
}

const FV_ORDER = ["Level 1", "Level 2", "Level 3"];
const CQ_ORDER = ["AAA", "AA", "A", "BBB", "Below IG / NR"];

export default async function SyndicatePage({ params }: { params: Promise<{ syndicate: string }> }) {
  const { syndicate } = await params;
  const syn = Number.parseInt(syndicate, 10);
  if (Number.isNaN(syn)) notFound();

  const [detail, all] = await Promise.all([getSyndicateDetail(syn), getAllSyndicates()]);
  const summary = all.filter((r) => r.syndicateNumber === syn);
  if (detail.length === 0 && summary.length === 0) notFound();

  // Header facts: latest managing-agent name, reporting currency, the years on record.
  const summaryByYearDesc = [...summary].sort((a, b) => b.yearOfAccount - a.yearOfAccount);
  const agentFull = summaryByYearDesc.find((r) => r.managingAgent)?.managingAgent ?? null;
  const short = agentFull ? shortName(agentFull) : null;
  const synCcy = summaryByYearDesc.find((r) => r.currency != null)?.currency ?? ccyOf(detail);
  const citedAny = summary.some((r) => r.cited);
  const citedTotal = new Set(all.filter((r) => r.cited).map((r) => r.syndicateNumber)).size;

  const years = Array.from(
    new Set([...detail.map((r) => r.yearOfAccount), ...summary.map((r) => r.yearOfAccount)]),
  ).sort((a, b) => a - b);
  const yrMin = years[0];
  const yrMax = years[years.length - 1];

  // KPI tiles: the latest reported combined ratio, net earned premium and result.
  const crLatest = latestKpi(summary, (r) => r.combinedRatio);
  const nepLatest = latestKpi(summary, (r) => r.nepNative);
  const profitLatest = latestKpi(summary, (r) => r.profitNative);

  // Detail series, grouped per dataset.
  const uw = detail.filter((r) => r.dataset === "underwriting");
  const fv = detail.filter((r) => r.dataset === "fair_value");
  const cq = detail.filter((r) => r.dataset === "credit_quality");

  const gwp = detailSeries(uw, "gwp", "uw_gwp", `Syndicate ${syn} gross written premium by business line`, "m");
  const uwResult = detailSeries(uw, "result", "uw_result", `Syndicate ${syn} underwriting result by business line`, "m");
  const fvSeries = detailSeries(fv, "amount", "fv", `Syndicate ${syn} financial investments by fair-value level`, "m");
  const cqSeries = detailSeries(cq, "amount", "cq", `Syndicate ${syn} fixed-income credit quality`, "m");
  const crSeries = summarySeries(summary, (r) => r.combinedRatio, "cr", `Syndicate ${syn} combined ratio`, "pct");
  const nepSeries = summarySeries(summary, (r) => r.nepNative, "nep", `Syndicate ${syn} net earned premium`, "m");

  const title = short ? `${short} · Syndicate ${syn}` : `Syndicate ${syn}`;

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <h1>{title}</h1>
          <div className="kicker">
            {agentFull ? <>{agentFull}. </> : null}
            Years of account {yrMin} to {yrMax}, extracted from the annual reports.{" "}
            {citedAny ? (
              <>Page-cited on the <Link href="/" className="m-link">research desk</Link>. </>
            ) : null}
            <Link href="/syndicates" className="m-link">&larr; All syndicates</Link>
            {" · "}
            <Link href="/" className="m-link">Research desk</Link>
          </div>
        </div>
        <div className="issue">
          Syndicate {syn} profile<br />
          <span className="on">{yrMin}-{yrMax}</span> · {synCcy ?? "native ccy"}<br />
          {citedAny ? "page-cited on the research desk" : "extracted figures"}
        </div>
      </header>

      <div className="tiles kpi-band">
        <div className="tile">
          <div className="k">Latest combined ratio</div>
          <div className="v">{crLatest ? crLatest.value.toFixed(1) : "n/a"}</div>
          <div className="d">{crLatest ? `Year of account ${crLatest.year}` : "not reported"}</div>
        </div>
        <div className="tile">
          <div className="k">Latest net earned premium</div>
          <div className="v">{nepLatest ? money(nepLatest.value, nepLatest.currency) : "n/a"}</div>
          <div className="d">{nepLatest ? `Year of account ${nepLatest.year}` : "not reported"}</div>
        </div>
        <div className="tile">
          <div className="k">Latest result</div>
          <div className="v">{profitLatest ? money(profitLatest.value, profitLatest.currency) : "n/a"}</div>
          <div className="d">{profitLatest ? `Year of account ${profitLatest.year}` : "not reported"}</div>
        </div>
      </div>

      {(gwp.points.length > 0 || uwResult.points.length > 0) && (
        <section className="m-sec">
          <h2 className="sec">Underwriting by business line</h2>
          <p className="dek">
            Premium and the underwriting result split by the business lines this syndicate reports, in its native
            reporting currency. Lines are shown as filed, including any subtotal rows in the accounts.
          </p>
          <div className="macro-grid">
            {gwp.points.length > 0 && (
              <Card title={`Gross written premium by business line (${unit(ccyOf(uw))})`}>
                <StackedAreaChart s={gwp} />
              </Card>
            )}
            {uwResult.points.length > 0 && (
              <Card title={`Underwriting result by business line (${unit(ccyOf(uw))})`}>
                <SeriesTable s={uwResult} />
              </Card>
            )}
          </div>
        </section>
      )}

      {fvSeries.points.length > 0 && (
        <section className="m-sec">
          <h2 className="sec">Asset fair-value hierarchy</h2>
          <p className="dek">
            Financial investments by IFRS fair-value level: Level 1 (quoted prices), Level 2 (observable inputs),
            Level 3 (unobservable inputs). A read on how hard-to-value the asset book is.
          </p>
          <div className="macro-grid">
            <Card title={`Financial investments by fair-value level (${unit(ccyOf(fv))})`}>
              <StackedColumns s={fvSeries} order={FV_ORDER} />
            </Card>
            <div />
          </div>
        </section>
      )}

      {cqSeries.points.length > 0 && (
        <section className="m-sec">
          <h2 className="sec">Fixed-income credit quality</h2>
          <p className="dek">
            Rated fixed-income holdings by credit bucket, normalised to 100% each year so the mix is comparable
            across years regardless of how the book grew.
          </p>
          <div className="macro-grid">
            <Card title="Fixed-income credit quality (% of rated holdings)">
              <StackedColumns s={cqSeries} percent100 order={CQ_ORDER} />
            </Card>
            <div />
          </div>
        </section>
      )}

      {(crSeries.points.length > 0 || nepSeries.points.length > 0) && (
        <section className="m-sec">
          <h2 className="sec">Combined ratio &amp; premium trend</h2>
          <p className="dek">
            The headline combined ratio and net earned premium across the years of account on record for this
            syndicate.
          </p>
          <div className="macro-grid">
            {crSeries.points.length > 0 && (
              <Card title="Combined ratio (%)">
                <MultiLineChart s={crSeries} />
              </Card>
            )}
            {nepSeries.points.length > 0 && (
              <Card title={`Net earned premium (${unit(synCcy)})`}>
                <ColumnChart s={nepSeries} />
              </Card>
            )}
          </div>
        </section>
      )}

      <div className="foot">
        Figures extracted from the syndicate&apos;s annual reports; amounts are in the syndicate&apos;s native
        reporting currency. Breadth over depth:
        only the {citedTotal} cited syndicates carry page-level citations on the{" "}
        <Link href="/" className="m-link">research desk</Link>.
      </div>
    </main>
  );
}
