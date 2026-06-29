/**
 * Display name from a managing-agent legal name. Strips TRAILING corporate-suffix
 * words and keeps the rest, so a firm whose brand is itself made of suffix-like words
 * survives: "Managing Agency Partners Limited" -> "Managing Agency Partners", while
 * "Hiscox Syndicates Limited" -> "Hiscox" and "Talbot Underwriting Limited" -> "Talbot".
 * (The old approach broke at the first suffix word and collapsed MAP to just "Managing".)
 */
const SUFFIX = new Set([
  "Underwriting", "Managing", "Syndicates", "Syndicate", "Agency", "Agencies",
  "Management", "Limited", "Ltd", "Holdings", "Group",
]);

export function shortName(full: string): string {
  const words = full.trim().split(/\s+/);
  while (words.length > 1 && SUFFIX.has(words[words.length - 1].replace(/[(),.]/g, ""))) {
    words.pop();
  }
  return words.join(" ");
}
