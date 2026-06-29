-- ===========================================================================
-- Full-market syndicate summary (the dashboard's BREADTH layer).
-- 132 syndicates x 2020-2025 (641 rows) extracted via Synth from Lloyd's
-- annual reports. Denormalised + flat: one row per (syndicate, year of account),
-- native-currency millions (gwp is mostly null in this dataset). Unlike
-- syndicate_year (the small, per-figure-cited spike set), this is the wide
-- coverage table; a row is flagged `cited` only when its syndicate has a
-- verified syndicate_year entry (figures reconciled against a source PDF).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS syndicate_summary (
  syndicate_number    int     NOT NULL,
  managing_agent      text,
  year_of_account     int     NOT NULL,
  currency            text,                            -- native reporting currency: 'GBP','USD','EUR', or null
  combined_ratio      numeric,
  nep_native          numeric,                         -- net earned premium, native currency, millions
  gwp_native          numeric,                         -- gross written premium, native millions (mostly null here)
  profit_native       numeric,                         -- result for the year, native millions
  total_assets_native numeric,                         -- total assets, native millions
  cited               boolean NOT NULL DEFAULT false,  -- true => syndicate has a verified syndicate_year row
  PRIMARY KEY (syndicate_number, year_of_account)
);

-- Read path runs as app_readonly. Default privileges (0003) already cover new
-- tables created by the owner, but grant explicitly for clarity / replay safety.
GRANT SELECT ON syndicate_summary TO app_readonly;
