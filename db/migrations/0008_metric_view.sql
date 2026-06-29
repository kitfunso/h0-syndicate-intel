-- 0008_metric_view.sql
-- Unifies the cited depth layer (syndicate_year: 25 syndicates, 2022/2023, page-cited,
-- GBP-normalised, reconciled vs the source PDF) with the breadth layer (syndicate_summary:
-- 132 syndicates, 2020-2025, native currency, extracted) into ONE view the Ask intents
-- can query. For a cited syndicate-year the reconciled syndicate_year values + page numbers
-- win (COALESCE prefers sy.*); every other syndicate-year contributes its extracted figures.
-- combined_ratio is currency-neutral, so it covers all 132. Monetary values are GBP-normalised
-- where an fx_rate exists (the cited years + all GBP filers); elsewhere gbp is NULL and those
-- rows simply sort last in a cross-currency ranking. The `cited` flag lets the research desk
-- keep its 25-syndicate scope (WHERE cited) while the Ask box opens up to all 132.
CREATE OR REPLACE VIEW v_syndicate_metric AS
SELECT
  ss.syndicate_number,
  COALESCE(s.name, ss.managing_agent)              AS name,
  ss.year_of_account,
  ss.currency,
  COALESCE(sy.combined_ratio, ss.combined_ratio)   AS combined_ratio,
  sy.combined_ratio_adjusted                       AS combined_ratio_adjusted,
  COALESCE(sy.gwp_native, ss.gwp_native)           AS gwp_native,
  COALESCE(sy.nep_native, ss.nep_native)           AS nep_native,
  COALESCE(sy.gwp_gbp,
    CASE WHEN ss.currency = 'GBP' THEN ss.gwp_native
         ELSE ss.gwp_native * fx.rate_to_gbp END)  AS gwp_gbp,
  COALESCE(sy.nep_gbp,
    CASE WHEN ss.currency = 'GBP' THEN ss.nep_native
         ELSE ss.nep_native * fx.rate_to_gbp END)  AS nep_gbp,
  sy.combined_ratio_page,
  sy.gwp_page,
  sy.nep_page,
  sy.source_report_id,
  COALESCE(sy.verified, false)                     AS verified,
  (sy.syndicate_number IS NOT NULL)                AS cited
FROM syndicate_summary ss
LEFT JOIN syndicate_year sy USING (syndicate_number, year_of_account)
LEFT JOIN syndicate s ON s.syndicate_number = ss.syndicate_number
LEFT JOIN fx_rate fx ON fx.currency = ss.currency AND fx.year_of_account = ss.year_of_account;

GRANT SELECT ON v_syndicate_metric TO app_readonly;
