import { NextRequest, NextResponse } from "next/server";
import { askMarket } from "@/lib/ask";

// pg + Bedrock need the Node runtime (not edge). Never statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight per-IP rate limit. In-memory (per serverless instance), so it is a
// burst speed-bump for a public demo rather than a distributed limiter: it caps a
// single client hammering one warm instance and guards against an accidental or
// trivial loop driving billable Bedrock spend. RL_MAX requests per RL_WINDOW_MS.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 20;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    // Bound memory: evict arbitrary stale keys if the map grows unexpectedly large.
    for (const k of hits.keys()) { hits.delete(k); if (hits.size <= 4000) break; }
  }
  return recent.length > RL_MAX;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, degraded: true, reason: "Too many requests, please wait a moment and try again.", suggestions: [] },
      { status: 429 }
    );
  }

  let body: { question?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, degraded: true, reason: "invalid JSON body", suggestions: [] },
      { status: 400 }
    );
  }

  // Validate at the boundary: a non-string question coerces to empty and degrades
  // gracefully (a 200 product response), never an HTTP 500.
  const question = typeof body?.question === "string" ? body.question : "";
  const result = await askMarket(question);
  // Degrade is a normal product response, not an HTTP error.
  return NextResponse.json(result, { status: 200 });
}
