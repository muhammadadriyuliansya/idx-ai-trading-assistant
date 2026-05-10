import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai-provider";
import { cached } from "@/lib/server-cache";
import { createLogger } from "@/lib/logger";
import {
  CRITIQUE_SYSTEM,
  buildCritiquePrompt,
  parseCritiqueResponse,
  type CritiqueInput,
} from "@/pipeline/ai/scanner-critique";
import { critiquesSchema, safeParseJsonWithSchema } from "@/lib/ai-schema";
import type { AIProvider } from "@/lib/ai-provider";

const logger = createLogger("api:ai:scanner-critique");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRITIQUE_TTL_MS = 10 * 60 * 1000; // 10 menit — selaras cache news

interface RequestBody {
  candidates: CritiqueInput[];
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
    Array.isArray(b.candidates) &&
    b.candidates.length > 0 &&
    typeof b.model === "string" &&
    (b.provider === "openai" || b.provider === "anthropic" || b.provider === "ollama")
  );
}

/**
 * Build cache key that reflects the list of candidates + their scores.
 * Two scans with the same top-N in the same order → same critique.
 */
function buildCacheKey(candidates: CritiqueInput[], provider: AIProvider, model: string): string {
  const signature = candidates
    .map((c) => `${c.ticker}:${c.setupScore}:${c.status}`)
    .join("|");
  return `ai:critique:${provider}:${model}:${signature}`;
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
      { error: "Format request salah. Butuh: candidates[], provider, model" },
      { status: 400 },
    );
  }

  // Cap candidates ke top-8 biar prompt tidak meledak & waktu inference wajar.
  const candidates = body.candidates.slice(0, 8);
  const tickers = candidates.map((c) => c.ticker);
  const cacheKey = buildCacheKey(candidates, body.provider, body.model);

  try {
    const critiques = await cached<Record<string, string>>(
      cacheKey,
      { ttlMs: CRITIQUE_TTL_MS, staleMs: CRITIQUE_TTL_MS * 3 },
      async () => {
        // When structured output is requested, switch the system prompt to
        // demand a JSON shape; otherwise use the plain-text format.
        const wantsJson = body.format === "json";
        const systemPrompt = wantsJson
          ? `${CRITIQUE_SYSTEM}\n\nBalas HANYA dengan JSON valid persis dalam bentuk: {"critiques": {"TICKER": "komentar", ...}}. Gunakan ticker yang sama dengan input.`
          : CRITIQUE_SYSTEM;

        const result = await callAI({
          provider: body.provider,
          model: body.model,
          system: systemPrompt,
          user: buildCritiquePrompt(candidates),
          apiKey: body.apiKey,
          baseUrl: body.baseUrl,
          format: wantsJson ? "json" : undefined,
          temperature: 0.5,
          maxTokens: 600,
        });

        // Structured path: try JSON → fall back to line-parse if the model
        // misbehaves. This keeps the feature useful even when Gemma breaks
        // JSON mode on a given turn.
        if (wantsJson) {
          const parsed = safeParseJsonWithSchema(result.text, critiquesSchema);
          if (parsed.ok && parsed.data) {
            // Filter to known tickers + truncate.
            const filtered: Record<string, string> = {};
            for (const [t, v] of Object.entries(parsed.data.critiques)) {
              const key = t.toUpperCase();
              if (tickers.includes(key) && typeof v === "string") {
                filtered[key] = v.slice(0, 300);
              }
            }
            if (Object.keys(filtered).length > 0) return filtered;
          }
          logger.warn("Critique JSON invalid, falling back to line parse", {
            error: parsed.error,
          });
        }

        return parseCritiqueResponse(result.text, tickers);
      },
    );

    logger.info(`Critique generated for ${Object.keys(critiques).length}/${tickers.length} tickers`);
    return NextResponse.json({ critiques });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("Scanner critique failed", { error: message });
    return NextResponse.json({ critiques: {}, error: message }, { status: 200 });
  }
}
