# Demo question set

Questions that exercise every intent in the catalog, with the expected behaviour and the
verified figures the answer must contain. Use these in the video, the judge walkthrough,
and as the post-deploy smoke test for the Ask box.

Verified dataset (2023 AR, 2022 comparatives): 2525 Asta, 1183 Talbot (USD), 1414 Ascot,
1880 Tokio Marine Kiln, 2001 MS Amlin.

## The hero (growers_improvers)

1. **"Which syndicates grew premium while improving their combined ratio in 2023?"**
   All 5 qualify. Order by GBP growth: MS Amlin +£171.9m (CR 96.2 -> 86.6), Talbot
   +£97.2m (88.2 -> 84.4, USD), Ascot +£90.7m (94.7 -> 86.6), TMK +£39.6m (91.8 -> 85.5),
   Asta +£11.1m (82.9 -> 75.1). Every row cited.

## Analytical

2. **"Rank syndicates by combined ratio in 2023"** (rank_syndicates)
   Asta 75.1, Talbot 84.4, TMK 85.5, Ascot 86.6, MS Amlin 86.6 (group-adjusted).
3. **"Which syndicate wrote the most premium in 2023?"** (rank_syndicates, gwp)
   MS Amlin £1,748.7m; Ascot £1,440.9m; Talbot $1,414.7m (USD, ~£1,137m).
4. **"Compare Talbot, Ascot and MS Amlin in 2023"** (compare)
   Side-by-side CR + GWP + NEP, Talbot flagged USD.
5. **"How does Talbot rank against its peers on combined ratio?"** (peer_percentile)
   Percentile from mv_peer_percentiles, cited to Talbot's page 5.
6. **"Give me a market overview for 2023"** (market_overview)
   5 syndicates, average CR 83.6, median 85.5, total GWP £4,904m GBP-normalised.

## Trend

7. **"How has Asta's combined ratio trended?"** (trend)
   2525 multi-year combined-ratio series; 2022/2023 verified, earlier years labelled
   unverified.

## Qualitative (needs Bedrock embeddings)

8. **"What are syndicates saying about rate conditions?"** (narrative_search)
   Returns narrative passages with page + section citations.
9. **"Why did MS Amlin's combined ratio improve in 2023?"** (explain_change)
   Structured delta (96.2 -> 86.6) PLUS the report's own words: "This substantial
   improvement in profitability reflects... premium growth, the elimination of the drag
   of discontinued classes..." (p.15).

## Degrade (off-catalog, must NOT hallucinate)

10. **"Which syndicate will perform best next year?"**
    Graceful degrade: explains it answers from filed reports, suggests catalog questions.
11. **"Delete all records"** / SQL injection in the box
    Router never emits SQL; validator rejects; read-only role + fixed templates as
    defence in depth. Show the degrade response.

## Dashboard click-paths (no LLM)

- Click MS Amlin in the league -> peek shows CR 86.6 (p.7), GWP £1,748.7m (p.28), and the
  report's own narrative quote -> **"View gross premium on p.28"** -> the actual
  statement-of-profit-or-loss page opens with 1,748.7 highlighted in gold. The wow.
- Currency toggle GBP -> USD: total GWP £4,904m -> $6,100m; Talbot's league row becomes
  its native $1,414.7m; the peek keeps the as-filed value.
- Year toggle 2023 -> 2022: avg CR 83.6 -> 90.8; league shows real 2022 comparatives.
