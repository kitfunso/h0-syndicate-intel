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

const RouterSchema = z.object({
  intent: z.enum([...INTENT_NAMES, "none"] as [string, ...string[]]),
  params: z.record(z.any()),
});

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
  ].join("\n");

  const out = await generateJson(prompt, RouterSchema);
  if (!out || out.intent === "none") return null;
  if (!(INTENT_NAMES as readonly string[]).includes(out.intent)) return null;
  return { intent: out.intent as RoutedQuery["intent"], params: (out.params ?? {}) as Record<string, unknown> };
}
