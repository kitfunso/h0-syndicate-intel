/**
 * Real narrative quotes for the editorial peek, via the tsvector keyword index on
 * report_chunk. No embeddings needed (works offline / before Bedrock), so it complements
 * the semantic narrative_search path. Picks the most performance-relevant substantive
 * passage per syndicate.
 */
import { execReadOnly } from "./db";

export type ReportQuote = {
  syndicate_number: number;
  page_no: number | null;
  section: string | null;
  text: string;
};

// OR-joined lexemes: match any performance term, then rank by density.
const TQ = "premium | growth | result | results | underwriting | performance | combined | profit | rate | rates";

export async function getReportQuotes(synNums: number[]): Promise<Record<number, ReportQuote>> {
  if (!synNums.length) return {};
  const rows = await execReadOnly({
    text: `
      SELECT DISTINCT ON (r.syndicate_number)
             r.syndicate_number, rc.page_no, rc.section, rc.text
      FROM report_chunk rc JOIN report r ON r.id = rc.report_id
      WHERE r.syndicate_number = ANY($1::int[])
        AND length(rc.text) > 300
        AND rc.text NOT ILIKE '%Annual Report and Accounts%'
        AND rc.tsv @@ to_tsquery('english', $2)
      ORDER BY r.syndicate_number, ts_rank(rc.tsv, to_tsquery('english', $2)) DESC`,
    params: [synNums, TQ],
  });
  const out: Record<number, ReportQuote> = {};
  for (const r of rows as Array<Record<string, unknown>>) {
    out[Number(r.syndicate_number)] = {
      syndicate_number: Number(r.syndicate_number),
      page_no: r.page_no == null ? null : Number(r.page_no),
      section: r.section == null ? null : String(r.section),
      text: String(r.text),
    };
  }
  return out;
}
