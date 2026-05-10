import { createLogger } from "./logger";

const logger = createLogger("resilient-fetch");

// ============================================================================
// Global storage (survives HMR in dev; single instance per tab in prod)
// ============================================================================

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: "closed" | "open" | "half-open";
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface ResilientGlobals {
  circuits: Map<string, CircuitBreakerState>;
  cache: Map<string, CacheEntry<unknown>>;
  inflight: Map<string, Promise<unknown>>;
}

const GLOBAL_KEY = "__idxai_resilient_fetch__";

function getGlobals(): ResilientGlobals {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: ResilientGlobals;
  };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      circuits: new Map(),
      cache: new Map(),
      inflight: new Map(),
    };
  }
  return g[GLOBAL_KEY]!;
}

// ============================================================================
// Circuit Breaker
// ============================================================================

const FAILURE_THRESHOLD = 3;
const RECOVERY_TIMEOUT_MS = 30_000;

function getCircuit(key: string): CircuitBreakerState {
  const { circuits } = getGlobals();
  let circuit = circuits.get(key);
  if (!circuit) {
    circuit = { failures: 0, lastFailureTime: 0, state: "closed" };
    circuits.set(key, circuit);
  }
  return circuit;
}

function recordFailure(key: string): void {
  const circuit = getCircuit(key);
  circuit.failures++;
  circuit.lastFailureTime = Date.now();
  if (circuit.failures >= FAILURE_THRESHOLD) {
    circuit.state = "open";
    logger.warn(`Circuit breaker OPEN for ${key}`, { failures: circuit.failures });
  }
}

function recordSuccess(key: string): void {
  const circuit = getCircuit(key);
  circuit.failures = 0;
  circuit.state = "closed";
}

function isCircuitOpen(key: string): boolean {
  const circuit = getCircuit(key);
  if (circuit.state === "closed") return false;
  if (circuit.state === "open") {
    if (Date.now() - circuit.lastFailureTime > RECOVERY_TIMEOUT_MS) {
      circuit.state = "half-open";
      return false;
    }
    return true;
  }
  return false;
}

// ============================================================================
// Cache
// ============================================================================

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 min fresh (matches server bars TTL)

function getCached<T>(key: string): T | null {
  const { cache } = getGlobals();
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    return null;
  }
  return entry.data;
}

function getStaleCached<T>(key: string): T | null {
  const { cache } = getGlobals();
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  return entry ? entry.data : null;
}

function setCache<T>(key: string, data: T): void {
  const { cache } = getGlobals();
  cache.set(key, { data, timestamp: Date.now() });
}

// ============================================================================
// Resilient Fetch
// ============================================================================

export interface ResilientFetchOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  useCircuitBreaker?: boolean;
  useCache?: boolean;
  cacheKey?: string;
  timeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<ResilientFetchOptions> = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  useCircuitBreaker: true,
  useCache: true,
  cacheKey: "",
  timeoutMs: 15_000,
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resilientFetch<T>(
  url: string,
  fetchOptions?: RequestInit,
  options?: ResilientFetchOptions,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cacheKey = opts.cacheKey || url;
  const { inflight } = getGlobals();

  // 1. Fresh cache hit
  if (opts.useCache) {
    const cached = getCached<T>(cacheKey);
    if (cached !== null) {
      logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }
  }

  // 2. Circuit open → try stale cache, else fail
  if (opts.useCircuitBreaker && isCircuitOpen(cacheKey)) {
    logger.warn(`Circuit open for ${cacheKey}, attempting stale cache`);
    const stale = getStaleCached<T>(cacheKey);
    if (stale !== null) return stale;
    throw new Error(
      `Circuit breaker open for ${cacheKey} and no cached data available`,
    );
  }

  // 3. In-flight dedup — multiple callers share one network request
  const existing = inflight.get(cacheKey) as Promise<T> | undefined;
  if (existing) {
    logger.debug(`In-flight dedup for ${cacheKey}`);
    return existing;
  }

  const promise = (async (): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as T;

        if (opts.useCircuitBreaker) recordSuccess(cacheKey);
        if (opts.useCache) setCache(cacheKey, data);

        return data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (lastError.name === "AbortError") {
          lastError = new Error(`Request timed out after ${opts.timeoutMs}ms`);
        }

        logger.warn(
          `Fetch attempt ${attempt + 1}/${opts.maxRetries + 1} failed for ${url}`,
          { error: lastError.message },
        );

        if (attempt < opts.maxRetries) {
          const delay = Math.min(
            opts.baseDelayMs * Math.pow(2, attempt) + Math.random() * 100,
            opts.maxDelayMs,
          );
          await sleep(delay);
        }
      }
    }

    if (opts.useCircuitBreaker) recordFailure(cacheKey);

    const stale = getStaleCached<T>(cacheKey);
    if (stale !== null) {
      logger.warn(`All retries failed for ${url}, returning stale cache`);
      return stale;
    }

    throw lastError ?? new Error(`Fetch failed for ${url}`);
  })();

  inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(cacheKey);
  }
}

// ============================================================================
// Exported for testing / admin
// ============================================================================

export function resetCircuits(): void {
  getGlobals().circuits.clear();
}

export function resetClientCache(): void {
  getGlobals().cache.clear();
  getGlobals().inflight.clear();
}
