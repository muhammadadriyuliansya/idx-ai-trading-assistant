import { NextResponse } from "next/server";
import { callAI, type AIProvider } from "@/lib/ai-provider";
import { cached } from "@/lib/server-cache";
import { createLogger } from "@/lib/logger";
import {
  COMPARISON_SYSTEM,
  buildComparisonPrompt,
  parseComparisonVerdict,
  type ComparisonStock,
  type ParsedVerdict,
} from "@/pipeline/ai/comparison-verdict";
import { comparisonVerdictSchema, safeParseJsonWithSchema } from "@/lib/ai-schema";

const logger = createLogger("api:ai:comparison-verdict");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERDICT_TTL_MS = 5 * 60 * 1000;

interface RequestBody {
  stocks: ComparisonStock[];
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  format?: "json";
}

function isValidBody(body: unknown): body is RequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    Array.isArray(b.stocks) &&
    b.stocks.length >= 2 &&
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
      { error: "Format request salah. Butuh: stocks[2+], provider, model" },
      { status: 400 },
    );
  }

  const stocks = body.stocks.slice(0, 5);
  const tickers = stocks.map((s) => s.ticker.toUpperCase());
  const signature = stocks.map((s) => `${s.ticker}:${s.score}:${s.decision}`).join("|");
  const cacheKey = `ai:verdict:${body.provider}:${body.model}:${signature}`;

  try {
    const verdict = await cached<ParsedVerdict>(
      cacheKey,
      { ttlMs: VERDICT_TTL_MS, staleMs: VERDICT_TTL_MS * 3 },
      async () => {
        const wantsJson = body.format === "json";
        const systemPrompt = wantsJson
          ? `${COMPARISON_SYSTEM}\n\nBalas HANYA dengan JSON valid: {"winner": "<TICKER>", "reasons": ["...", "..."], "warning": "<TICKER atau null>"}.`
          : COMPARISON_SYSTEM;

        const result = await callAI({
          provider: body.provider,
          model: body.model,
          system: systemPrompt,
          user: buildComparisonPrompt(stocks),
          apiKey: body.apiKey,
          baseUrl: body.baseUrl,
          format: wantsJson ? "json" : undefined,
          temperature: 0.35,
          maxTokens: 500,
        });

        if (wantsJson) {
          const parsed = safeParseJsonWithSchema(result.text, comparisonVerdictSchema);
          if (parsed.ok && parsed.data) {
            const winner = parsed.data.winner.toUpperCase();
            const warning = parsed.data.warning?.toUpperCase() ?? null;
            return {
              winner: tickers.includes(winner) ? winner : null,
              reasons: parsed.data.reasons.slice(0, 5).map((r) => r.slice(0, 300)),
              warning: warning && tickers.includes(warning) ? warning : null,
              raw: result.text,
            };
          }
          logger.warn("Verdict JSON invalid, falling back to line parse", {
            error: parsed.error,
          });
        }

        return parseComparisonVerdict(result.text, tickers);
      },
    );
    logger.info(`Verdict winner=${verdict.winner} warn=${verdict.warning}`);
    return NextResponse.json(verdict);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("Comparison verdict failed", { error: message });
    return NextResponse.json(
      { winner: null, reasons: [], warning: null, raw: "", error: message },
      { status: 200 },
    );
  }
}
