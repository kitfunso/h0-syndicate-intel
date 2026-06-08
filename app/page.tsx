"use client";

import { useState } from "react";

// Intentionally minimal. This is the spike harness UI; v0 generates the real design
// (screener + tearsheet + answer + source-page viewer) in days 11-14.

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

export default function Home() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<AskResult | null>(null);

  async function ask(question: string) {
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      setRes(await r.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Ask the Market</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Lloyd&apos;s syndicate intelligence. Every number is cited to its source report.
      </p>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) ask(q.trim());
        }}
      >
        <input
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Rank syndicates by combined ratio for 2023"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "..." : "Ask"}
        </button>
      </form>

      {res && res.ok && (
        <section className="mt-8">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{res.answer}</div>
          {res.citations.length > 0 && (
            <ol className="mt-4 space-y-1 text-xs text-neutral-500">
              {res.citations.map((c, i) => (
                <li key={i}>
                  [{i + 1}] report #{c.report_id}
                  {c.page_no != null ? `, p.${c.page_no}` : ""}
                  {c.section ? ` (${c.section})` : ""}
                  {c.source_url ? (
                    <>
                      {" "}
                      <a className="underline" href={c.source_url} target="_blank" rel="noreferrer">
                        source
                      </a>
                    </>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {res && !res.ok && (
        <section className="mt-8 text-sm">
          <p className="text-neutral-700">{res.reason}</p>
          <p className="mt-3 text-neutral-500">Try:</p>
          <ul className="mt-1 space-y-1">
            {res.suggestions.map((s) => (
              <li key={s}>
                <button className="text-left underline" onClick={() => ask(s)}>
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
