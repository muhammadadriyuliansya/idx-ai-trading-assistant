import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "@/lib/concurrency";

describe("mapWithConcurrency", () => {
  it("preserves order of results", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrency(items, 2, async (n) => n * 10);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([
      10, 20, 30, 40, 50,
    ]);
  });

  it("respects concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    await mapWithConcurrency(items, 3, async () => {
      active++;
      if (active > peak) peak = active;
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return true;
    });

    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(0);
  });

  it("captures individual errors without aborting others", async () => {
    const items = [1, 2, 3];
    const results = await mapWithConcurrency(items, 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    expect(results[2].status).toBe("fulfilled");
  });

  it("handles empty input", async () => {
    const results = await mapWithConcurrency([], 4, async (x) => x);
    expect(results).toEqual([]);
  });
});
