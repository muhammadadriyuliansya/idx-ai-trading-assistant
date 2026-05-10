import type { AISettings } from "@/lib/types";

export const STORAGE_KEYS = {
  lastTicker: "idxai.last.ticker",
  lastCapital: "idxai.last.capital",
  lastRisk: "idxai.last.risk",
  watchlist: "idxai.watchlist.auto",
  alerts: "idxai.alerts.local",
  aiOpinions: "idxai.ai.opinions",
  scanMode: "idxai.scan.mode",
  tradeHistory: "idxai.portfolio.history",
  lastScanAt: "idxai.scan.lastAt",
  aiSettings: "idxai.ai.settings",
} as const;

export const SCAN_CONFIG = {
  minSetupScore: 50,
  maxResults: 20,
} as const;

/**
 * Minimum gap between auto-scans triggered on mount. Set to match the server
 * quote cache TTL so we don't fire off 40 ticker requests when the cache
 * would just return the same data.
 */
export const AUTO_SCAN_THROTTLE_MS = 2 * 60 * 1000;

/**
 * Default AI settings. All features start OFF — user opts in per-feature
 * from the Settings tab. Keeps the upgrade non-intrusive for existing users.
 */
export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: "ollama",
  aiEnabled: false,
  openaiKey: "",
  anthropicKey: "",
  openaiModel: "gpt-4o-mini",
  anthropicModel: "claude-3-5-haiku-latest",
  ollamaModel: "gemma4:e4b",
  ollamaBaseUrl: "",
  features: {
    scannerCritique: false,
    newsSummary: false,
    multiTfSynthesis: false,
    comparisonVerdict: false,
    structuredOutput: false,
  },
};
