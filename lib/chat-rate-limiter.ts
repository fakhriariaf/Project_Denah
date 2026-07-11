// lib/chat-rate-limiter.ts

export interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp ms
}

const store = new Map<string, RateLimitEntry>();

export const WINDOW_MS = 60_000; // 1 minute
export const MAX_REQUESTS = 60; // 60 req/min/user

/**
 * Check if a user is within the rate limit window.
 * Opportunistically cleans up expired entries on each call.
 */
export function checkRateLimit(userId: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  // Opportunistic cleanup on each request
  cleanupExpiredRateLimitEntries();

  const now = Date.now();
  const entry = store.get(userId);

  // Expired or no entry — start fresh window
  if (!entry || now >= entry.resetAt) {
    store.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  // Within window — increment
  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

/**
 * Remove all expired rate limit entries from the store.
 * Called opportunistically on each request rather than via setInterval,
 * making it safe for serverless/dev reload environments.
 */
export function cleanupExpiredRateLimitEntries(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * Reset the rate limit store. Used in tests only.
 */
export function resetStore(): void {
  store.clear();
}
