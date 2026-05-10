import { NextResponse } from "next/server";
import { getIhsgSnapshot } from "../quote/route";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:ihsg");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight IHSG snapshot. Response is cached server-side for 60s and
 * deduped in-flight, so hammering this endpoint during a scan is safe.
 */
export async function GET() {
  try {
    const snapshot = await getIhsgSnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        // Let the client cache briefly too; server already dedups.
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("IHSG snapshot failed", { error: message });
    return NextResponse.json(
      { trend: "unknown", label: "", error: message },
      { status: 200 }, // soft-fail so orchestrator can continue
    );
  }
}
