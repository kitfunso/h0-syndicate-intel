-- ===========================================================================
-- Per-syndicate detail dataset (the dashboard's DRILL-DOWN layer).
-- 11,613 rows extracted via Synth from Lloyd's annual reports. Denormalised +
-- flat: one row per (syndicate, year of account, dataset, segment, metric),
-- native-currency millions. This is the long/tidy companion to syndicate_summary:
-- where the summary holds one headline row per syndicate-year, this holds the
-- breakdowns a single syndicate page charts. Three datasets share the table:
--   underwriting   - GWP + result by business line   (132 syndicates)
--   fair_value     - amount by Level 1/2/3            (111 syndicates)
--   credit_quality - amount by AAA/AA/A/BBB/Below IG  (130 syndicates)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS syndicate_detail (
  syndicate_number int  NOT NULL,
  year_of_account  int  NOT NULL,
  dataset          text NOT NULL,                    -- 'underwriting' | 'fair_value' | 'credit_quality'
  segment          text NOT NULL,                    -- business line, fair-value level, or credit-rating bucket
  metric           text NOT NULL,                    -- 'gwp' | 'result' (underwriting); 'amount' (fair_value, credit_quality)
  value            numeric,                           -- native-currency millions
  currency         text,                              -- native reporting currency: 'GBP','USD','EUR', or null
  PRIMARY KEY (syndicate_number, year_of_account, dataset, segment, metric)
);

-- Read path runs as app_readonly. Default privileges (0003) already cover new
-- tables created by the owner, but grant explicitly for clarity / replay safety.
GRANT SELECT ON syndicate_detail TO app_readonly;
