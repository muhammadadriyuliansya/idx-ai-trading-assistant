export interface AutoRejectBand {
  upperPct: number;
  lowerPct: number;
  label: string;
}

export function getIdxAutoRejectBand(price: number): AutoRejectBand {
  if (!Number.isFinite(price) || price <= 0) {
    return { upperPct: 0.25, lowerPct: 0.25, label: "fallback" };
  }

  if (price <= 200) {
    return { upperPct: 0.35, lowerPct: 0.35, label: "<=200" };
  }

  if (price <= 5000) {
    return { upperPct: 0.25, lowerPct: 0.25, label: "202-5000" };
  }

  if (price <= 50000) {
    return { upperPct: 0.2, lowerPct: 0.2, label: "5025-50000" };
  }

  return { upperPct: 0.15, lowerPct: 0.15, label: ">50000" };
}

export function getIdxTickSize(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 1;
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

export function roundToTick(price: number, direction: "up" | "down" | "nearest" = "nearest"): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const tick = getIdxTickSize(price);
  const ratio = price / tick;

  if (direction === "up") return Math.ceil(ratio) * tick;
  if (direction === "down") return Math.floor(ratio) * tick;
  return Math.round(ratio) * tick;
}

export function calculateAutoRejectBounds(previousClose: number): { upper: number; lower: number; band: AutoRejectBand } {
  const band = getIdxAutoRejectBand(previousClose);
  return {
    upper: roundToTick(previousClose * (1 + band.upperPct), "down"),
    lower: roundToTick(previousClose * (1 - band.lowerPct), "up"),
    band,
  };
}

export function isNearAutoRejectLower(price: number, previousClose: number, thresholdPct = 0.02): boolean {
  if (!Number.isFinite(price) || !Number.isFinite(previousClose) || previousClose <= 0) {
    return false;
  }

  const { lower } = calculateAutoRejectBounds(previousClose);
  if (lower <= 0) return false;

  return price <= lower * (1 + thresholdPct);
}
