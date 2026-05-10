/**
 * Server-side cache with TTL + single-flight dedup.
 *
 * Goals:
 * - Cut redundant Yahoo Finance / news fetches (rate-limit protection).
 * - Dedup concurrent requests for the same key (in-flight singleton).
 * - Stored on globalThis so dev HMR keeps the cache warm across reloads.
 *
 * NOT a distributed cache. Per-instance only. That's fine for this app since
 * Yahoo rate limits are also per-IP.
 */

import { createLogger } from "./logger";

const logger = createLogger("server-cache");

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  staleUntil: number;
}

type CacheStore = Map<string, CacheEntry<unknown>>;
type InFlightStore = Map<string, Promise<unknown>>;

interface GlobalCacheShape {
  store: CacheStore;
  inflight: InFlightStore;
}

const GLOBAL_KEY = "__idxai_server_cache__";

function getGlobalCache(): GlobalCacheShape {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: GlobalCacheShape;
  };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      store: new Map(),
      inflight: new Map(),
    };
  }
  return g[GLOBAL_KEY]!;
}

export interface CacheOptions {
  /** Fresh window in ms. Within this, cached data is returned directly. */
  ttlMs: number;
  /** Total window (including stale) before entry is dropped. Default = ttlMs * 4. */
  staleMs?: number;
}

/**
 * Get-or-fetch with TTL and single-flight dedup.
 *
 * - If fresh entry exists: return it.
 * - If a fetch is in flight for the same key: await that one (dedup).
 * - Otherwise: start fetch, cache result.
 * - On fetch failure: if stale entry exists, serve stale (graceful degradation).
 */
export async function cached<T>(
  key: string,
  options: CacheOptions,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const { store, inflight } = getGlobalCache();

  // 1. Fresh cache hit
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > now) {
    return entry.data;
  }

  // 2. Dedup concurrent loads
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  // 3. Start fetch
  const promise = (async () => {
    try {
      const data = await loader();
      const ttlMs = options.ttlMs;
      const staleMs = options.staleMs ?? ttlMs * 4;
      store.set(key, {
        data,
        expiresAt: Date.now() + ttlMs,
        staleUntil: Date.now() + staleMs,
      });
      return data;
    } catch (err) {
      // Graceful: serve stale if available
      const stale = store.get(key) as CacheEntry<T> | undefined;
      if (stale && stale.staleUntil > Date.now()) {
        logger.warn(`cache ${key}: loader failed, serving stale`, {
          error: err instanceof Error ? err.message : String(err),
        });
        return stale.data;
      }
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Peek cache without triggering a load. Returns null if missing or expired
 * beyond staleUntil. Use `includeStale` to also return stale-but-not-dropped
 * entries (useful as a last-resort fallback when an upstream call fails).
 */
export function peek<T>(key: string, includeStale = false): T | null {
  const { store } = getGlobalCache();
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  const now = Date.now();
  if (entry.expiresAt > now) return entry.data;
  if (includeStale && entry.staleUntil > now) return entry.data;
  return null;
}

export function invalidate(key: string): void {
  const { store } = getGlobalCache();
  store.delete(key);
}

export function clearAllCache(): void {
  const { store, inflight } = getGlobalCache();
  store.clear();
  inflight.clear();
}

export function cacheSize(): number {
  return getGlobalCache().store.size;
}
