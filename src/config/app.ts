import type { AISettings } from "@/lib/types";
import type { TradingPersona } from "@/features/trading/position-types";
import { DEFAULT_TRADING_PERSONA } from "@/features/trading/position-types";

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
  persona: "idxai.persona",
  openPositions: "idxai.positions.open",
  closedTrades: "idxai.positions.closed",
  telegramConfig: "idxai.telegram.config",
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
 * Default AI settings — dikonfigurasi untuk persona user:
 * provider custom (9router localhost:20128) + model DeepSeek V4 flash free.
 * AI master switch tetap OFF supaya user opt-in sadar.
 */
export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: "custom",
  aiEnabled: false,
  openaiKey: "",
  anthropicKey: "",
  openaiModel: "gpt-4o-mini",
  anthropicModel: "claude-3-5-haiku-latest",
  ollamaModel: "gemma4:e4b",
  ollamaBaseUrl: "",
  customKey: "",
  customModel: "opencode/deepseek-v4-flash-free",
  customBaseUrl: "http://localhost:20128/v1",
  features: {
    scannerCritique: false,
    newsSummary: false,
    multiTfSynthesis: false,
    comparisonVerdict: false,
    structuredOutput: false,
  },
};

/**
 * Default persona — swing/day/scalp trader modal 1.5jt, target 1-2%.
 * Fee config IDX retail umum. User boleh override di Settings.
 */
export const DEFAULT_PERSONA: TradingPersona = DEFAULT_TRADING_PERSONA;
