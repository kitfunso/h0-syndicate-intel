/**
 * Orchestrates one "Ask the Market" turn:
 *   route -> validate -> run named query (+ scoped retrieval) -> compose cited answer.
 * Any failure to map the question degrades gracefully instead of crashing.
 *
 *   question
 *     -> route (Gemini structured output) => {intent, params}   [no SQL from the model]
 *     -> validate against catalog (allowlist)                   [reject => degrade]
 *     -> CATALOG[intent].run(params, ctx)                       [read-only, timeout, LIMIT]
 *     -> compose(rows, citations)                               [numbers from rows only]
 */
import { route } from "./router";
import { validateRouted } from "./intents/validator";
import { CATALOG } from "./intents/catalog";
import { compose } from "./compose";
import { execReadOnly } from "./db";
import { embedQuery } from "./llm";
import { rowLimit, type AskResult, type IntentContext } from "./intents/types";

// Every suggestion targets the queryable cited set (Talbot 1183 is verified for
// 2022/2023), so the recovery affordance never dead-ends on an out-of-set syndicate.
const SUGGESTIONS = [
  "Rank syndicates by combined ratio for 2023",
  "Show Talbot's combined ratio for 2022 and 2023",
  "What are syndicates saying about social inflation in casualty?",
];

export async function askMarket(question: string): Promise<AskResult> {
  const q = (question ?? "").trim();
  if (q.length < 3) {
    return { ok: false, degraded: true, reason: "empty question", suggestions: SUGGESTIONS };
  }

  const routed = await route(q);
  if (!routed) {
    return {
      ok: false,
      degraded: true,
      reason: "I could not map that to a question I can answer yet.",
      suggestions: SUGGESTIONS,
    };
  }

  const valid = validateRouted(routed);
  if (!valid.ok) {
    return { ok: false, degraded: true, reason: valid.reason, suggestions: SUGGESTIONS };
  }

  // The Ask box opens up to the full breadth layer: every extracted syndicate (~130),
  // not just the page-cited 25. Cited rows still carry their page citations.
  const ctx: IntentContext = { execReadOnly, embedQuery, rowLimit: rowLimit(), scope: "all" };

  let result: Awaited<ReturnType<(typeof CATALOG)[typeof valid.intent]["run"]>>;
  try {
    result = await CATALOG[valid.intent].run(valid.params, ctx);
  } catch (err) {
    return {
      ok: false,
      degraded: true,
      reason: `query failed: ${(err as Error).message}`,
      suggestions: SUGGESTIONS,
    };
  }

  // A successful query that finds nothing is a dead-end, not an answer: degrade and
  // re-offer recovery suggestions instead of returning a bare "no data" with ok:true.
  if (!result.rows || result.rows.length === 0) {
    return {
      ok: false,
      degraded: true,
      reason: "No data found for that question in the loaded syndicate set.",
      suggestions: SUGGESTIONS,
    };
  }

  // compose() invokes Bedrock; a transient model failure must degrade gracefully
  // (consistent with route() and the intent run above), never bubble to an HTTP 500.
  let answer: string;
  try {
    answer = await compose(q, valid.intent, result.rows, result.citations);
  } catch {
    return {
      ok: false,
      degraded: true,
      reason: "I found the figures but could not compose an answer just now. Please try again.",
      suggestions: SUGGESTIONS,
    };
  }
  return { ok: true, intent: valid.intent, answer, rows: result.rows, citations: result.citations };
}
