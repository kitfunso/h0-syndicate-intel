# Demo question set

Questions that exercise every intent in the catalog, with the expected behaviour and the
verified figures the answer must contain. Use these in the video, the judge walkthrough,
and as the post-deploy smoke test for the Ask box.

Verified dataset: **25 syndicates** (2023 AR + 2022 comparatives), every figure
reconciled against its PDF. Includes Canopius 4444, MS Amlin 2001, AXIS 1686, Talbot
1183, Ascot 1414, RenaissanceRe 1458, AXA XL 2003, Munich Re 457, Inigo 1301, Nephila
2357 and 15 more. GBP and USD filers, GBP-normalised for comparison.

## The hero (growers_improvers)

1. **"Which syndicates grew premium while improving their combined ratio in 2023?"**
   18 qualify (like-for-like ratio bases only). Top by GBP growth: Canopius +£346.3m
   (CR 96.2 -> 87.3), Inigo +£235.7m (92.1 -> 85.4, USD, 36% growth), MS Amlin +£171.9m
   (96.2 -> 86.6), Munich Re +£171.4m (87.6 -> 84.6), AXIS +£146.9m (90.0 -> 87.5).
   Every row cited. Note: Starr 1919 is correctly EXCLUDED (its 2022 CR is on an
   excluding-LPT basis, so the comparison is not like-for-like).

## Analytical

2. **"Rank syndicates by combined ratio in 2023"** (rank_syndicates)
   Nephila 25.5 (genuine: cat-ILS profit year), RenaissanceRe 73.8, Asta 2525 75.1,
   W R Berkley 77.9, Starr 79.7, Probitas 79.8...
3. **"Which syndicate wrote the most premium in 2023?"** (rank_syndicates, gwp)
   Canopius £2,044.5m; MS Amlin £1,748.7m; Ascot £1,440.9m; AXIS $1,760.0m (~£1,415m).
4. **"Compare Canopius, MS Amlin and AXIS in 2023"** (compare)
   Side-by-side CR + GWP + NEP, AXIS flagged USD.
5. **"How does Talbot rank against its peers on combined ratio?"** (peer_percentile)
   Percentile from mv_peer_percentiles across 25 peers, cited to Talbot's page 5.
6. **"Give me a market overview for 2023"** (market_overview)
   25 syndicates, average CR 82.7, median 85.5, total GWP £18,473m GBP-normalised
   (roughly a third of the whole Lloyd's market).

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
