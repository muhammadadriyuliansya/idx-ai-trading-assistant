"use client";

import type { AISettings, ModuleKey } from "./types";

export interface GenerateRequest {
  module: ModuleKey;
  system: string;
  user: string;
  settings: AISettings;
}

export interface GenerateResult {
  text: string;
  provider: "openai" | "anthropic";
  model: string;
}

export async function generateAnalysis(
  req: GenerateRequest,
): Promise<GenerateResult> {
  const provider = req.settings.provider;
  const apiKey =
    provider === "openai"
      ? req.settings.openaiKey.trim()
      : req.settings.anthropicKey.trim();

  if (!apiKey) {
    throw new Error(
      provider === "openai"
        ? "OpenAI API key belum di-set. Buka Settings dan masukin key lu."
        : "Anthropic API key belum di-set. Buka Settings dan masukin key lu.",
    );
  }

  const model =
    provider === "openai" ? req.settings.openaiModel : req.settings.anthropicModel;

  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      model,
      apiKey,
      system: req.system,
      user: req.user,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(`AI request gagal (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { text: string; model: string };
  return { text: data.text, provider, model: data.model };
}

export const DEFAULT_SETTINGS: AISettings = {
  provider: "openai",
  openaiKey: "",
  anthropicKey: "",
  openaiModel: "gpt-4o-mini",
  anthropicModel: "claude-3-5-sonnet-latest",
};
