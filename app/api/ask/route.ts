import { NextRequest, NextResponse } from "next/server";
import { askMarket } from "@/lib/ask";

// pg + Vertex need the Node runtime (not edge). Never statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, degraded: true, reason: "invalid JSON body", suggestions: [] },
      { status: 400 }
    );
  }
  const result = await askMarket(body.question ?? "");
  // Degrade is a normal product response, not an HTTP error.
  return NextResponse.json(result, { status: 200 });
}
