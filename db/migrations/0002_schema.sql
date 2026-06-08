-- ===========================================================================
-- "Ask the Market" core schema.
-- Deliberate choices:
--   * Normalised facts (relational analytics) + narrative chunks (pgvector) in ONE
--     Postgres, joined at query time. The hybrid query is a single-DB join, not two
--     systems stapled together.
--   * Provenance baked into every fact row (source_report_id, source_page, verified)
--     => citation integrity by design; the model cannot surface an uncited number.
--   * No partitioning. The dataset is hundreds of fact rows + ~10k chunks; partitioning
--     would be the wrong innovation token at this size.
--
--   syndicate_year ─┐ (FK)
--                   ├──< lob_result
--   managing_agent ─┴─< syndicate ─< report ─< report_chunk(embedding, tsv)
-- ===========================================================================

CREATE TABLE managing_agent (
  id    serial PRIMARY KEY,
  name  text NOT NULL UNIQUE
);

CREATE TABLE syndicate (
  syndicate_number  int PRIMARY KEY,                 -- Lloyd's syndicate number, e.g. 2623
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
  syndicate_number   int  NOT NULL REFERENCES syndicate(syndicate_number),
  year_of_account    int  NOT NULL,
  capacity_gbp       numeric,
  gwp_gbp            numeric,                          -- gross written premium
  nwp_gbp            numeric,                          -- net written premium
  combined_ratio     numeric,                          -- < 1.0 = underwriting profit
  result_gbp         numeric,
  return_on_capacity numeric,
  source_report_id   int  REFERENCES report(id),
  source_page        int,
  verified           boolean NOT NULL DEFAULT false,   -- citation reconciled vs the PDF
  PRIMARY KEY (syndicate_number, year_of_account)
);

CREATE TABLE lob_result (
  id                bigserial PRIMARY KEY,
  syndicate_number  int  NOT NULL,
  year_of_account   int  NOT NULL,
  line_of_business  text NOT NULL,
  gwp_gbp           numeric,
  loss_ratio        numeric,
  combined_ratio    numeric,
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
  section    text,                                     -- e.g. 'Active Underwriter Statement'
  text       text NOT NULL,
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  embedding  vector(768)                               -- gemini-embedding-001 @ 768 dims
);

-- Analytical access paths (small table, a few targeted btree indexes).
CREATE INDEX idx_synyear_year      ON syndicate_year (year_of_account);
CREATE INDEX idx_synyear_combined  ON syndicate_year (year_of_account, combined_ratio);
CREATE INDEX idx_synyear_roc       ON syndicate_year (year_of_account, return_on_capacity);
CREATE INDEX idx_lob_line_year     ON lob_result (line_of_business, year_of_account);
CREATE INDEX idx_lob_syn_year      ON lob_result (syndicate_number, year_of_account);

-- Narrative access paths: keyword prefilter (GIN/tsv) + semantic (HNSW/cosine).
CREATE INDEX idx_chunk_report      ON report_chunk (report_id);
CREATE INDEX idx_chunk_tsv         ON report_chunk USING gin (tsv);
CREATE INDEX idx_chunk_embedding   ON report_chunk USING hnsw (embedding vector_cosine_ops);
