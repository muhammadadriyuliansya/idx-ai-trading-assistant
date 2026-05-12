import { NextResponse } from "next/server";
import { callAI, type AIProvider } from "@/lib/ai-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AIRequestBody {
  provider: AIProvider;
  model: string;
  system: string;
  user: string;
  /** Optional — required for cloud providers (OpenAI, Anthropic). */
  apiKey?: string;
  /** Optional — Ollama base URL override. */
  baseUrl?: string;
  /** Optional — request JSON-formatted output. */
  format?: "json";
}

function isValidProvider(value: unknown): value is AIProvider {
  return value === "openai" || value === "anthropic" || value === "ollama" || value === "custom";
}

function isValidBody(body: unknown): body is AIRequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    isValidProvider(b.provider) &&
    typeof b.model === "string" &&
    typeof b.system === "string" &&
    typeof b.user === "string"
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body request bukan JSON yang valid" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: "Data permintaan tidak lengkap atau salah format. Butuh: provider, model, system, user" },
      { status: 400 },
    );
  }

  // Cloud providers need an API key; Ollama runs local and doesn't.
  if ((body.provider === "openai" || body.provider === "anthropic" || body.provider === "custom") && !body.apiKey) {
    return NextResponse.json(
      { error: "API key belum di-isi. Set di menu Settings dulu." },
      { status: 400 },
    );
  }

  try {
    const result = await callAI({
      provider: body.provider,
      model: body.model,
      system: body.system,
      user: body.user,
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
      format: body.format,
    });
    return NextResponse.json({ text: result.text, model: result.model, provider: result.provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error AI tidak diketahui";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
