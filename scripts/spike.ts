/**
 * Day 1-3 GO/NO-GO harness. Runs one analytical, one trend, and one qualitative
 * question end-to-end through the real pipeline (router -> validate -> query ->
 * compose) and prints the cited answers.
 *
 * GATE: all three return a sensible, CITED answer whose numbers reconcile to the
 * source reports. If yes -> proceed to the full catalog. If no -> rescope.
 *
 *   npm run spike
 */
import { config } from "dotenv";
import { askMarket } from "../lib/ask";

config({ path: ".env.local" }); // Next.js convention; falls back to .env below
config();

const QUESTIONS = [
  "Rank syndicates by combined ratio for 2023",
  "Show syndicate 2623's gross written premium from 2020 to 2024",
  "What are syndicates saying about cyber rate adequacy?",
];

async function main() {
  for (const q of QUESTIONS) {
    console.log("\n=== Q:", q);
    const r = await askMarket(q);
    if (!r.ok) {
      console.log("DEGRADED:", r.reason);
      continue;
    }
    console.log("intent:", r.intent);
    console.log("answer:", r.answer);
    console.log("citations:", JSON.stringify(r.citations, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
