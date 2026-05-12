import { NextResponse } from "next/server";
import { listOllamaModels, resolveOllamaBaseUrl } from "@/lib/ai-provider";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:ai:health");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Checks whether the requested AI provider is reachable.
 *
 * GET /api/ai/health?provider=ollama&baseUrl=http://localhost:11434
 *
 * Returns { ok, models?, error? }. Always responds 200 (soft-fail) so the
 * UI can render an informative message without distinguishing HTTP errors
 * from payload errors.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") ?? "ollama";
  const baseUrlParam = url.searchParams.get("baseUrl") ?? undefined;

  if (provider === "ollama") {
    const baseUrl = resolveOllamaBaseUrl(baseUrlParam);
    const models = await listOllamaModels(baseUrlParam);
    if (models.length === 0) {
      return NextResponse.json({
        ok: false,
        provider,
        baseUrl,
        error: `Ollama tidak bisa dihubungi di ${baseUrl}. Pastikan Ollama sudah running (jalanin \"ollama serve\").`,
      });
    }
    logger.info(`Ollama health OK (${models.length} models)`);
    return NextResponse.json({ ok: true, provider, baseUrl, models });
  }

  if (provider === "openai" || provider === "anthropic" || provider === "custom") {
    // Cloud providers: we can't validate without spending tokens, so just
    // confirm the provider name is known. Key validity is tested on first call.
    const note = provider === "custom"
      ? "Custom endpoint, koneksi nyata dicek saat request pertama."
      : "Cloud provider, koneksi nyata dicek saat request pertama.";
    return NextResponse.json({ ok: true, provider, note });
  }

  return NextResponse.json({ ok: false, error: `Provider tidak dikenal: ${provider}` }, { status: 400 });
}
