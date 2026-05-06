import { describe, it, expect } from "vitest";
import {
  ema,
  sma,
  rsi,
  macd,
  atr,
  vwap,
  rollingVwap,
  avgVolume,
  swingLevels,
  classifyTrend,
  describeMacd,
  describeStochastic,
} from "../indicators";
import type { Bar } from "../indicators";

function makeBars(prices: Array<{ open: number; high: number; low: number; close: number; volume: number }>): Bar[] {
  return prices.map((p, i) => ({
    timestamp: Date.now() - (prices.length - i) * 86400000,
    ...p,
  }));
}

describe("ema", () => {
  it("returns empty array for empty input", () => {
    expect(ema([], 20)).toEqual([]);
  });

  it("returns empty array for zero period", () => {
    expect(ema([1, 2, 3], 0)).toEqual([]);
  });

  it("returns same values when period is 1", () => {
    const input = [10, 20, 30];
    const result = ema(input, 1);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(10);
  });

  it("calculates EMA correctly", () => {
    const input = [10, 11, 12, 13, 14, 15];
    const result = ema(input, 3);
    expect(result).toHaveLength(6);
    // First value is always the first input
    expect(result[0]).toBe(10);
    // All values should be finite
    result.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    // EMA should follow the trend
    expect(result[5]).toBeGreaterThan(result[0]);
  });

  it("is smooth (no jagged edges)", () => {
    const input = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    const result = ema(input, 5);
    // Constant input should give constant EMA
    result.forEach((v) => expect(v).toBeCloseTo(10));
  });
});

describe("sma", () => {
  it("returns NaN for elements before period", () => {
    const result = sma([1, 2, 3, 4, 5], 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).toBeCloseTo(2);
  });

  it("calculates correctly", () => {
    const result = sma([1, 2, 3, 4, 5], 3);
    expect(result[2]).toBeCloseTo(2);
    expect(result[3]).toBeCloseTo(3);
    expect(result[4]).toBeCloseTo(4);
  });
});

describe("rsi", () => {
  it("returns NaN for all elements when not enough data", () => {
    const result = rsi([1, 2, 3], 14);
    result.forEach((v) => expect(v).toBeNaN());
  });

  it("returns 100 for all-gains series", () => {
    const input = Array.from({ length: 20 }, (_, i) => 100 + i);
    const result = rsi(input, 14);
    // After period, RSI should be 100
    expect(result[19]).toBe(100);
  });

  it("returns values between 0 and 100", () => {
    const input = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
    const result = rsi(input, 14);
    result.forEach((v) => {
      if (Number.isFinite(v)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    });
  });
});

describe("macd", () => {
  it("returns arrays of correct length", () => {
    const input = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const result = macd(input);
    expect(result.macd).toHaveLength(50);
    expect(result.signal).toHaveLength(50);
    expect(result.histogram).toHaveLength(50);
  });

  it("histogram = macd - signal", () => {
    const input = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const result = macd(input);
    for (let i = 0; i < 50; i++) {
      expect(result.histogram[i]).toBeCloseTo(result.macd[i] - result.signal[i]);
    }
  });
});

describe("atr", () => {
  it("returns NaN for single bar", () => {
    const bars = makeBars([{ open: 100, high: 110, low: 90, close: 105, volume: 1000 }]);
    const result = atr(bars);
    expect(result[0]).toBeNaN();
  });

  it("returns values > 0 for valid bars", () => {
    const bars = makeBars(
      Array.from({ length: 20 }, (_, i) => ({
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000,
      })),
    );
    const result = atr(bars, 14);
    result.forEach((v) => {
      if (Number.isFinite(v)) {
        expect(v).toBeGreaterThan(0);
      }
    });
  });
});

describe("vwap", () => {
  it("returns typical price of last bar", () => {
    const bars = makeBars([{ open: 100, high: 110, low: 90, close: 100, volume: 1000 }]);
    expect(vwap(bars)).toBeCloseTo((110 + 90 + 100) / 3);
  });

  it("returns NaN for empty array", () => {
    expect(vwap([])).toBeNaN();
  });
});

describe("rollingVwap", () => {
  it("returns volume-weighted average of last N bars", () => {
    const bars = makeBars([
      { open: 100, high: 100, low: 100, close: 100, volume: 1000 },
      { open: 110, high: 110, low: 110, close: 110, volume: 1000 },
    ]);
    const result = rollingVwap(bars, 2);
    expect(result).toBeCloseTo((100 * 1000 + 110 * 1000) / 2000);
  });
});

describe("avgVolume", () => {
  it("returns average volume excluding last bar", () => {
    const bars = makeBars([
      { open: 100, high: 100, low: 100, close: 100, volume: 1000 },
      { open: 100, high: 100, low: 100, close: 100, volume: 2000 },
      { open: 100, high: 100, low: 100, close: 100, volume: 3000 },
    ]);
    const result = avgVolume(bars, 2);
    expect(result).toBeCloseTo(1500);
  });

  it("returns NaN for empty array", () => {
    expect(avgVolume([])).toBeNaN();
  });
});

describe("swingLevels", () => {
  it("returns support < resistance", () => {
    const bars = makeBars(
      Array.from({ length: 60 }, (_, i) => ({
        open: 100 + Math.sin(i / 3) * 10,
        high: 110 + Math.sin(i / 3) * 10,
        low: 90 + Math.sin(i / 3) * 10,
        close: 100 + Math.sin(i / 3) * 10,
        volume: 1000,
      })),
    );
    const result = swingLevels(bars, 60, 3);
    expect(result.support).toBeLessThan(result.resistance);
  });

  it("returns NaN for empty bars", () => {
    const result = swingLevels([]);
    expect(result.support).toBeNaN();
    expect(result.resistance).toBeNaN();
  });
});

describe("classifyTrend", () => {
  it("returns 'sideways' for short data", () => {
    expect(classifyTrend([1, 2, 3])).toBe("sideways");
  });

  it("returns 'bullish' for uptrend", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 2);
    expect(classifyTrend(closes)).toBe("bullish");
  });

  it("returns 'bearish' for downtrend", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 200 - i * 2);
    expect(classifyTrend(closes)).toBe("bearish");
  });
});

describe("describeMacd", () => {
  it("returns 'n/a' for empty arrays", () => {
    expect(describeMacd([], [], [])).toBe("n/a");
  });

  it("returns 'bullish cross' on histogram cross up", () => {
    expect(describeMacd([1, 2], [1, 1], [-1, 1])).toBe("bullish cross");
  });

  it("returns 'bearish cross' on histogram cross down", () => {
    expect(describeMacd([2, 1], [1, 1], [1, -1])).toBe("bearish cross");
  });

  it("returns 'netral' for flat", () => {
    expect(describeMacd([1, 1], [1, 1], [0, 0])).toBe("netral");
  });
});

describe("describeStochastic", () => {
  it("returns 'n/a' for insufficient data", () => {
    expect(describeStochastic([])).toBe("n/a");
  });

  it("returns formatted string", () => {
    const bars = makeBars(
      Array.from({ length: 20 }, (_, i) => ({
        open: 100,
        high: 110,
        low: 90,
        close: 100 + Math.sin(i / 2) * 5,
        volume: 1000,
      })),
    );
    const result = describeStochastic(bars, 14, 3);
    expect(result).toMatch(/K \d+ \/ D \d+/);
  });
});
