import type { ScanCandidate } from "@/pipeline/types";

export type BadgeTone = "neutral" | "blue" | "emerald" | "amber" | "red" | "violet";
export type ScanMode = ScanCandidate["mode"];

export type AlertCondition =
  | "PRICE_ABOVE_RESISTANCE"
  | "VOLUME_ABOVE_1_5"
  | "RR_ABOVE_2"
  | "WATCHLIST_VALID";

export interface WatchlistItem {
  ticker: string;
  reason: string;
  trigger: string;
  invalidation: string;
  addedAt: number;
  status: ScanCandidate["status"];
  setupScore: number;
}

export interface LocalAlert {
  id: string;
  ticker: string;
  condition: AlertCondition;
  targetLabel: string;
  createdAt: number;
  triggeredAt?: number;
}

export interface AiOpinion {
  ticker: string;
  text: string;
  savedAt: number;
}
