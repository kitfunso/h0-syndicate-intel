/**
 * Vertex AI client (the agent brain + embeddings). H0 compliance: Gemini routed
 * through Vertex (vertexai: true), not the AI Studio endpoint.
 *   - generateJson: structured output for the intent ROUTER (model never emits SQL).
 *   - composeText:  prose composition for the cited answer.
 *   - embedTexts:   gemini-embedding-001 @ 768 dims for narrative chunks + queries.
 */
import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!client) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) throw new Error("GOOGLE_CLOUD_PROJECT is not set.");
    const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
    client = new GoogleGenAI({ vertexai: true, project, location });
  }
  return client;
}

// Set GEMINI_MODEL to the current Gemini 3 flash ID in your Vertex Model Garden.
const CHAT_MODEL = process.env.GEMINI_MODEL ?? "gemini-3-flash";
const EMBED_MODEL = process.env.EMBED_MODEL ?? "gemini-embedding-001";
const EMBED_DIM = Number(process.env.EMBED_DIM ?? 768);

export async function generateJson<T = unknown>(
  prompt: string,
  responseSchema: object
): Promise<T | null> {
  const res = await ai().models.generateContent({
    model: CHAT_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema, temperature: 0 },
  });
  const text = res.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function composeText(prompt: string): Promise<string> {
  const res = await ai().models.generateContent({
    model: CHAT_MODEL,
    contents: prompt,
    config: { temperature: 0.2 },
  });
  return res.text ?? "";
}

export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) {
    const res = await ai().models.embedContent({
      model: EMBED_MODEL,
      contents: t,
      config: { taskType, outputDimensionality: EMBED_DIM },
    });
    const values = res.embeddings?.[0]?.values;
    if (!values || !values.length) throw new Error("embedContent returned no vector");
    out.push(values);
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  return (await embedTexts([text], "RETRIEVAL_QUERY"))[0];
}
