/**
 * Unified AI provider abstraction.
 *
 * All UI code should call `callAI()` instead of hitting OpenAI / Anthropic /
 * Ollama directly. This way adding a new provider = one file change, and
 * keeps retry / JSON-mode / timeout semantics consistent.
 *
 * Runs server-side only (called from Next route handlers). Do not import
 * from client components.
 */

import { createLogger } from "./logger";

const logger = createLogger("ai-provider");

export type AIProvider = "openai" | "anthropic" | "ollama";

export interface CallAIOptions {
  provider: AIProvider;
  model: string;
  system: string;
  user: string;
  /** API key required for cloud providers. Ignored by Ollama. */
  apiKey?: string;
  /** Base URL override. Mostly useful for Ollama if not on localhost:11434. */
  baseUrl?: string;
  /** If "json", the provider is instructed to emit strictly valid JSON. */
  format?: "json";
  /** AbortSignal for caller cancellation. */
  signal?: AbortSignal;
  /** Response timeout in ms. Defaults differ per provider (cloud 30s, local 90s). */
  timeoutMs?: number;
  /** Temperature. Default 0.4. */
  temperature?: number;
  /** Max output tokens. Default 1500. */
  maxTokens?: number;
}

export interface CallAIResult {
  text: string;
  provider: AIProvider;
  model: string;
}

const DEFAULT_TIMEOUT_CLOUD = 30_000;
const DEFAULT_TIMEOUT_LOCAL = 90_000;

function resolveTimeout(opts: CallAIOptions): number {
  if (opts.timeoutMs) return opts.timeoutMs;
  return opts.provider === "ollama" ? DEFAULT_TIMEOUT_LOCAL : DEFAULT_TIMEOUT_CLOUD;
}

/**
 * Merge caller signal with an internal timeout signal so either can cancel.
 */
function mergeSignals(
  external: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`AI request timed out after ${timeoutMs}ms`)), timeoutMs);

  if (external) {
    if (external.aborted) {
      controller.abort(external.reason);
    } else {
      external.addEventListener("abort", () => controller.abort(external.reason), { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

async function callOpenAI(opts: CallAIOptions): Promise<string> {
  if (!opts.apiKey) throw new Error("OpenAI API key kosong");

  const timeoutMs = resolveTimeout(opts);
  const { signal, cleanup } = mergeSignals(opts.signal, timeoutMs);

  try {
    const body: Record<string, unknown> = {
      model: opts.model,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1500,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    };
    if (opts.format === "json") {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(data?.error?.message || `OpenAI HTTP ${res.status}`);
    }
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI returned empty response");
    return text;
  } finally {
    cleanup();
  }
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function callAnthropic(opts: CallAIOptions): Promise<string> {
  if (!opts.apiKey) throw new Error("Anthropic API key kosong");

  const timeoutMs = resolveTimeout(opts);
  const { signal, cleanup } = mergeSignals(opts.signal, timeoutMs);

  try {
    // Anthropic doesn't expose JSON mode; we fall back to "prompt it hard"
    const system = opts.format === "json"
      ? `${opts.system}\n\nIMPORTANT: Respond with ONLY valid JSON, no markdown fences, no prose.`
      : opts.system;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": opts.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 1500,
        temperature: opts.temperature ?? 0.4,
        system,
        messages: [{ role: "user", content: opts.user }],
      }),
      signal,
    });

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(data?.error?.message || `Anthropic HTTP ${res.status}`);
    }
    const text = data?.content?.find((c) => c.type === "text")?.text;
    if (!text) throw new Error("Anthropic returned empty response");
    return text;
  } finally {
    cleanup();
  }
}

// ---------------------------------------------------------------------------
// Ollama (local)
// ---------------------------------------------------------------------------

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

export function resolveOllamaBaseUrl(override?: string): string {
  const raw = (override ?? process.env.OLLAMA_HOST ?? DEFAULT_OLLAMA_BASE_URL).trim();
  return raw.replace(/\/+$/, ""); // strip trailing slash
}

async function callOllama(opts: CallAIOptions): Promise<string> {
  const baseUrl = resolveOllamaBaseUrl(opts.baseUrl);
  const timeoutMs = resolveTimeout(opts);
  const { signal, cleanup } = mergeSignals(opts.signal, timeoutMs);

  try {
    const body: Record<string, unknown> = {
      model: opts.model,
      stream: false,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      options: {
        temperature: opts.temperature ?? 0.4,
        num_ctx: 8192,
      },
    };
    if (opts.format === "json") {
      body.format = "json";
    }

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Ollama HTTP ${res.status}: ${errText || "no body"}`);
    }

    const data = (await res.json()) as {
      message?: { content?: string };
      done?: boolean;
      error?: string;
    };

    if (data.error) throw new Error(`Ollama error: ${data.error}`);
    const text = data?.message?.content;
    if (!text) throw new Error("Ollama returned empty response");
    return text;
  } finally {
    cleanup();
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function callAI(opts: CallAIOptions): Promise<CallAIResult> {
  logger.debug(`AI call provider=${opts.provider} model=${opts.model} json=${opts.format === "json"}`);

  let text: string;
  switch (opts.provider) {
    case "openai":
      text = await callOpenAI(opts);
      break;
    case "anthropic":
      text = await callAnthropic(opts);
      break;
    case "ollama":
      text = await callOllama(opts);
      break;
    default: {
      const exhaustive: never = opts.provider;
      throw new Error(`Unknown provider: ${String(exhaustive)}`);
    }
  }

  return { text, provider: opts.provider, model: opts.model };
}

/**
 * List models available from Ollama. Used by Settings "Test Connection".
 * Returns [] if Ollama is unreachable.
 */
export async function listOllamaModels(baseUrlOverride?: string, timeoutMs = 5000): Promise<string[]> {
  const baseUrl = resolveOllamaBaseUrl(baseUrlOverride);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name: string }[] };
    return (data.models ?? []).map((m) => m.name);
  } catch (err) {
    logger.debug(`listOllamaModels failed: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
