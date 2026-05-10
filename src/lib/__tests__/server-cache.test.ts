import { describe, it, expect, beforeEach } from "vitest";
import { cached, clearAllCache, peek, invalidate } from "@/lib/server-cache";

describe("server-cache", () => {
  beforeEach(() => {
    clearAllCache();
  });

  it("returns cached value within TTL without re-running loader", async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      return { value: calls };
    };

    const first = await cached("k1", { ttlMs: 1000 }, loader);
    const second = await cached("k1", { ttlMs: 1000 }, loader);

    expect(first.value).toBe(1);
    expect(second.value).toBe(1);
    expect(calls).toBe(1);
  });

  it("dedups concurrent callers with single in-flight request", async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return calls;
    };

    const results = await Promise.all([
      cached("k2", { ttlMs: 1000 }, loader),
      cached("k2", { ttlMs: 1000 }, loader),
      cached("k2", { ttlMs: 1000 }, loader),
    ]);

    expect(results).toEqual([1, 1, 1]);
    expect(calls).toBe(1);
  });

  it("refetches after TTL expires", async () => {
    let calls = 0;
    const loader = async () => ++calls;

    await cached("k3", { ttlMs: 5 }, loader);
    await new Promise((r) => setTimeout(r, 15));
    const second = await cached("k3", { ttlMs: 5 }, loader);

    expect(second).toBe(2);
    expect(calls).toBe(2);
  });

  it("serves stale data if loader fails within stale window", async () => {
    let attempts = 0;
    const flaky = async () => {
      attempts++;
      if (attempts === 1) return "fresh";
      throw new Error("upstream down");
    };

    // First call populates cache
    const first = await cached("k4", { ttlMs: 5, staleMs: 60_000 }, flaky);
    expect(first).toBe("fresh");

    // Expire fresh window
    await new Promise((r) => setTimeout(r, 15));

    // Loader fails; we should still get the stale value
    const second = await cached("k4", { ttlMs: 5, staleMs: 60_000 }, flaky);
    expect(second).toBe("fresh");
    expect(attempts).toBe(2);
  });

  it("propagates loader error when no stale data is available", async () => {
    const loader = async () => {
      throw new Error("boom");
    };
    await expect(cached("k5", { ttlMs: 1000 }, loader)).rejects.toThrow("boom");
  });

  it("peek returns null for missing keys and values for fresh entries", async () => {
    await cached("k6", { ttlMs: 1000 }, async () => 42);
    expect(peek("k6")).toBe(42);
    expect(peek("absent")).toBeNull();
  });

  it("invalidate removes a cached entry", async () => {
    await cached("k7", { ttlMs: 1000 }, async () => "v");
    expect(peek("k7")).toBe("v");
    invalidate("k7");
    expect(peek("k7")).toBeNull();
  });
});
