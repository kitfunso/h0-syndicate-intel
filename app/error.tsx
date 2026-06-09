"use client";

// Styled boundary for a server-render failure (e.g. the DB read in page.tsx throwing).
// Keeps the research-desk shell instead of Next.js's generic error page.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page">
      <header className="masthead">
        <div>
          <h1>Ask the Market</h1>
          <div className="kicker">A research desk for the Lloyd&apos;s of London syndicate market</div>
        </div>
      </header>
      <div className="degraded" style={{ marginTop: 28 }}>
        <p>The market data service is temporarily unreachable. The figures live in the database; this is a connection issue, not missing data.</p>
        <div className="sugg">
          <button onClick={() => reset()}>Try again</button>
        </div>
      </div>
    </main>
  );
}
