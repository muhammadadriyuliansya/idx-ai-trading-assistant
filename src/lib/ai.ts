"use client";

import type { AISettings, ModuleKey, Provider } from "./types";
import { DEFAULT_AI_SETTINGS } from "@/config/app";

export interface GenerateRequest {
  module: ModuleKey;
  system: string;
  user: string;
  settings: AISettings;
  /** Request JSON-formatted output where supported. */
  format?: "json";
}

export interface GenerateResult {
  text: string;
  provider: Provider;
  model: string;
}

/**
 * Client-side entry point for AI generation. Picks the active provider from
 * settings, sends the payload to /api/ai, and returns the raw text.
 *
 * Does NOT apply caching — callers (e.g. ai-client.ts) can layer that on top.
 */
export async function generateAnalysis(
  req: GenerateRequest,
): Promise<GenerateResult> {
  const provider = req.settings.provider;

  let apiKey = "";
  let model = "";
  let baseUrl: string | undefined;

  if (provider === "openai") {
    apiKey = req.settings.openaiKey.trim();
    model = req.settings.openaiModel;
    if (!apiKey) {
      throw new Error("OpenAI API key belum di-set. Buka Settings dan isi key lu.");
    }
  } else if (provider === "anthropic") {
    apiKey = req.settings.anthropicKey.trim();
    model = req.settings.anthropicModel;
    if (!apiKey) {
      throw new Error("Anthropic API key belum di-set. Buka Settings dan isi key lu.");
    }
  } else if (provider === "ollama") {
    model = req.settings.ollamaModel;
    baseUrl = req.settings.ollamaBaseUrl.trim() || undefined;
    if (!model) {
      throw new Error("Model Ollama belum di-set. Buka Settings dan isi nama model.");
    }
  } else if (provider === "custom") {
    apiKey = req.settings.customKey.trim();
    model = req.settings.customModel;
    baseUrl = req.settings.customBaseUrl.trim() || undefined;
    if (!apiKey) throw new Error("Custom API key belum di-set.");
    if (!model) throw new Error("Custom model belum di-set.");
    if (!baseUrl) throw new Error("Custom base URL belum di-set.");
  } else {
    const exhaustive: never = provider;
    throw new Error(`Provider tidak dikenal: ${String(exhaustive)}`);
  }

  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      model,
      apiKey: apiKey || undefined,
      baseUrl,
      system: req.system,
      user: req.user,
      format: req.format,
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

/**
 * Re-export DEFAULT_AI_SETTINGS under its legacy name for modules still
 * importing the older symbol. New code should use DEFAULT_AI_SETTINGS.
 */
export const DEFAULT_SETTINGS: AISettings = DEFAULT_AI_SETTINGS;
