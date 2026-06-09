"use client";

import { useState } from "react";
import { SourceViewer, type SourceTarget } from "./source-viewer";

export type LeagueRow = {
  syndicate_number: number;
  name: string;
  cr: number;
  crPage: number | null;
  gwpDisplay: string; // comparable, in the selected display currency (league cell)
  gwpNative: string; // as-filed native currency (peek + source viewer)
  gwpPage: number | null;
  reportYear: number; // the report the figures are cited to
  quote?: { text: string; page: number | null; section: string | null } | null;
};

export function LeagueWithPeek({ rows, sourcesEnabled }: { rows: LeagueRow[]; sourcesEnabled: boolean }) {
  const [sel, setSel] = useState(0);
  const [view, setView] = useState<SourceTarget | null>(null);
  const r = rows[sel];

  const openCR = () => {
    if (r && r.crPage != null) {
      setView({ syndicate_number: r.syndicate_number, page: r.crPage, name: r.name, year: r.reportYear, label: "Combined ratio", value: r.cr.toFixed(1) });
    }
  };
  const openGWP = () => {
    if (r && r.gwpPage != null) {
      setView({ syndicate_number: r.syndicate_number, page: r.gwpPage, name: r.name, year: r.reportYear, label: "Gross written premium", value: r.gwpNative });
    }
  };

  return (
    <>
      <table className="lt">
        <thead>
          <tr><th>Syndicate</th><th style={{ textAlign: "right" }}>CR</th><th style={{ textAlign: "right" }}>GWP</th></tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.syndicate_number}
              className={`row${i === sel ? " sel" : ""}`}
              tabIndex={0}
              role="button"
              aria-label={`Show source for ${row.name} syndicate ${row.syndicate_number}`}
              aria-pressed={i === sel}
              onClick={() => setSel(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSel(i);
                }
              }}
            >
              <td>
                <span className="nm">
                  {row.name} {row.syndicate_number}
                  <sup>{i + 1}</sup>
                  <small>Syndicate {row.syndicate_number}</small>
                </span>
              </td>
              <td className="num">{row.cr.toFixed(1)}</td>
              <td className="num">{row.gwpDisplay}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {r && (
        <div className="quote">
          <div className="src">
            <b>{r.name}</b> · Syndicate {r.syndicate_number} · Annual Report {r.reportYear}
          </div>
          <p>
            Combined ratio <span className="hl">{r.cr.toFixed(1)}</span>
            {r.crPage != null ? <> cited at p.{r.crPage}</> : null}. Gross written premium{" "}
            <span className="hl">{r.gwpNative}</span> (as filed)
            {r.gwpPage != null ? <> cited at p.{r.gwpPage}</> : null}.
          </p>
          {r.quote && (
            <blockquote className="peek-quote">
              &ldquo;{r.quote.text}&rdquo;
              <cite>
                {r.quote.section ? `${r.quote.section}, ` : ""}Syndicate {r.syndicate_number} Annual Report {r.reportYear}
                {r.quote.page != null ? `, p.${r.quote.page}` : ""}
              </cite>
            </blockquote>
          )}
          {sourcesEnabled && (
            <div className="peek-actions">
              {r.crPage != null && <button type="button" onClick={openCR}>View combined ratio on p.{r.crPage}</button>}
              {r.gwpPage != null && <button type="button" onClick={openGWP}>View gross premium on p.{r.gwpPage}</button>}
            </div>
          )}
        </div>
      )}

      <div className="notes">
        <div>
          {rows.map((row, i) => (
            <span key={row.syndicate_number}>
              <sup>{i + 1}</sup> Syndicate {row.syndicate_number} AR {row.reportYear}
              {row.crPage != null ? `, p.${row.crPage}` : ""}
              {i < rows.length - 1 ? " · " : ""}
            </span>
          ))}
        </div>
      </div>

      <SourceViewer target={view} onClose={() => setView(null)} />
    </>
  );
}
