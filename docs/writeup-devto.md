# DRAFT - dev.to build write-up (#H0Hackathon bonus)

> Status: draft for Keith's voice pass before publishing. Publish on dev.to (or
> LinkedIn) with the **#H0Hackathon** tag and add the URL to the Devpost submission.
> Suggested title below; swap in the live URL + repo link before posting.

---

Title: **I built a Lloyd's of London research desk where every number is clickable back to the PDF it came from (H0 Hackathon)**

Tags: #H0Hackathon #aws #vercel #postgres

---

Every Lloyd's of London syndicate publishes its annual results as a PDF, usually 50 to
200 pages. There are over a hundred active syndicates. The people who allocate capital
across them read these by hand, every results season. I spent part of my career around
this market and the tooling has barely moved.

So for the H0 Hackathon (AWS database + Vercel frontend) I built **Ask the Market**: you
ask a question in plain English, like *"which syndicates grew premium while improving
their combined ratio in 2023?"*, and you get a ranked, currency-normalised answer in
seconds. The part I care most about: every number in the answer is footnoted to the
exact page of the source report, and clicking it opens that actual page with the figure
highlighted.

## The trust problem decided the architecture

A financial answer you cannot verify is worthless, and an LLM that invents a combined
ratio is worse than no tool at all. Three design rules fell out of that:

**1. The model never writes SQL.** Claude (on Bedrock) only ever emits
`{intent, params}` as structured output, chosen from eight allowlisted query intents
(rank, trend, compare, growers-and-improvers, peer percentile, market overview, explain
change, narrative search). A zod validator checks every parameter against the allowlist,
then a fixed SQL template runs with bound parameters on a read-only Postgres role with a
statement timeout. Ask it something off-catalog and it degrades gracefully instead of
guessing.

**2. Numbers come from rows, never from the model.** The composer writes prose around
values taken from the result set, and citations come from provenance columns. A figure
cannot be hallucinated because the model never generates one.

**3. Verify before you cite.** Each figure in the dataset was reconciled against its
source PDF (value, page, verbatim quote) before earning a `verified` flag. The cited
pages are pre-rendered to PNG with the figure highlighted in gold, so click-to-source is
instant. While building this, the verification pass caught real landmines: one syndicate
files in US dollars in millions while another files in sterling thousands, on the same
metric. The schema stores the native as-filed value plus a GBP-normalised value, so
rankings are fair and a clicked number still matches the page exactly.

## One database doing two jobs

The whole backend is a single Aurora PostgreSQL (Serverless v2) instance with pgvector:

- relational fact tables for the analytics (window functions for rankings and
  percentiles, a self-join for the growers-and-improvers query)
- `report_chunk` with a generated tsvector column and an HNSW index for the narrative
  side, so qualitative questions ("what are syndicates saying about rates?") and
  hybrid questions ("why did X improve?") are one SQL join away from the facts

No second vector store, no sync problem, one connection pool
(`attachDatabasePool` from `@vercel/functions` keeps Fluid Compute from exhausting
Postgres).

The frontend is Next.js 15 on Vercel: server components query the read-only role
directly for the dashboard (no LLM anywhere on that path), and the Ask box is the only
route that touches Bedrock.

## What I would tell you if you are building something similar

- Decouple your seed's text from your embeddings. My first seed only inserted narrative
  chunks when it could embed them, which silently coupled local development to cloud
  credentials. Text always, vectors when available: keyword search works offline and
  semantic search lights up later.
- Store financial figures as filed, normalise for comparison, display either. Doing
  currency conversion at render time from one canonical stored value is how you end up
  with a citation that does not match its page.
- Render your source pages ahead of time. PDF-to-image at request time is slow and
  flaky; ten pre-rendered cited pages cost a few megabytes and make the trust feature
  feel instant.

The stack: Aurora PostgreSQL + pgvector, AWS Bedrock (Claude Sonnet 4.6 + Titan
Embeddings v2) through the Vercel AI SDK, Next.js 15 on Vercel.

Live app: [URL]
Repo: [URL]

Built solo for the H0 Hackathon, Monetizable B2B track.
