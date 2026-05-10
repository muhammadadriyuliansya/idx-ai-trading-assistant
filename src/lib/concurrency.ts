/**
 * Run an async mapper across a list with bounded concurrency.
 * Returns results in the same order as `items` via Promise.allSettled
 * semantics (each slot returns a PromiseSettledResult).
 *
 * Good for fanout tasks that would otherwise DoS an upstream:
 *   - scan 40 tickers through Yahoo without firing 40 requests at once
 *   - breadth analysis across N sectors
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  const size = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        const value = await mapper(items[index], index);
        results[index] = { status: "fulfilled", value };
      } catch (err) {
        results[index] = {
          status: "rejected",
          reason: err,
        };
      }
    }
  }

  const workers = Array.from({ length: size }, () => worker());
  await Promise.all(workers);
  return results;
}
