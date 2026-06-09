-- ===========================================================================
-- "Ask the Market" core schema.
-- Deliberate choices:
--   * Normalised facts (relational analytics) + narrative chunks (pgvector) in ONE
--     Postgres, joined at query time. The hybrid query is a single-DB join.
--   * Figures stored in NATIVE currency + a precomputed GBP value. Reports are filed
--     in mixed currencies/units (GBP '000, USD millions, ...). We keep the native
--     value (what the PDF literally prints, for citation) AND a GBP-normalised value
--     (for cross-syndicate ranking). A currency toggle re-bases display from native.
--   * Per-figure provenance (page numbers) + a `verified` flag => citation integrity
--     by design; the model cannot surface an uncited number.
--   * No partitioning. Hundreds of fact rows + ~10k chunks; partitioning is the wrong
--     innovation token at this size.
--
--   syndicate_year ─┐ (FK)
--                   ├──< lob_result
--   managing_agent ─┴─< syndicate ─< report ─< report_chunk(embedding, tsv)
--   fx_rate (currency, year) -> GBP normalisation + arbitrary-currency toggle
-- ===========================================================================

CREATE TABLE managing_agent (
  id    serial PRIMARY KEY,
  name  text NOT NULL UNIQUE
);

CREATE TABLE syndicate (
  syndicate_number  int PRIMARY KEY,                 -- Lloyd's syndicate number, e.g. 1183
  name              text NOT NULL,
  managing_agent_id int REFERENCES managing_agent(id),
  inception_year    int
);

CREATE TABLE report (
  id               serial PRIMARY KEY,
  syndicate_number int NOT NULL REFERENCES syndicate(syndicate_number),
  year_of_account  int NOT NULL,
  title            text,
  source_url       text,
  n_pages          int,
  UNIQUE (syndicate_number, year_of_account)
);

CREATE TABLE syndicate_year (
  syndicate_number        int  NOT NULL REFERENCES syndicate(syndicate_number),
  year_of_account         int  NOT NULL,
  currency                text,                       -- report's native currency: 'GBP','USD',...
  combined_ratio          numeric,                    -- unitless %, comparable across currencies
  combined_ratio_adjusted boolean NOT NULL DEFAULT false,
  combined_ratio_page     int,
  gwp_native              numeric,                    -- gross written premium, native ccy, MILLIONS
  gwp_gbp                 numeric,                    -- normalised: gwp_native * fx_rate
  gwp_page                int,
  nep_native              numeric,                    -- net earned premium, native ccy, MILLIONS
  nep_gbp                 numeric,
  nep_page                int,
  source_report_id        int  REFERENCES report(id),
  verified                boolean NOT NULL DEFAULT false,  -- figures reconciled vs the PDF
  PRIMARY KEY (syndicate_number, year_of_account)
);

CREATE TABLE lob_result (
  id                bigserial PRIMARY KEY,
  syndicate_number  int  NOT NULL,
  year_of_account   int  NOT NULL,
  line_of_business  text NOT NULL,
  gwp_native        numeric,
  gwp_gbp           numeric,
  loss_ratio        numeric,
  currency          text,
  source_report_id  int REFERENCES report(id),
  source_page       int,
  verified          boolean NOT NULL DEFAULT false,
  FOREIGN KEY (syndicate_number, year_of_account)
    REFERENCES syndicate_year(syndicate_number, year_of_account),
  UNIQUE (syndicate_number, year_of_account, line_of_business)
);

CREATE TABLE report_chunk (
  id         bigserial PRIMARY KEY,
  report_id  int NOT NULL REFERENCES report(id),
  page_no    int,
  section    text,                                     -- e.g. 'Managing Agent's Report'
  text       text NOT NULL,
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  embedding  vector(768)                               -- gemini-embedding-001 @ 768 dims
);

-- Currency normalisation: multiply a native-currency amount by rate_to_gbp to get GBP.
-- GBP rows are 1.0. Enables both GBP-default ranking and an arbitrary-currency toggle
-- (native -> GBP -> target).
CREATE TABLE fx_rate (
  currency        text NOT NULL,
  year_of_account int  NOT NULL,
  rate_to_gbp     numeric NOT NULL,
  PRIMARY KEY (currency, year_of_account)
);

-- Analytical access paths (small table, targeted btree indexes).
CREATE INDEX idx_synyear_year     ON syndicate_year (year_of_account);
CREATE INDEX idx_synyear_combined ON syndicate_year (year_of_account, combined_ratio);
CREATE INDEX idx_synyear_gwp      ON syndicate_year (year_of_account, gwp_gbp);
CREATE INDEX idx_lob_line_year    ON lob_result (line_of_business, year_of_account);

-- Narrative access paths: keyword prefilter (GIN/tsv) + semantic (HNSW/cosine).
CREATE INDEX idx_chunk_report     ON report_chunk (report_id);
CREATE INDEX idx_chunk_tsv        ON report_chunk USING gin (tsv);
CREATE INDEX idx_chunk_embedding  ON report_chunk USING hnsw (embedding vector_cosine_ops);
