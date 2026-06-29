/**
 * The router: natural-language question -> {intent, params} via Claude on Bedrock,
 * with the Vercel AI SDK enforcing the output schema. The model picks from the catalog
 * and fills params. It NEVER writes SQL. Returns null (=> graceful degrade) when
 * nothing maps.
 */
import { z } from "zod";
import { generateJson } from "./llm";
import { catalogPromptSpec } from "./intents/catalog";
import { INTENT_NAMES, type RoutedQuery } from "./intents/types";
import { execReadOnly } from "./db";

const RouterSchema = z.object({
  intent: z.enum([...INTENT_NAMES, "none"] as [string, ...string[]]),
  params: z.record(z.any()),
});

// Memoised syndicate directory (number -> managing agent), injected into the router
// prompt so the model can resolve a syndicate NAME to its number for any of the ~130
// syndicates, not only the handful it knows by heart. Fetched once per server instance.
let directoryPromise: Promise<string> | null = null;
function syndicateDirectory(): Promise<string> {
  if (!directoryPromise) {
    directoryPromise = execReadOnly({
      text: `SELECT ss.syndicate_number AS n, COALESCE(max(s.name), max(ss.managing_agent)) AS name
             FROM syndicate_summary ss LEFT JOIN syndicate s USING (syndicate_number)
             GROUP BY ss.syndicate_number ORDER BY ss.syndicate_number`,
      params: [],
    })
      .then((rows) => rows.map((r) => `${r.n}=${r.name}`).join("; "))
      .catch(() => "");
  }
  return directoryPromise;
}

export async function route(question: string): Promise<RoutedQuery | null> {
  const directory = await syndicateDirectory();
  const prompt = [
    "You translate a question about the Lloyd's of London insurance market into a",
    "structured query. Choose exactly one intent from the catalog and fill its params.",
    "If no intent fits, return intent 'none' with empty params. Never invent params.",
    "Year coverage is 2020-2025 for per-syndicate metrics. Resolve any syndicate name to",
    "its number using the directory below; if a brand has several syndicates, pick the",
    "lowest-numbered principal one unless the question names a specific number.",
    "",
    "INTENT CATALOG:",
    catalogPromptSpec(),
    "",
    "SYNDICATE DIRECTORY (syndicate_number=managing agent):",
    directory,
    "",
    `QUESTION: ${question}`,
  ].join("\n");

  const out = await generateJson(prompt, RouterSchema);
  if (!out || out.intent === "none") return null;
  if (!(INTENT_NAMES as readonly string[]).includes(out.intent)) return null;
  return { intent: out.intent as RoutedQuery["intent"], params: (out.params ?? {}) as Record<string, unknown> };
}
