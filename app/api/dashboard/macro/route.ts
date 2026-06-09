import { NextRequest, NextResponse } from "next/server";
import { getMarketSeries } from "@/lib/macro";

// pg needs the Node runtime (not edge). Never statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dashboard/macro            -> all market-context series
// GET /api/dashboard/macro?keys=a,b   -> only those series
// Market-AGGREGATE context: labelled, NOT click-to-source.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("keys");
  const keys = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  try {
    const series = await getMarketSeries(keys);
    return NextResponse.json(
      { ok: true, layer: "macro", source: "Lloyd's market aggregate (2016-2024)", series },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, degraded: true, reason: (err as Error).message, suggestions: [] },
      { status: 200 }
    );
  }
}
