import { NextResponse } from "next/server";
import { callAI, type AIProvider } from "@/lib/ai-provider";
import { cached } from "@/lib/server-cache";
import { createLogger } from "@/lib/logger";
import {
  NEWS_SUMMARY_SYSTEM,
  buildNewsSummaryPrompt,
  parseNewsSummary,
} from "@/pipeline/ai/news-summarizer";

const logger = createLogger("api:ai:news-summary");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUMMARY_TTL_MS = 10 * 60 * 1000;

interface RequestBody {
  ticker: string;
  headlines: string[];
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
    Array.isArray(b.headlines) &&
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
      { error: "Format request salah. Butuh: ticker, headlines[], provider, model" },
      { status: 400 },
    );
  }

  const ticker = body.ticker.toUpperCase();
  const headlines = body.headlines.filter((h) => typeof h === "string" && h.length > 0);
  if (headlines.length === 0) {
    return NextResponse.json({ summary: "" });
  }

  const cacheKey = `ai:news-summary:${body.provider}:${body.model}:${ticker}:${headlines.length}:${headlines[0].slice(0, 40)}`;

  try {
    const summary = await cached<string>(
      cacheKey,
      { ttlMs: SUMMARY_TTL_MS, staleMs: SUMMARY_TTL_MS * 3 },
      async () => {
        const result = await callAI({
          provider: body.provider,
          model: body.model,
          system: NEWS_SUMMARY_SYSTEM,
          user: buildNewsSummaryPrompt(ticker, headlines),
          apiKey: body.apiKey,
          baseUrl: body.baseUrl,
          temperature: 0.3,
          maxTokens: 400,
        });
        return parseNewsSummary(result.text);
      },
    );
    logger.info(`News summary generated for ${ticker}`);
    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("News summary failed", { ticker, error: message });
    return NextResponse.json({ summary: "", error: message }, { status: 200 });
  }
}
