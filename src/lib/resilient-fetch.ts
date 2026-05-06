import { createLogger } from "./logger";

const logger = createLogger("resilient-fetch");

// ============================================================================
// Circuit Breaker
// ============================================================================

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: "closed" | "open" | "half-open";
}

const circuits = new Map<string, CircuitBreakerState>();

function getCircuit(key: string): CircuitBreakerState {
  let circuit = circuits.get(key);
  if (!circuit) {
    circuit = { failures: 0, lastFailureTime: 0, state: "closed" };
    circuits.set(key, circuit);
  }
  return circuit;
}

const FAILURE_THRESHOLD = 3;
const RECOVERY_TIMEOUT_MS = 30_000;

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
  // half-open: allow one request
  return false;
}

// ============================================================================
// Stale Cache (client-side)
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const clientCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = clientCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    clientCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  clientCache.set(key, { data, timestamp: Date.now() });
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

  // Check circuit breaker
  if (opts.useCircuitBreaker && isCircuitOpen(cacheKey)) {
    logger.warn(`Circuit open for ${cacheKey}, returning cached data`);
    const cached = getCached<T>(cacheKey);
    if (cached) return cached;
    throw new Error(`Circuit breaker open for ${cacheKey} and no cached data available`);
  }

  // Check cache
  if (opts.useCache) {
    const cached = getCached<T>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }
  }

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

      // Success
      if (opts.useCircuitBreaker) recordSuccess(cacheKey);
      if (opts.useCache) setCache(cacheKey, data);

      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on abort (timeout)
      if (lastError.name === "AbortError") {
        lastError = new Error(`Request timed out after ${opts.timeoutMs}ms`);
      }

      logger.warn(`Fetch attempt ${attempt + 1}/${opts.maxRetries + 1} failed for ${url}`, {
        error: lastError.message,
      });

      if (attempt < opts.maxRetries) {
        const delay = Math.min(
          opts.baseDelayMs * Math.pow(2, attempt) + Math.random() * 100,
          opts.maxDelayMs,
        );
        await sleep(delay);
      }
    }
  }

  // All retries failed
  if (opts.useCircuitBreaker) recordFailure(cacheKey);

  // Try returning stale cache as fallback
  const staleCache = getCached<T>(cacheKey);
  if (staleCache) {
    logger.warn(`All retries failed for ${url}, returning stale cache`);
    return staleCache;
  }

  throw lastError ?? new Error(`Fetch failed for ${url}`);
}

// ============================================================================
// Exported for testing
// ============================================================================

export function resetCircuits(): void {
  circuits.clear();
}

export function resetClientCache(): void {
  clientCache.clear();
}
