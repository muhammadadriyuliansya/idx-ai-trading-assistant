import { NextResponse } from "next/server";
import { callAI, type AIProvider } from "@/lib/ai-provider";
import { cached } from "@/lib/server-cache";
import { createLogger } from "@/lib/logger";
import {
  MULTI_TF_SYSTEM,
  buildMultiTfPrompt,
  parseMultiTfResponse,
  type TimeframeSummary,
} from "@/pipeline/ai/timeframe-synthesis";

const logger = createLogger("api:ai:timeframe-synthesis");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYNTH_TTL_MS = 5 * 60 * 1000;

interface RequestBody {
  ticker: string;
  summaries: TimeframeSummary[];
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

function isValidBody(body: unknown): body is RequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.ticker === "string" &&
    Array.isArray(b.summaries) &&
    b.summaries.length >= 2 &&
    typeof b.model === "string" &&
    (b.provider === "openai" || b.provider === "anthropic" || b.provider === "ollama")
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: "Format request salah. Butuh: ticker, summaries[2+], provider, model" },
      { status: 400 },
    );
  }

  const ticker = body.ticker.toUpperCase();
  const signature = body.summaries
    .map((s) => `${s.label}:${s.score}:${s.decision}:${s.trend}`)
    .join("|");
  const cacheKey = `ai:multi-tf:${body.provider}:${body.model}:${ticker}:${signature}`;

  try {
    const synthesis = await cached<string>(
      cacheKey,
      { ttlMs: SYNTH_TTL_MS, staleMs: SYNTH_TTL_MS * 3 },
      async () => {
        const result = await callAI({
          provider: body.provider,
          model: body.model,
          system: MULTI_TF_SYSTEM,
          user: buildMultiTfPrompt(ticker, body.summaries),
          apiKey: body.apiKey,
          baseUrl: body.baseUrl,
          temperature: 0.4,
          maxTokens: 500,
        });
        return parseMultiTfResponse(result.text);
      },
    );
    logger.info(`Multi-TF synthesis for ${ticker}`);
    return NextResponse.json({ synthesis });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("Multi-TF synthesis failed", { ticker, error: message });
    return NextResponse.json({ synthesis: "", error: message }, { status: 200 });
  }
}
