"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SyndicateSummary } from "@/lib/all-syndicates";
import { shortName } from "@/lib/short-name";

/**
 * The syndicate-universe table: the full extracted set, searchable by name or number,
 * filterable by year of account, and sortable on combined ratio (default), net earned
 * premium, name or syndicate number. Every figure is an extracted number; the `cited`
 * rows additionally carry page-level citations on the research desk ("/"). The whole
 * thing renders client-side over ~130 rows per year, so filtering and sorting are instant.
 */

const SYM: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025] as const;
const DEFAULT_YEAR = 2024;

type SortKey = "syndicate" | "name" | "cr" | "nep";
type SortDir = "asc" | "desc";
// Each column opens in its most-useful direction: strongest combined ratio (lowest)
// and biggest premium (highest) first; identifiers ascending.
const DEFAULT_DIR: Record<SortKey, SortDir> = { syndicate: "asc", name: "asc", cr: "asc", nep: "desc" };

// Net earned premium in the filing's native currency, e.g. "$1,376m" / "£331m".
function nepDisplay(nep: number, ccy: string | null): string {
  const sym = ccy ? SYM[ccy] ?? "" : "";
  return `${sym}${Math.round(nep).toLocaleString("en-GB")}m`;
}

// Comparator helper: missing values always sort to the bottom, in either direction.
function nullsLast(a: number | null, b: number | null, dir: number): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * dir;
}

type Row = SyndicateSummary & { short: string };

export function AllSyndicates({ rows }: { rows: SyndicateSummary[] }) {
  const [year, setYear] = useState<number>(DEFAULT_YEAR);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("cr");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Derive the display name once for the whole set, not on every keystroke.
  const enriched = useMemo<Row[]>(
    () => rows.map((r) => ({ ...r, short: shortName(r.managingAgent ?? `Syndicate ${r.syndicateNumber}`) })),
    [rows],
  );

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dir = sortDir === "asc" ? 1 : -1;
    const filtered = enriched.filter((r) => {
      if (r.yearOfAccount !== year) return false;
      if (!q) return true;
      return (
        String(r.syndicateNumber).includes(q) ||
        r.short.toLowerCase().includes(q) ||
        (r.managingAgent ?? "").toLowerCase().includes(q)
      );
    });
    filtered.sort((a, b) => {
      let p = 0;
      if (sortKey === "cr") p = nullsLast(a.combinedRatio, b.combinedRatio, dir);
      else if (sortKey === "nep") p = nullsLast(a.nepNative, b.nepNative, dir);
      else if (sortKey === "name") p = a.short.localeCompare(b.short) * dir;
      else p = (a.syndicateNumber - b.syndicateNumber) * dir;
      return p !== 0 ? p : a.syndicateNumber - b.syndicateNumber;
    });
    return filtered;
  }, [enriched, year, query, sortKey, sortDir]);

  const citedInView = useMemo(() => view.filter((r) => r.cited).length, [view]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  };

  const Th = (key: SortKey, label: string, ariaLabel: string, num = false) => {
    const active = sortKey === key;
    return (
      <th
        scope="col"
        className={`sortable${num ? " num" : ""}${active ? " on" : ""}`}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button type="button" onClick={() => onSort(key)} title={`Sort by ${ariaLabel}`} aria-label={`Sort by ${ariaLabel}`}>
          <span>{label}</span>
          <span className="arw" aria-hidden="true">{active ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
        </button>
      </th>
    );
  };

  return (
    <>
      <div className="syn-controls">
        <div className="syn-search">
          <svg className="mag" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <line x1="9.2" y1="9.2" x2="12.6" y2="12.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by syndicate name or number…"
            aria-label="Search syndicates by name or number"
          />
        </div>
        <div className="seg syn-yearseg" role="group" aria-label="Year of account">
          {YEARS.map((y) => (
            <button key={y} type="button" className={y === year ? "on" : ""} aria-pressed={y === year} onClick={() => setYear(y)}>
              {y}
            </button>
          ))}
        </div>
        <div className="syn-count" aria-live="polite">
          {view.length} {view.length === 1 ? "syndicate" : "syndicates"} · {citedInView} cited
        </div>
      </div>

      <table className="lt">
        <thead>
          <tr>
            {Th("syndicate", "#", "syndicate number", true)}
            {Th("name", "Syndicate", "syndicate name")}
            {Th("cr", "Combined ratio", "combined ratio", true)}
            {Th("nep", "Net earned premium", "net earned premium", true)}
          </tr>
        </thead>
        <tbody>
          {view.length === 0 ? (
            <tr>
              <td className="syn-empty" colSpan={4}>
                No syndicates match &ldquo;{query.trim()}&rdquo; in {year}.
              </td>
            </tr>
          ) : (
            view.map((r, i) => (
              <tr key={`${r.syndicateNumber}-${r.yearOfAccount}`}>
                <td className="num syn-rank">{i + 1}</td>
                <td>
                  <span className="nm">
                    <Link href={`/syndicates/${r.syndicateNumber}`} className="syn-link" title={`Open Syndicate ${r.syndicateNumber} profile`}>
                      {r.short} {r.syndicateNumber}
                    </Link>
                    {r.cited && (
                      <Link href="/" className="cited-tag" title="Page-cited on the research desk">cited</Link>
                    )}
                    {r.managingAgent && r.managingAgent !== r.short ? <small>{r.managingAgent}</small> : null}
                  </span>
                </td>
                <td className="num">
                  {r.combinedRatio == null ? <span className="syn-na">n/a</span> : r.combinedRatio.toFixed(1)}
                </td>
                <td className="num">
                  {r.nepNative == null ? <span className="syn-na">n/a</span> : nepDisplay(r.nepNative, r.currency)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
