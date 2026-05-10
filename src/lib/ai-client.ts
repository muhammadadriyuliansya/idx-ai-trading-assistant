"use client";

import { generateAnalysis } from "./ai";
import type { AISettings } from "./types";

export interface AICallParams {
  system: string;
  user: string;
  settings: AISettings;
  format?: "json";
}

export interface AICallResult {
  text: string;
  provider: string;
  model: string;
}

/**
 * Thin wrapper around `generateAnalysis` that enforces the master enable flag.
 *
 * Returns null when AI is disabled, instead of throwing — callers render a
 * graceful "AI off" state rather than an error. Real failures still throw.
 */
export async function callAIIfEnabled(
  params: AICallParams,
): Promise<AICallResult | null> {
  if (!params.settings.aiEnabled) return null;

  const result = await generateAnalysis({
    module: "decision",
    system: params.system,
    user: params.user,
    settings: params.settings,
    format: params.format,
  });

  return {
    text: result.text,
    provider: result.provider,
    model: result.model,
  };
}

/**
 * Check whether any AI features are enabled at all. Useful for hiding UI
 * entry points when the user hasn't opted into anything.
 */
export function isAnyAIFeatureEnabled(settings: AISettings): boolean {
  if (!settings.aiEnabled) return false;
  return Object.values(settings.features).some(Boolean);
}
