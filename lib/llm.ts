/**
 * LLM + embeddings via the Vercel AI SDK on AWS Bedrock. Sponsor-aligned (Vercel +
 * AWS), one cloud (same AWS account as Aurora), no third provider.
 *   - generateJson: structured output for the intent ROUTER. The AI SDK enforces the
 *     zod schema natively (Bedrock tool-use), so the model can only emit a valid spec.
 *   - composeText:  prose composition for the cited answer (Claude on Bedrock).
 *   - embedTexts / embedQuery: Titan Text Embeddings v2 (1024-dim) for pgvector.
 *
 * Auth: the Bedrock provider reads the standard AWS credential chain
 * (AWS_REGION + AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, or a profile, or the Vercel
 * AWS integration's OIDC in production). Enable model access for Claude + Titan in
 * the Bedrock console first.
 */
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { generateObject, generateText, embed, embedMany } from "ai";
import type { z } from "zod";

const CHAT_MODEL = process.env.BEDROCK_CHAT_MODEL ?? "us.anthropic.claude-sonnet-4-6";
const EMBED_MODEL = process.env.BEDROCK_EMBED_MODEL ?? "amazon.titan-embed-text-v2:0";

export async function generateJson<T>(prompt: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const { object } = await generateObject({ model: bedrock(CHAT_MODEL), schema, prompt, temperature: 0 });
    return object as T;
  } catch {
    return null; // -> graceful degrade upstream
  }
}

export async function composeText(prompt: string): Promise<string> {
  const { text } = await generateText({ model: bedrock(CHAT_MODEL), prompt, temperature: 0.2 });
  return text ?? "";
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const { embeddings } = await embedMany({
    model: bedrock.textEmbeddingModel(EMBED_MODEL),
    values: texts,
  });
  return embeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: bedrock.textEmbeddingModel(EMBED_MODEL), value: text });
  return embedding;
}
