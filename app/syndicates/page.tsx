import Link from "next/link";
import { getAllSyndicates } from "@/lib/all-syndicates";
import { AllSyndicates } from "../components/all-syndicates";

// pg runs server-side; render per request (the DB is read at request time, not build).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The SYNDICATE UNIVERSE page: every syndicate we extracted from the Lloyd's annual
 * reports, 2020-2025. This is the BREADTH layer. Unlike the research desk, only a
 * minority of these rows carry page-level citations (the `cited` flag); the rest are
 * extracted figures, and the page says so plainly. Counts are derived from the data,
 * not hard-coded, so the masthead never drifts from the table beneath it.
 */
export default async function SyndicatesPage() {
  const rows = await getAllSyndicates();

  const synCount = new Set(rows.map((r) => r.syndicateNumber)).size;
  const citedCount = new Set(rows.filter((r) => r.cited).map((r) => r.syndicateNumber)).size;
  const years = Array.from(new Set(rows.map((r) => r.yearOfAccount))).sort((a, b) => a - b);
  const yearMin = years[0] ?? 2020;
  const yearMax = years[years.length - 1] ?? 2025;

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <h1>The Lloyd&apos;s Syndicate Universe</h1>
          <div className="kicker">
            {synCount} syndicates, {yearMin} to {yearMax}, extracted from the annual reports. {citedCount} carry
            page-level citations on the <Link href="/" className="m-link">research desk</Link>.
          </div>
        </div>
        <div className="issue">
          Lloyd&apos;s syndicate universe<br />
          <span className="on">{yearMin}-{yearMax}</span> · {rows.length.toLocaleString("en-GB")} year-of-account rows<br />
          every figure extracted, {citedCount} page-cited
        </div>
      </header>

      <section className="band">
        <h2 className="sec">Every syndicate, by combined ratio</h2>
        <p className="dek">
          The full extracted universe: search, sort and filter every syndicate that filed a result. Combined ratio,
          lowest (strongest) first; net earned premium in the filing&apos;s native currency. These are all extracted
          figures; the {citedCount} <Link href="/" className="m-link">cited</Link> syndicates additionally carry
          page-level citations on the research desk, the rest do not. Whole-market aggregates live in the{" "}
          <Link href="/market" className="m-link">market research</Link>.
        </p>
        <AllSyndicates rows={rows} />
      </section>

      <div className="foot">
        Net earned premium and combined ratio extracted from Lloyd&apos;s syndicate annual reports (2020-2025).
        Breadth over depth: only the {citedCount} <Link href="/" className="m-link">cited</Link>{" "}
        syndicates carry per-page source citations.
      </div>
    </main>
  );
}
