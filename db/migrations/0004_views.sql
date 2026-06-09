-- ===========================================================================
-- Materialised views push analytical compute into the DB.
--   * Peer percentiles -> tearsheet "top quartile" badges + screener filters.
--   * YoY trend deltas  -> the hero "grew GWP while improving combined ratio" query.
-- Static dataset, so REFRESH once after the seed/ETL (no live refresh needed).
-- All monetary ranking is on the GBP-normalised columns.
-- ===========================================================================

-- Percentile rank of each syndicate within its year, per metric.
-- Lower combined_ratio is better (rank ascending); larger GWP ranks higher.
CREATE MATERIALIZED VIEW mv_peer_percentiles AS
SELECT
  syndicate_number,
  year_of_account,
  combined_ratio,
  gwp_gbp,
  percent_rank() OVER (PARTITION BY year_of_account ORDER BY combined_ratio ASC NULLS LAST) AS combined_ratio_pctile,
  percent_rank() OVER (PARTITION BY year_of_account ORDER BY gwp_gbp DESC NULLS LAST)        AS gwp_pctile
FROM syndicate_year;

CREATE UNIQUE INDEX idx_mv_pct ON mv_peer_percentiles (syndicate_number, year_of_account);

-- Year-over-year deltas per syndicate (GBP-normalised GWP growth, combined-ratio improvement).
-- combined_ratio_improvement > 0 means the ratio FELL (got better).
CREATE MATERIALIZED VIEW mv_syndicate_trend AS
SELECT
  syndicate_number,
  year_of_account,
  gwp_gbp,
  combined_ratio,
  gwp_gbp - lag(gwp_gbp)   OVER w                       AS gwp_gbp_delta,
  CASE WHEN lag(gwp_gbp) OVER w > 0
       THEN (gwp_gbp - lag(gwp_gbp) OVER w) / lag(gwp_gbp) OVER w END AS gwp_growth,
  lag(combined_ratio) OVER w - combined_ratio           AS combined_ratio_improvement
FROM syndicate_year
WINDOW w AS (PARTITION BY syndicate_number ORDER BY year_of_account);

CREATE UNIQUE INDEX idx_mv_trend ON mv_syndicate_trend (syndicate_number, year_of_account);

GRANT SELECT ON mv_peer_percentiles, mv_syndicate_trend TO app_readonly;
