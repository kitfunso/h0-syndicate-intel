import { buildDashboard } from "@/lib/dashboard";
import { getReportQuotes, type ReportQuote } from "@/lib/quotes";
import { getDisplayRate, CURRENCY_SYMBOL, type DisplayCurrency } from "@/lib/fx";
import { AskBox } from "./components/ask-box";
import { LeagueWithPeek, type LeagueRow } from "./components/league-with-peek";
import { Toggles } from "./components/toggles";
import { shortName } from "@/lib/short-name";
import Link from "next/link";

// pg runs server-side; render per request (the DB is read at request time, not build).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORT_YEAR = 2023; // the annual report our figures are sourced from (incl. 2022 comparatives)
const YEARS = [2022, 2023] as const; // years of account citable from that report
const n = (v: unknown) => Number(v);
const SYM: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };

function clampYear(v: string | undefined): number {
  const y = Number(v);
  return (YEARS as readonly number[]).includes(y) ? y : REPORT_YEAR;
}
function clampCcy(v: string | undefined): DisplayCurrency {
  return v === "USD" || v === "EUR" ? v : "GBP";
}

// Comparable value in the selected display currency (from the GBP-normalised value).
const dispM = (gbp: unknown, rate: number, sym: string) => `${sym}${Math.round(n(gbp) * rate).toLocaleString("en-GB")}m`;
// As-filed value in the report's native currency (for citation).
const nativeM = (val: unknown, ccy: string) => `${SYM[ccy] ?? ""}${n(val).toLocaleString("en-GB", { maximumFractionDigits: 1 })}m`;

// Trim a narrative chunk to a readable editorial excerpt at a sentence boundary.
function excerpt(t: string, max = 260): string {
  const s = t.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return (end > 120 ? cut.slice(0, end + 1) : cut.trim()) + " …";
}

type ScatterPt = { syn: number; name: string; x: number; y: number; left: boolean; px: number; py: number; r: number; labeled: boolean };

// Rows arrive ordered by GWP growth desc. Greedy label placement: biggest growers
// get labels first, and a label is dropped if its box would collide with one already
// placed (max 8). Unlabeled points keep a hover title.
function buildScatter(rows: Record<string, unknown>[]): ScatterPt[] {
  const pts = rows.map((r) => ({
    syn: n(r.syndicate_number),
    name: shortName(String(r.name)),
    x: n(r.gwp_gbp_growth),
    y: n(r.combined_ratio_improvement),
  }));
  const xMax = Math.max(1, ...pts.map((p) => p.x)) * 1.14;
  const yMax = Math.max(1, ...pts.map((p) => p.y)) * 1.18;
  const X0 = 60, X1 = 520, Y0 = 250, Y1 = 34;
  const placed: Array<{ x: number; y: number }> = [];
  const LW = 110, LH = 26; // approximate label box
  return pts.map((p, i) => {
    const px = X0 + (p.x / xMax) * (X1 - X0);
    const py = Y0 - (p.y / yMax) * (Y0 - Y1);
    const left = px > 430;
    const ax = left ? px - 12 - LW : px + 12; // label box origin
    const collides = placed.some((b) => Math.abs(b.x - ax) < LW && Math.abs(b.y - py) < LH);
    const labeled = i < 8 && placed.length < 8 && !collides;
    if (labeled) placed.push({ x: ax, y: py });
    return { ...p, px, py, r: p.x >= (xMax / 1.14) * 0.92 ? 8 : 6.5, left, labeled };
  });
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const year = clampYear(first(sp.year));
  // On an FX lookup failure, fall back to GBP (not the selected ccy at rate 1) so the
  // currency symbol always matches the magnitude shown.
  let ccy = clampCcy(first(sp.ccy));
  let rate = 1;
  try {
    rate = await getDisplayRate(ccy, year);
  } catch {
    ccy = "GBP";
    rate = 1;
  }
  const sym = CURRENCY_SYMBOL[ccy];
  const fullYear = year === REPORT_YEAR; // 2023 has scatter + narrative + source-page images

  // Fetch the full market (covers every league row's GWP lookup); display slices below.
  const d = await buildDashboard({ year, yearFrom: year - 1, yearTo: year, limit: 50 });
  const LEAGUE_ROWS = 10; // top of the cited sample; the full 132-syndicate universe lives on /syndicates

  const synNums = d.rank_by_combined_ratio.map((r) => n(r.syndicate_number));
  const quotes: Record<number, ReportQuote> = fullYear ? await getReportQuotes(synNums).catch(() => ({})) : {};

  const ov = d.overview ?? {};
  const best = d.rank_by_combined_ratio[0];
  const gwpBySyn = new Map<number, Record<string, unknown>>(
    d.rank_by_gwp.map((r) => [n(r.syndicate_number), r])
  );

  const league: LeagueRow[] = d.rank_by_combined_ratio.slice(0, LEAGUE_ROWS).map((r) => {
    const snum = n(r.syndicate_number);
    const g = gwpBySyn.get(snum);
    const q = quotes[snum];
    return {
      syndicate_number: snum,
      name: shortName(String(r.name)),
      cr: n(r.value_gbp),
      crPage: r.source_page != null ? n(r.source_page) : null,
      gwpDisplay: g ? dispM(g.value_gbp, rate, sym) : "n/a",
      gwpNative: g ? nativeM(g.value_native, String(g.currency)) : "n/a",
      gwpPage: g && g.source_page != null ? n(g.source_page) : null,
      reportYear: REPORT_YEAR,
      quote: q ? { text: excerpt(q.text), page: q.page_no, section: q.section } : null,
    };
  });

  const scatter = fullYear ? buildScatter(d.growers_improvers) : [];

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <h1>Syndicate research desk</h1>
          <div className="kicker">A research desk for the Lloyd&apos;s of London syndicate market. This desk shows the PDF-cited sample; browse <Link href="/syndicates" className="m-link">all 132 syndicates, 2020-2025 &rarr;</Link> or the <Link href="/market" className="m-link">market in charts &rarr;</Link>.</div>
        </div>
        <div className="issue">
          <Toggles ccy={ccy} year={year} />
          <div className="issue-sub">{n(ov.n_combined_ratio)} PDF-cited syndicates · {year} year of account · source: AR {REPORT_YEAR}</div>
        </div>
      </header>

      <AskBox />

      <section className="tiles">
        <div className="tile"><div className="k">Average combined ratio</div><div className="v">{ov.avg_combined_ratio != null ? n(ov.avg_combined_ratio).toFixed(1) : "n/a"}</div><div className="d">{year}, {n(ov.n_combined_ratio)} cited syndicates</div></div>
        <div className="tile"><div className="k">Total gross premium</div><div className="v">{ov.total_gwp_gbp != null ? dispM(ov.total_gwp_gbp, rate, sym) : "n/a"}</div><div className="d">{ccy} display, cited sample</div></div>
        <div className="tile"><div className="k">Strongest underwriter</div><div className="v">{best ? n(best.value_gbp).toFixed(1) : "n/a"}</div><div className="d">{best ? `${shortName(String(best.name))}, syndicate ${n(best.syndicate_number)}` : ""}</div></div>
      </section>

      <div className="cols">
        <div>
          <h2 className="sec">Grew and improved</h2>
          {scatter.length ? (
            <>
              <p className="dek">Gross premium growth against combined-ratio improvement, {year - 1} to {year}.</p>
              <svg viewBox="0 0 540 270" width="100%" height="270">
                <line className="scat-axis" x1="60" y1="250" x2="520" y2="250" />
                <line className="scat-axis" x1="60" y1="30" x2="60" y2="250" />
                <text className="scat-q" x="516" y="265" textAnchor="end">premium growth ({sym}m)</text>
                <text className="scat-q" x="52" y="42" textAnchor="end" transform="rotate(-90 52 42)">combined-ratio improvement (pts)</text>
                {scatter.map((p) => (
                  <g key={p.syn}>
                    <circle className={p.r >= 8 ? "pt big" : "pt"} cx={p.px} cy={p.py} r={p.r}>
                      {/* single text node: multi-part children inside an SVG title hydrate inconsistently */}
                      <title>{`${p.name} ${p.syn}: +${dispM(p.x, rate, sym)} / -${p.y.toFixed(1)} pts`}</title>
                    </circle>
                    {p.labeled && (
                      <>
                        <text className="pl" x={p.left ? p.px - 12 : p.px + 12} y={p.py - 5} textAnchor={p.left ? "end" : "start"}>{p.name}</text>
                        <text className="ps" x={p.left ? p.px - 12 : p.px + 12} y={p.py + 7} textAnchor={p.left ? "end" : "start"}>+{dispM(p.x, rate, sym)} / -{p.y.toFixed(1)}</text>
                      </>
                    )}
                  </g>
                ))}
              </svg>
            </>
          ) : (
            <p className="dek">Premium-growth comparison is available for 2023; it needs two consecutive years of gross-premium figures.</p>
          )}
        </div>

        <div>
          <h2 className="sec">By combined ratio</h2>
          <p className="dek">Top {LEAGUE_ROWS} of the 25 PDF-cited syndicates, lowest (strongest) combined ratio first.{fullYear ? " Click a syndicate to see its source." : ""} <Link href="/syndicates" className="m-link">Browse all 132 &rarr;</Link></p>
          <LeagueWithPeek rows={league} sourcesEnabled={fullYear} />
        </div>
      </div>

      <div className="foot">Numbers from the filings, citations to the page. Market-wide context lives on the <Link href="/market" className="m-link">market tab</Link>. Aurora PostgreSQL with pgvector, served on Vercel.</div>
    </main>
  );
}
