/**
 * The router: natural-language question -> {intent, params} via Gemini structured
 * output. The model picks from the catalog and fills params. It NEVER writes SQL.
 * Returns null (=> graceful degrade) when nothing maps.
 */
import { generateJson } from "./vertex";
import { catalogPromptSpec } from "./intents/catalog";
import { INTENT_NAMES, type RoutedQuery } from "./intents/types";

const ROUTER_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: [...INTENT_NAMES, "none"] },
    params: { type: "object" },
  },
  required: ["intent", "params"],
} as const;

export async function route(question: string): Promise<RoutedQuery | null> {
  const prompt = [
    "You translate a question about the Lloyd's of London insurance market into a",
    "structured query. Choose exactly one intent from the catalog and fill its params.",
    "If no intent fits, return intent 'none' with empty params. Never invent params.",
    "",
    "INTENT CATALOG:",
    catalogPromptSpec(),
    "",
    `QUESTION: ${question}`,
    "",
    'Return JSON: {"intent": <name|none>, "params": { ... }}',
  ].join("\n");

  const out = await generateJson<{ intent: string; params: Record<string, unknown> }>(
    prompt,
    ROUTER_SCHEMA
  );
  if (!out || out.intent === "none") return null;
  if (!(INTENT_NAMES as readonly string[]).includes(out.intent)) return null;
  return { intent: out.intent as RoutedQuery["intent"], params: out.params ?? {} };
}
