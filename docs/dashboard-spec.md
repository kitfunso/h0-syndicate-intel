# Dashboard Spec — "Ask the Market" discovery surface

Status: backend data endpoint (`GET /api/dashboard`) built + verified on real Postgres. The
chart components are generated in **v0** against the live API (per the standing "v0 owns
polished UI" decision), not hand-coded here.

## Why a dashboard
A bare natural-language search box has a cold-start problem: the user doesn't know what they
can ask. The dashboard is the discovery surface — it shows the shape of the market in charts,
and every chart element is a launch point into an Ask-the-Market question with cited answers.
**Discovery -> click -> cited answer** is the demo loop, and it's a stronger narrative than a
lone search box.

## Two layers, one hard provenance boundary
The data splits into two kinds that must NOT be visually conflated:

1. **Micro (per-syndicate, cited).** Our verified `syndicate_year` data: combined ratio, GWP,
   NEP per syndicate, GBP-normalised. Every figure cites an exact report page. This is the core
   of the product and the trust thesis.
2. **Macro (market-aggregate, context).** Lloyd's market-wide 2016-2024 series (result before
   tax, GWP by line, asset allocation by currency, ALM coverage, credit quality, fair-value
   hierarchy), sourced from `docs/private/opportunity-set.md` (Lloyd's aggregate accounts /
   market analysis). This is CONTEXT. It does NOT cite a single syndicate PDF page.

**Rule:** a number a user can click-to-source must be micro. Macro charts carry a
"Lloyd's market aggregate" source label and are never wired to the page-viewer. Blurring the
two re-introduces the exact trust-collapse risk the citation thesis exists to kill.

## Charts — micro layer (BUILT; data live from /api/dashboard)
| Chart | Type | Data field | Click action |
|---|---|---|---|
| Market tiles | stat cards | `overview` | none (headline numbers) |
| Grew & improved | scatter: x = GWP growth (£), y = combined-ratio improvement | `growers_improvers` | click dot -> ask "why did {name} grow while improving its combined ratio in {to}?" (explain_change) |
| Largest by premium | horizontal bar | `rank_by_gwp` | click bar -> open that syndicate's GWP source page |
| Best underwriters | horizontal bar (CR ascending) | `rank_by_combined_ratio` | click bar -> peer_percentile for that syndicate |

**Hero = the scatter.** It is our flagship `growers_improvers` query rendered visually: the
top-right quadrant is "grew premium AND improved combined ratio." Each dot is a real syndicate
carrying a cited GWP page. Clicking a dot drops you straight into a cited "why" answer.

## Charts — macro layer (PENDING a direction call)
The 2016-2024 series from the deck (slides 20, 22, 25, 27, 29-35). Two options:
- **A — DB-backed:** seed a `market_series` table from `opportunity-set.md` so the macro charts
  are queryable (and the database stays "the star"). Richest, more work.
- **B — visual-only context:** v0 renders these from a static JSON; no DB table. Leaner.
Either way the macro charts are labelled market context, never click-to-source.

## API contract
```
GET /api/dashboard?year=2023&from=2022&to=2023&limit=12
-> { ok, year, year_from, year_to,
     overview, growers_improvers[], rank_by_gwp[], rank_by_combined_ratio[] }
```
Deterministic: runs allowlisted catalog intents directly, no LLM router, no embeddings —
renders even when Bedrock is unavailable. Read-only role, `statement_timeout`, row cap.

## v0 build notes
- Recharts or Tremor for charts; keep the Ask-the-Market search box pinned above the dashboard.
- Click -> prefill: clicking any element sets the search box to a templated question and submits
  to `/api/ask`. One discovery loop across two surfaces.
- Currency toggle (GBP default) re-bases the monetary axes from the native values in each row.
