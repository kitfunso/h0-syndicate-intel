/**
 * Integration tests (real DB, no mocks) for the display-currency + narrative-quote
 * helpers behind the toggles and the editorial peek. Set TEST_DATABASE_URL (or
 * READONLY_DATABASE_URL) to a migrated + seeded database to run.
 *
 *   TEST_DATABASE_URL=postgres://app_readonly:...@host/syndicate npm run test:int
 */
import { describe, it, expect, beforeAll } from "vitest";

const url = process.env.TEST_DATABASE_URL ?? process.env.READONLY_DATABASE_URL;

describe.skipIf(!url)("fx + quotes (real DB)", () => {
  let getDisplayRate: typeof import("../lib/fx").getDisplayRate;
  let getReportQuotes: typeof import("../lib/quotes").getReportQuotes;

  beforeAll(async () => {
    process.env.READONLY_DATABASE_URL = url;
    ({ getDisplayRate } = await import("../lib/fx"));
    ({ getReportQuotes } = await import("../lib/quotes"));
  });

  it("GBP display rate is exactly 1", async () => {
    expect(await getDisplayRate("GBP", 2023)).toBe(1);
  });

  it("USD/EUR display rates invert rate_to_gbp", async () => {
    expect(await getDisplayRate("USD", 2023)).toBeCloseTo(1 / 0.8039, 3); // ~1.2439
    expect(await getDisplayRate("EUR", 2023)).toBeCloseTo(1 / 0.8696, 3); // ~1.1500
  });

  it("falls back to 1 when no rate is seeded for the year", async () => {
    expect(await getDisplayRate("USD", 2099)).toBe(1);
  });

  it("returns a cited narrative quote per syndicate, cover pages excluded", async () => {
    const q = await getReportQuotes([2001, 1414]);
    expect((q[2001]?.text.length ?? 0)).toBeGreaterThan(50);
    expect(q[2001]?.page_no).not.toBeNull();
    expect(q[2001]?.text ?? "").not.toMatch(/Annual Report and Accounts/i);
  });

  it("returns an empty map for no syndicates", async () => {
    expect(await getReportQuotes([])).toEqual({});
  });
});

if (!url) {
  // eslint-disable-next-line no-console
  console.warn("fx-quotes.int.test: set TEST_DATABASE_URL to run against a real DB.");
}
