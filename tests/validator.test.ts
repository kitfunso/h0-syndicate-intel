/**
 * Unit tests for the safety gate. No DB needed: these prove the validator rejects
 * anything off the allowlist BEFORE a query is ever built.
 */
import { describe, it, expect } from "vitest";
import { validateRouted } from "../lib/intents/validator";

describe("validateRouted", () => {
  it("accepts a well-formed rank_syndicates query", () => {
    const r = validateRouted({
      intent: "rank_syndicates",
      params: { metric: "combined_ratio", year_of_account: 2023, order: "asc" },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown intent", () => {
    const r = validateRouted({ intent: "drop_everything", params: {} });
    expect(r.ok).toBe(false);
  });

  it("rejects an off-allowlist metric (SQL injection attempt via column name)", () => {
    const r = validateRouted({
      intent: "rank_syndicates",
      params: { metric: "gwp_gbp; DROP TABLE syndicate; --", year_of_account: 2023 },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects a wrong-typed param (string where int expected)", () => {
    const r = validateRouted({
      intent: "trend",
      params: { syndicate_number: "2623 OR 1=1", metric: "gwp_gbp", year_from: 2020, year_to: 2024 },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects an out-of-range year", () => {
    const r = validateRouted({
      intent: "rank_syndicates",
      params: { metric: "gwp_gbp", year_of_account: 9999 },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects an overlong narrative topic", () => {
    const r = validateRouted({
      intent: "narrative_search",
      params: { topic: "x".repeat(1000) },
    });
    expect(r.ok).toBe(false);
  });

  it("accepts narrative_search with a keyword anchor", () => {
    const r = validateRouted({
      intent: "narrative_search",
      params: { topic: "social inflation in casualty", keyword: "casualty" },
    });
    expect(r.ok).toBe(true);
  });
});
