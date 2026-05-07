import type { ScanCandidate } from "@/pipeline/types";
import type { BadgeTone } from "./types";

export const candidateTone: Record<ScanCandidate["status"], BadgeTone> = {
  VALID: "emerald",
  WATCHLIST: "amber",
  REJECT: "red",
};

export const actionTone: Record<string, BadgeTone> = {
  APPROVED: "emerald",
  WATCHLIST: "amber",
  REDUCE_SIZE: "violet",
  REJECTED: "red",
};

export const healthTone: Record<string, BadgeTone> = {
  GOOD: "emerald",
  DEGRADED: "amber",
  STALE: "amber",
  BAD: "red",
};
