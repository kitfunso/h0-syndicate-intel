/**
 * Read-only query path for /api/ask. Defence in depth beyond the app_readonly role:
 * every query runs inside a READ ONLY transaction with a SET LOCAL statement_timeout.
 * Connection pooling is handed to Vercel's attachDatabasePool (Fluid Compute) so
 * serverless invocations reuse connections instead of exhausting Postgres.
 */
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import type { SqlQuery } from "./intents/types";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const cs = process.env.READONLY_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!cs) throw new Error("READONLY_DATABASE_URL (or DATABASE_URL) is not set.");
    // min:1 keeps a warm connection; never set max:1 (kills concurrency on Fluid Compute).
    pool = new Pool({ connectionString: cs, min: 1, idleTimeoutMillis: 5000 });
    try {
      attachDatabasePool(pool);
    } catch {
      // Outside the Vercel runtime (local scripts/tests) the helper is a no-op.
    }
  }
  return pool;
}

export async function execReadOnly(q: SqlQuery): Promise<Record<string, unknown>[]> {
  const timeoutMs = Number(process.env.STATEMENT_TIMEOUT_MS ?? 5000);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query(`SET LOCAL statement_timeout = ${Math.max(100, timeoutMs)}`);
    const res = await client.query(q.text, q.params as unknown[]);
    await client.query("COMMIT");
    return res.rows;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore rollback error */
    }
    throw err;
  } finally {
    client.release();
  }
}
