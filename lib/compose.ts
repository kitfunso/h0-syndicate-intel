/**
 * Composer: turns query rows + retrieved narrative into a concise, CITED answer.
 * Hard rule in the prompt: only use numbers present in the rows, and cite each with
 * [n]. The UI renders [n] as a clickable link to the source report page. The model
 * cannot introduce a figure that is not already grounded in a fact row.
 */
import { composeText } from "./vertex";
import type { AskRow, Citation, IntentName } from "./intents/types";

export async function compose(
  question: string,
  intent: IntentName,
  rows: AskRow[],
  citations: Citation[]
): Promise<string> {
  if (!rows.length) {
    return "No data found for that question in the loaded syndicate set.";
  }
  const rowsForModel = rows.map((r, i) => ({ ...r, _ref: i + 1 }));
  const prompt = [
    "You are a Lloyd's market analyst. Answer the question using ONLY the data rows below.",
    "Rules:",
    "- Use only numbers that appear in the rows. Never invent or estimate a figure.",
    "- After every figure, cite its row with [n] using the row's _ref number.",
    "- Be concise: a 2-4 sentence answer, then a short ranked list if relevant.",
    "- If the rows do not actually answer the question, say so plainly.",
    "",
    `QUESTION: ${question}`,
    `INTENT: ${intent}`,
    `ROWS (JSON): ${JSON.stringify(rowsForModel)}`,
  ].join("\n");
  return composeText(prompt);
}
