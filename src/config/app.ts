export const STORAGE_KEYS = {
  lastTicker: "idxai.last.ticker",
  lastCapital: "idxai.last.capital",
  lastRisk: "idxai.last.risk",
  watchlist: "idxai.watchlist.auto",
  alerts: "idxai.alerts.local",
  aiOpinions: "idxai.ai.opinions",
  scanMode: "idxai.scan.mode",
  tradeHistory: "idxai.portfolio.history",
} as const;

export const SCAN_CONFIG = {
  minSetupScore: 50,
  maxResults: 20,
} as const;
