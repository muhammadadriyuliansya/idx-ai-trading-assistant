import { z } from "zod";

// ============================================================================
// Quote API Response Schema
// ============================================================================

export const QuoteScannerSchema = z.object({
  ticker: z.string(),
  currentPrice: z.string(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  previousClose: z.string(),
  todayVolume: z.string(),
  avgVolume20d: z.string(),
  ema20: z.string(),
  ema50: z.string(),
  ema200: z.string(),
  vwap: z.string(),
  rsi: z.string(),
  macd: z.string(),
  stochastic: z.string(),
  ihsgTrend: z.string(),
  resistance: z.string(),
  support: z.string(),
});

export const QuoteRiskSchema = z.object({
  ticker: z.string(),
  currentPrice: z.string(),
  support: z.string(),
  resistance: z.string(),
  atr: z.string(),
});

export const QuoteMetaSchema = z.object({
  barsCount: z.number(),
  lastBarDate: z.string(),
  trend: z.enum(["bullish", "sideways", "bearish"]),
  macdLabel: z.string(),
  stochLabel: z.string(),
  ihsgTrend: z.enum(["bullish", "sideways", "bearish", "unknown"]),
  ihsgChange1d: z.number().optional(),
  ihsgChange5d: z.number().optional(),
  volRatio: z.number(),
  source: z.enum(["live", "cache"]).optional(),
});

export const FundamentalSchema = z.object({
  per: z.number().nullable(),
  pbv: z.number().nullable(),
  dividendYield: z.number().nullable(),
  marketCap: z.number().nullable(),
  roe: z.number().nullable(),
  der: z.number().nullable(),
  revenueGrowth: z.number().nullable(),
  earningsGrowth: z.number().nullable(),
  eps: z.number().nullable(),
}).nullable();

export const QuoteResultSchema = z.object({
  ticker: z.string(),
  fetchedAt: z.number(),
  scanner: QuoteScannerSchema,
  risk: QuoteRiskSchema,
  meta: QuoteMetaSchema,
  fundamental: FundamentalSchema,
  error: z.string().optional(),
});

export type ValidatedQuoteResult = z.infer<typeof QuoteResultSchema>;

// ============================================================================
// News API Response Schema
// ============================================================================

export const NewsItemSchema = z.object({
  title: z.string(),
  source: z.string(),
  date: z.string(),
  url: z.string(),
});

export const NewsResponseSchema = z.object({
  news: z.array(NewsItemSchema),
  sentimentScore: z.number(),
  totalArticles: z.number(),
  error: z.string().optional(),
});

export type ValidatedNewsResponse = z.infer<typeof NewsResponseSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateQuoteResponse(data: unknown): ValidatedQuoteResult {
  const result = QuoteResultSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  // Return partial validation — don't throw, just strip invalid fields
  const partial = data as Record<string, unknown>;
  return {
    ticker: typeof partial.ticker === "string" ? partial.ticker : "UNKNOWN",
    fetchedAt: typeof partial.fetchedAt === "number" ? partial.fetchedAt : Date.now(),
    scanner: QuoteScannerSchema.parse(partial.scanner ?? {}),
    risk: QuoteRiskSchema.parse(partial.risk ?? {}),
    meta: QuoteMetaSchema.parse(partial.meta ?? {}),
    fundamental: FundamentalSchema.parse(partial.fundamental ?? null),
    error: typeof partial.error === "string" ? partial.error : undefined,
  };
}

export function validateNewsResponse(data: unknown): ValidatedNewsResponse {
  const result = NewsResponseSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  const partial = data as Record<string, unknown>;
  return {
    news: Array.isArray(partial.news)
      ? partial.news.filter((item): item is z.infer<typeof NewsItemSchema> => {
          return typeof item === "object" && item !== null && "title" in item;
        })
      : [],
    sentimentScore: typeof partial.sentimentScore === "number" ? partial.sentimentScore : 0,
    totalArticles: typeof partial.totalArticles === "number" ? partial.totalArticles : 0,
    error: typeof partial.error === "string" ? partial.error : undefined,
  };
}
