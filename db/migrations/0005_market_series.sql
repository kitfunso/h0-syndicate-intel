-- ===========================================================================
-- Market-aggregate context series (the dashboard's MACRO layer).
-- Lloyd's market-wide 2016-2024 figures transcribed from the market opportunity
-- deck. This is CONTEXT data: it is NOT per-syndicate and is NEVER cited to a
-- source PDF page (unlike syndicate_year). Tidy/long shape so heterogeneous
-- series (single, multi-category, mixed-unit) all fit one table.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS market_series (
  id            bigserial PRIMARY KEY,
  series_key    text    NOT NULL,                 -- e.g. 'gwp_by_line'
  series_label  text    NOT NULL,                 -- chart title
  category      text    NOT NULL DEFAULT '',      -- sub-series ('' = single series)
  year          int     NOT NULL,
  value         numeric NOT NULL,
  unit          text    NOT NULL,                 -- 'gbp_bn' | 'pct' | 'ratio' | 'bps' | 'index'
  chart_type    text,                             -- frontend hint: 'column'|'stacked_area'|'line'|'stacked_column'
  source_slide  int,                              -- provenance: deck slide
  source_note   text    NOT NULL DEFAULT 'Lloyd''s market aggregate (2016-2024)',
  UNIQUE (series_key, category, year)
);

CREATE INDEX IF NOT EXISTS idx_market_series_key ON market_series (series_key);

-- Read path runs as app_readonly. Default privileges (0003) already cover new
-- tables created by the owner, but grant explicitly for clarity / replay safety.
GRANT SELECT ON market_series TO app_readonly;
