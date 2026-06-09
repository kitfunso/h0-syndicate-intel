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

const SUGGESTIONS = [
  "Rank syndicates by combined ratio for 2023",
  "Show Beazley's gross written premium from 2020 to 2024",
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

  const ctx: IntentContext = { execReadOnly, embedQuery, rowLimit: rowLimit() };

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

  const answer = await compose(q, valid.intent, result.rows, result.citations);
  return { ok: true, intent: valid.intent, answer, rows: result.rows, citations: result.citations };
}
