"use client";

import { useState } from "react";

type Citation = {
  report_id: number;
  page_no: number | null;
  section?: string | null;
  source_url?: string | null;
  syndicate_number?: number | null;
};
type AskResult =
  | { ok: true; intent: string; answer: string; rows: unknown[]; citations: Citation[] }
  | { ok: false; degraded: true; reason: string; suggestions: string[] };

const SAMPLES = [
  "rank syndicates by combined ratio in 2024",
  "how has Chaucer's combined ratio trended since 2020",
  "what are syndicates saying about cyber rates",
];

export function AskBox() {
  const [q, setQ] = useState("which syndicates grew premium while improving their combined ratio in 2023?");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<AskResult | null>(null);

  async function ask(question: string) {
    setQ(question);
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      setRes((await r.json()) as AskResult);
    } catch {
      setRes({ ok: false, degraded: true, reason: "The answer service is unreachable.", suggestions: SAMPLES });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="lede"><span className="q">&ldquo;Ask anything about the Lloyd&apos;s market, and read the answer off the filings.&rdquo;</span></div>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) ask(q.trim());
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Ask the market" />
        <button className="go" disabled={loading}>{loading ? "Reading…" : "Ask"}</button>
      </form>
      <p className="byline">
        All ~130 syndicates, 2020-2025, answered in seconds. Figures from the cited 25 are footnoted to their source page. Try{" "}
        {SAMPLES.map((s, i) => (
          <span key={s}>
            <button type="button" className="lk" onClick={() => ask(s)}>{s}</button>{i < SAMPLES.length - 1 ? ", " : "."}
          </span>
        ))}
      </p>

      {res && res.ok && (
        <div className="answer">
          <div className="body">{res.answer}</div>
          {res.citations.length > 0 && (
            <ol className="cites">
              {res.citations.map((c, i) => (
                <li key={i}>
                  <sup>{i + 1}</sup> report #{c.report_id}
                  {c.page_no != null ? `, p.${c.page_no}` : ""}
                  {c.section ? ` (${c.section})` : ""}
                  {c.source_url ? (
                    <> · <a href={c.source_url} target="_blank" rel="noreferrer">source</a></>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {res && !res.ok && (
        <div className="degraded">
          <p>{res.reason}</p>
          {res.suggestions.length > 0 && (
            <div className="sugg">
              {res.suggestions.map((s) => (
                <button key={s} onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
