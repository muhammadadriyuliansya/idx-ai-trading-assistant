/**
 * Zod schemas + safe parser for AI JSON output.
 *
 * Used when `aiFeatures.structuredOutput` is ON. If parsing fails, caller
 * falls back to plain text — JSON mode is an optimization, not a hard
 * requirement.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const secondOpinionSchema = z.object({
  verdict: z.string().min(1).max(400),
  conviction: z.number().min(0).max(100).optional(),
  keyEdge: z.string().max(400).optional(),
  keyRisk: z.string().max(400).optional(),
  recommendedAction: z.string().max(120).optional(),
  notes: z.array(z.string()).max(10).optional(),
});
export type SecondOpinion = z.infer<typeof secondOpinionSchema>;

export const critiquesSchema = z.object({
  critiques: z.record(z.string(), z.string().max(400)),
});
export type CritiquesPayload = z.infer<typeof critiquesSchema>;

export const newsSummarySchema = z.object({
  bullets: z.array(z.string().max(200)).min(1).max(5),
});
export type NewsSummaryPayload = z.infer<typeof newsSummarySchema>;

export const multiTfSynthesisSchema = z.object({
  bullets: z.array(z.string().max(240)).min(1).max(6),
  aligned: z.boolean().optional(),
  dominantFrame: z.string().optional(),
});
export type MultiTfSynthesisPayload = z.infer<typeof multiTfSynthesisSchema>;

export const comparisonVerdictSchema = z.object({
  winner: z.string().min(1),
  reasons: z.array(z.string().max(300)).min(1).max(5),
  warning: z.string().optional(),
});
export type ComparisonVerdictPayload = z.infer<typeof comparisonVerdictSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip markdown code fences and surrounding prose so the remaining string
 * is most likely a raw JSON object/array. Useful because some models wrap
 * JSON output in ```json fences even when told not to.
 */
export function extractJsonCandidate(text: string): string {
  const trimmed = text.trim();

  // Strip ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  // Find first { or [ and last matching closer
  const firstBrace = trimmed.search(/[{[]/);
  const lastBrace = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export interface SafeJsonResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

/**
 * Parse + validate AI output against a Zod schema. Never throws — returns a
 * result object so callers can cleanly fall back to plain-text handling.
 */
export function safeParseJsonWithSchema<T>(
  text: string,
  schema: z.ZodSchema<T>,
): SafeJsonResult<T> {
  const candidate = extractJsonCandidate(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: `JSON parse gagal: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      data: null,
      error: `Schema mismatch: ${result.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`,
    };
  }

  return { ok: true, data: result.data, error: null };
}
