/**
 * Rate Limiter Middleware
 *
 * Fixed-window counter implementation for limiting mutation requests
 * per user session. Uses an in-memory Map store by default (development)
 * with a configurable store interface for production (e.g., Redis).
 *
 * Requirements: 3.1, 3.2, 3.6
 */

// --- Store Interface (for future Redis support) ---

export interface RateLimitEntry {
  count: number;
  windowStart: number; // Unix timestamp in milliseconds
}

export interface RateLimitStore {
  get(key: string): RateLimitEntry | undefined;
  set(key: string, entry: RateLimitEntry): void;
  delete(key: string): void;
}

// --- In-Memory Store (development) ---

export class InMemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, RateLimitEntry>();

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

// --- Configuration ---

export interface RateLimiterConfig {
  maxRequests: number; // default: 30
  windowMs: number; // default: 60000 (1 minute)
  store?: RateLimitStore;
}

const DEFAULT_CONFIG: Required<RateLimiterConfig> = {
  maxRequests: 30,
  windowMs: 60_000,
  store: new InMemoryRateLimitStore(),
};

// --- Rate Limiter Result Types ---

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

// --- Rate Limiter Factory ---

export function createRateLimiter(config?: Partial<RateLimiterConfig>) {
  const resolvedConfig: Required<RateLimiterConfig> = {
    maxRequests: config?.maxRequests ?? DEFAULT_CONFIG.maxRequests,
    windowMs: config?.windowMs ?? DEFAULT_CONFIG.windowMs,
    store: config?.store ?? DEFAULT_CONFIG.store,
  };

  return {
    check(sessionId: string): RateLimitResult {
      return checkRateLimitWithConfig(sessionId, resolvedConfig);
    },
    /** Exposed for testing — resets the store entry for a session */
    reset(sessionId: string): void {
      resolvedConfig.store.delete(sessionId);
    },
  };
}

// --- Default Singleton Instance ---

const defaultLimiter = createRateLimiter();

/**
 * Check rate limit for a given session ID using the default limiter instance.
 *
 * Returns `{ allowed: true }` if within the limit, or
 * `{ allowed: false, retryAfterSeconds }` if rate limit exceeded.
 */
export function checkRateLimit(sessionId: string): RateLimitResult {
  return defaultLimiter.check(sessionId);
}

// --- Core Logic ---

function checkRateLimitWithConfig(
  sessionId: string,
  config: Required<RateLimiterConfig>
): RateLimitResult {
  const now = Date.now();
  const { maxRequests, windowMs, store } = config;

  const entry = store.get(sessionId);

  // No existing entry — start a new window
  if (!entry) {
    store.set(sessionId, { count: 1, windowStart: now });
    return { allowed: true };
  }

  const windowElapsed = now - entry.windowStart;

  // Window has expired — reset and start new window
  if (windowElapsed >= windowMs) {
    store.set(sessionId, { count: 1, windowStart: now });
    return { allowed: true };
  }

  // Within current window — check count
  if (entry.count < maxRequests) {
    store.set(sessionId, { count: entry.count + 1, windowStart: entry.windowStart });
    return { allowed: true };
  }

  // Rate limit exceeded — calculate retry time
  const remainingMs = windowMs - windowElapsed;
  const retryAfterSeconds = Math.ceil(remainingMs / 1000);

  return { allowed: false, retryAfterSeconds };
}
