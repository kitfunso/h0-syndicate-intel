import { NextRequest, NextResponse } from "next/server";
import { buildDashboard } from "@/lib/dashboard";

// pg needs the Node runtime (not edge). Never statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function intParam(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
}

// GET /api/dashboard?year=2023&from=2022&to=2023&limit=12
// Deterministic, read-only, LLM-free chart data for the discovery dashboard.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const payload = await buildDashboard({
      year: intParam(sp.get("year")),
      yearFrom: intParam(sp.get("from")),
      yearTo: intParam(sp.get("to")),
      limit: intParam(sp.get("limit")),
    });
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, degraded: true, reason: (err as Error).message, suggestions: [] },
      { status: 200 }
    );
  }
}
