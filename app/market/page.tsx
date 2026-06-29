import Link from "next/link";
import { getMarketSeries, type MacroSeries } from "@/lib/macro";
import {
  ColumnChart,
  StackedAreaChart,
  MultiLineChart,
  StackedColumns,
  SeriesTable,
} from "../components/macro-charts";

// pg runs server-side; render per request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The MACRO research page: Lloyd's market aggregates 2016-2024, every series a
 * queryable market_series row. This whole page is the CONTEXT layer: aggregates,
 * clearly labelled, never wired to the per-syndicate source-page viewer.
 */

const LOB_ORDER = ["Property", "Casualty", "Marine, Aviation & Transport", "Energy", "Motor", "Reinsurance", "Total"];
const CCY_ORDER = ["GBP", "USD", "EUR", "CAD", "AUD", "OTH"];
const KRD_ORDER = ["0-1 yrs", "1-3 yrs", "3-5 yrs", "Over 5 yrs"];
const AC_ORDER = ["Debt & fixed income", "Shares & variable yield", "Loans & deposits", "Investment pools", "Other"];
const FV_ORDER = ["Level 1", "Level 2", "Level 3"];
const CQ_ORDER = ["AAA", "AA", "A", "BBB", "Other"];
const FAL_ORDER = ["Letters of credit", "Corporate bonds", "Government bonds", "Deposits (Lloyd's)", "Equities"];

// Lloyd's Investment Platform funds (public LIP information).
const LIP_FUNDS = [
  { fund: "GBP/EUR Enhanced Yield Liquidity Fund", manager: "Insight Investment", strategy: "Short-duration IG credit", target: "SONIA +35bps (GBP), EONIA +30bps (EUR)", liquidity: "T+1" },
  { fund: "USD Enhanced Yield Liquidity Fund", manager: "Payden & Rygel", strategy: "Short-duration IG credit", target: "SOFR +40bps", liquidity: "T+1" },
  { fund: "CAD Fixed Income Fund (planned)", manager: "Fiera Capital", strategy: "IG credit, duration-matched", target: "n/d", liquidity: "n/d" },
  { fund: "US Direct Lending Fund", manager: "Maranon Capital", strategy: "Senior-secured direct lending", target: "SOFR +5 to 6.5% gross", liquidity: "Quarterly" },
  { fund: "Private Impact Fund (LPIF)", manager: "BlueOrchard & Schroders Greencoat", strategy: "PE, infrastructure, natural capital", target: "n/d", liquidity: "n/d" },
];

/** Cumulative growth index (2016 = 0%) derived exactly from gwp_by_line. */
function deriveGrowthIndex(gwp: MacroSeries): MacroSeries {
  const cs = Array.from(new Set(gwp.points.map((p) => p.category)));
  const ys = Array.from(new Set(gwp.points.map((p) => p.year))).sort((a, b) => a - b);
  const base = ys[0];
  const points = cs.flatMap((c) => {
    const b = gwp.points.find((p) => p.category === c && p.year === base)?.value ?? 0;
    return ys.map((y) => ({
      category: c,
      year: y,
      value: b ? ((gwp.points.find((p) => p.category === c && p.year === y)?.value ?? 0) / b - 1) * 100 : 0,
      unit: "pct",
    }));
  });
  return { ...gwp, series_key: "growth_index", series_label: "Cumulative premium growth since 2016", points };
}

function Card({ title, insight, children }: { title: string; insight?: string; children: React.ReactNode }) {
  return (
    <figure className="macro-card">
      <figcaption>{title}</figcaption>
      {children}
      {insight ? <p className="m-insight">{insight}</p> : null}
    </figure>
  );
}

export default async function MarketPage() {
  const all = await getMarketSeries();
  const byKey = new Map(all.map((s) => [s.series_key, s]));
  const g = (k: string) => byKey.get(k);

  const gwpByLine = g("gwp_by_line");
  const invRet = g("investment_returns");
  const returnsOnly = invRet ? { ...invRet, points: invRet.points.filter((p) => p.unit === "pct") } : undefined;
  const expensesOnly = invRet ? { ...invRet, points: invRet.points.filter((p) => p.unit === "bps").map((p) => ({ ...p, category: "" })) } : undefined;

  // Whole-market headline aggregates (2024) for the "at a glance" KPI band.
  const mv = (key: string, yr: number, category = "") =>
    byKey.get(key)?.points.find((p) => p.year === yr && p.category === category)?.value ?? null;
  const kpi = {
    syndicateInvest: mv("asset_pools", 2024, "Syndicate financial investments"),
    almCoverage: mv("alm_coverage", 2024),
    debtFI: mv("asset_classes_pct", 2024, "Debt & fixed income"),
    level3: mv("fair_value_abs", 2024, "Level 3"),
    investGrade: (() => { const o = mv("credit_quality", 2024, "Other"); return o == null ? null : 100 - o; })(),
  };
  const num = (v: number | null) => (v == null ? null : Number(v));

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <h1>The Lloyd&apos;s Market in Charts</h1>
          <div className="kicker">Market research: aggregates 2016 to 2024. Context layer; per-syndicate cited figures live on the <Link href="/" className="m-link">research desk</Link>, and every extracted syndicate in the <Link href="/syndicates" className="m-link">syndicate universe &rarr;</Link>.</div>
        </div>
        <div className="issue">
          Lloyd&apos;s market aggregates<br />
          <span className="on">2016-2024</span> · not click-to-source<br />
          transcribed from Lloyd&apos;s market reports
        </div>
      </header>

      <section className="tiles kpi-band">
        <div className="tile macro"><div className="k">Capital platform</div><div className="v">£125bn+</div><div className="d">Lloyd&apos;s total capital base</div></div>
        <div className="tile macro"><div className="k">Syndicate investments</div><div className="v">{kpi.syndicateInvest != null ? `£${num(kpi.syndicateInvest)!.toFixed(0)}bn` : "n/a"}</div><div className="d">Financial assets, 2024</div></div>
        <div className="tile macro"><div className="k">Interest-rate coverage</div><div className="v">{kpi.almCoverage != null ? `${num(kpi.almCoverage)!.toFixed(0)}%` : "n/a"}</div><div className="d">Asset vs liability PV01, 2024</div></div>
        <div className="tile macro"><div className="k">Investment grade</div><div className="v">{kpi.investGrade != null ? `${num(kpi.investGrade)!.toFixed(0)}%+` : "n/a"}</div><div className="d">Fixed-income holdings, 2024</div></div>
        <div className="tile macro"><div className="k">Debt &amp; fixed income</div><div className="v">{kpi.debtFI != null ? `${num(kpi.debtFI)!.toFixed(1)}%` : "n/a"}</div><div className="d">Share of investments, 2024</div></div>
        <div className="tile macro"><div className="k">Private assets (L3)</div><div className="v">{kpi.level3 != null ? `£${num(kpi.level3)!.toFixed(1)}bn` : "n/a"}</div><div className="d">Hard-to-value holdings, 2024</div></div>
      </section>

      <section className="m-sec">
        <h2 className="sec">Aggregate market performance</h2>
        <p className="dek">The market swung from years of underwriting losses to record profits in 2023 and 2024, with investment return and underwriting both contributing.</p>
        <div className="macro-grid">
          {g("result_before_tax") && <Card title="Market-wide result before tax (£bn)"><ColumnChart s={g("result_before_tax")!} /></Card>}
          {g("result_decomposition") && (
            <Card title="Result decomposition (£bn)" insight="2023: £4.9bn investment return plus £5.6bn underwriting result. 2022's loss was an investment-side drawdown over an underwriting profit.">
              <StackedColumns s={g("result_decomposition")!} />
            </Card>
          )}
        </div>
        <div className="macro-grid">
          {g("gwp_yoy_by_line") && (
            <Card title="Premium growth, year on year (%)" insight="The 2021-2023 hard market shows across every line; 2022 grew 19% in a single year.">
              <SeriesTable s={g("gwp_yoy_by_line")!} order={LOB_ORDER} suffix="%" />
            </Card>
          )}
          {g("implied_de") && <Card title="Implied debt-to-equity (x)" insight="Leverage peaked at 3.7x in 2018 and has eased back to ~3.0x."><MultiLineChart s={g("implied_de")!} /></Card>}
        </div>
      </section>

      <section className="m-sec">
        <h2 className="sec">Underwriting trends &amp; ALM</h2>
        <p className="dek">Reinsurance and property drive the growth; liabilities are lengthening slightly while the asset-liability duration gap remains material.</p>
        <div className="macro-grid">
          {gwpByLine && <Card title="Gross written premium by line (£bn)"><StackedAreaChart s={gwpByLine} /></Card>}
          {gwpByLine && (
            <Card title="Cumulative premium growth since 2016 (%)" insight="Reinsurance and Property roughly doubled by 2024; Motor contracted then recovered to near-flat.">
              <MultiLineChart s={deriveGrowthIndex(gwpByLine)} order={["Reinsurance", "Property", "Casualty", "Energy", "Marine, Aviation & Transport", "Motor"]} />
            </Card>
          )}
        </div>
        <div className="macro-grid">
          {g("liability_krd") && <Card title="Liability key-rate durations (normalised)"><StackedAreaChart s={g("liability_krd")!} /></Card>}
          {g("pv01") && (
            <Card title="Aggregate PV01 (£m)" insight="Liability PV01 grew to £22.8m by 2024 while asset PV01 reached £15.2m: assets still run materially shorter than liabilities.">
              <MultiLineChart s={g("pv01")!} order={["Liability PV01", "Asset PV01"]} />
            </Card>
          )}
        </div>
        <div className="macro-grid">
          {g("alm_coverage") && (
            <Card title="Interest-rate coverage ratio (%)" insight="Coverage improved from a 44% trough in 2018 to 67% in 2024, but remains well below 100%: a material ALM gap.">
              <MultiLineChart s={g("alm_coverage")!} />
            </Card>
          )}
          {g("asset_leverage") && (
            <Card title="Asset leverage: investments / NEP (x)" insight="Asset leverage has compressed from its 2.74x peak as premium grew faster than the asset base.">
              <MultiLineChart s={g("asset_leverage")!} />
            </Card>
          )}
        </div>
      </section>

      <section className="m-sec">
        <h2 className="sec">Investment landscape</h2>
        <p className="dek">A £96bn syndicate asset pool, USD-dominated, three quarters in fixed income, overwhelmingly investment grade, with private assets still nascent.</p>
        <div className="macro-grid">
          {g("asset_pools") && (
            <Card title="Market asset pools (£bn)" insight="Syndicate financial investments grew from £55bn to £96bn over the period.">
              <MultiLineChart s={g("asset_pools")!} order={["Syndicate financial investments", "Members' FAL", "Cash", "Members' balances", "Central reserves"]} />
            </Card>
          )}
          {g("invest_by_ccy") && (
            <Card title="Investments by currency (£bn)" insight="USD assets nearly doubled to £66bn; the book is roughly two-thirds dollars.">
              <StackedColumns s={g("invest_by_ccy")!} order={CCY_ORDER} />
            </Card>
          )}
        </div>
        <div className="macro-grid">
          {g("ccy_coverage") && (
            <Card title="Investments / technical provisions by currency (%)" insight="GBP and USD liabilities run persistently under-covered by same-currency investments; CAD is structurally over-covered.">
              <SeriesTable s={g("ccy_coverage")!} order={CCY_ORDER} suffix="%" />
            </Card>
          )}
          {g("asset_classes_abs") && (
            <Card title="Asset classes, absolute (£bn)">
              <StackedColumns s={g("asset_classes_abs")!} order={AC_ORDER} />
            </Card>
          )}
        </div>
        <div className="macro-grid">
          {g("asset_classes_pct") && (
            <Card title="Asset classes, proportional (%)" insight="Debt and fixed income now dominate at 74.7% of the portfolio, up from 69% in 2016.">
              <StackedColumns s={g("asset_classes_pct")!} percent100 order={AC_ORDER} />
            </Card>
          )}
          {g("fair_value_abs") && (
            <Card title="Fair-value hierarchy (£bn)">
              <StackedColumns s={g("fair_value_abs")!} order={FV_ORDER} />
            </Card>
          )}
        </div>
        <div className="macro-grid">
          {g("fair_value_pct") && (
            <Card title="Fair-value hierarchy, proportional (%)" insight="Level 3 (hard-to-value) assets grew from 1.6% to only 2.0%: appetite for private assets is real but early.">
              <StackedColumns s={g("fair_value_pct")!} percent100 order={FV_ORDER} />
            </Card>
          )}
          {g("fal_asset_class") && (
            <Card title="FAL proxy asset classes (%)" insight="Letters of credit fell from 44% to 28% of FAL, replaced by government and corporate bonds.">
              <StackedAreaChart s={g("fal_asset_class")!} />
            </Card>
          )}
        </div>
        <div className="macro-grid">
          {returnsOnly && (
            <Card title="Investment returns (%)" insight="2022's rate shock produced negative returns across syndicate and FAL assets; 2023-24 recovered strongly.">
              <MultiLineChart s={returnsOnly} order={["Syndicate return", "Notional FAL return"]} />
            </Card>
          )}
          <div>
            {expensesOnly && (
              <Card title="Investment expenses (bps)" insight="Expenses have stayed in a 7-13bps band across the cycle.">
                <MultiLineChart s={expensesOnly} />
              </Card>
            )}
          </div>
        </div>
        <div className="macro-grid">
          {g("credit_quality") && (
            <Card title="Fixed-income credit quality (%)" insight="Sub-IG and unrated holdings halved from 19% to 10%; the book is 90%+ investment grade.">
              <StackedColumns s={g("credit_quality")!} percent100 order={CQ_ORDER} />
            </Card>
          )}
          <div />
        </div>
      </section>

      <section className="m-sec">
        <h2 className="sec">The future of investing at Lloyd&apos;s</h2>
        <p className="dek">The Lloyd&apos;s Investment Platform pools syndicate assets into centrally vetted funds, with Schroders Capital advising across the range.</p>
        <table className="lt mt">
          <thead>
            <tr><th>Fund</th><th>Manager</th><th>Strategy</th><th>Target</th><th>Liquidity</th></tr>
          </thead>
          <tbody>
            {LIP_FUNDS.map((f) => (
              <tr key={f.fund}>
                <td className="mt-cat">{f.fund}</td>
                <td>{f.manager}</td>
                <td>{f.strategy}</td>
                <td>{f.target}</td>
                <td>{f.liquidity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="m-explainer">
          <h3>How the capital stack works</h3>
          <p>
            Lloyd&apos;s is a £125bn+ capital platform. Syndicate assets sit in <b>Premium Trust Funds</b> (working capital;
            liquid, investment grade), <b>Deposit Trust Funds</b> (regulatory collateral with strict currency and domicile
            constraints) and freer <b>surplus assets</b>. Behind them sit <b>Funds at Lloyd&apos;s</b>: member capital derived
            from each syndicate&apos;s SCR and governed by a Lloyd&apos;s-mandated standard asset allocation. One market-wide
            internal model (the LIM) aggregates 55+ syndicate capital models under Solvency UK.
          </p>
        </div>
      </section>

      <div className="foot">
        Source: Lloyd&apos;s market aggregate data, 2016-2024. These aggregates are context only:
        per-syndicate figures with page citations live on the <Link href="/" className="m-link">research desk</Link>.
      </div>
    </main>
  );
}
