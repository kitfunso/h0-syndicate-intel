/**
 * Integration tests against a REAL Postgres (no mocks). Set TEST_DATABASE_URL (or
 * READONLY_DATABASE_URL) to a migrated database to run. Proves the read-only path
 * actually blocks writes and that the statement timeout fires.
 *
 *   TEST_DATABASE_URL=postgres://app_readonly:...@host/syndicate npm run test:int
 */
import { describe, it, expect, beforeAll } from "vitest";

const url = process.env.TEST_DATABASE_URL ?? process.env.READONLY_DATABASE_URL;

describe.skipIf(!url)("execReadOnly (real DB)", () => {
  let execReadOnly: (q: { text: string; params: unknown[] }) => Promise<Record<string, unknown>[]>;

  beforeAll(async () => {
    process.env.READONLY_DATABASE_URL = url;
    ({ execReadOnly } = await import("../lib/db"));
  });

  it("runs a SELECT", async () => {
    const rows = await execReadOnly({ text: "SELECT 1 AS one", params: [] });
    expect(rows[0].one).toBe(1);
  });

  it("blocks a write (READ ONLY transaction)", async () => {
    await expect(
      execReadOnly({
        text: "CREATE TEMP TABLE should_fail (x int)",
        params: [],
      })
    ).rejects.toThrow();
  });

  it("enforces the statement timeout", async () => {
    process.env.STATEMENT_TIMEOUT_MS = "300";
    await expect(execReadOnly({ text: "SELECT pg_sleep(2)", params: [] })).rejects.toThrow();
  });
});

if (!url) {
  // eslint-disable-next-line no-console
  console.warn("safety.int.test: set TEST_DATABASE_URL to run integration tests against a real DB.");
}
