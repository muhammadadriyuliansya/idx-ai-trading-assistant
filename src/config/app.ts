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
