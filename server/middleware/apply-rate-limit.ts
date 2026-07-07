import { checkRateLimit, createRateLimiter, type RateLimitResult } from "./rate-limiter";

// --- Granular Rate Limiters per Operation Type ---

/** Upload operations: 5 requests / minute */
const uploadLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });

/** Mutation operations (create/update/delete): 30 requests / minute */
const mutationLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 });

/** Read/list operations: 100 requests / minute */
const readLimiter = createRateLimiter({ maxRequests: 100, windowMs: 60_000 });

/** Auth attempts (login/register): 5 requests / minute */
const authLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });

/** Search operations: 20 requests / minute */
const searchLimiter = createRateLimiter({ maxRequests: 20, windowMs: 60_000 });

export type RateLimitType = "upload" | "mutation" | "read" | "auth" | "search";

const LIMITERS: Record<RateLimitType, { check: (id: string) => RateLimitResult }> = {
  upload: uploadLimiter,
  mutation: mutationLimiter,
  read: readLimiter,
  auth: authLimiter,
  search: searchLimiter,
};

/**
 * Apply rate limiting for mutation server actions.
 * Call at the start of any create/update/delete server action.
 *
 * @param sessionId - The authenticated user's ID (from requireAuth/requireAnyRole)
 * @param type - Operation type for granular limits (default: "mutation")
 * @throws Error with Indonesian message if rate limit exceeded
 */
export function applyRateLimit(sessionId: string, type: RateLimitType = "mutation"): void {
  const limiter = LIMITERS[type];
  const result = limiter.check(`${type}:${sessionId}`);
  if (!result.allowed) {
    throw new Error(
      `Terlalu banyak permintaan. Silakan tunggu ${result.retryAfterSeconds} detik sebelum mencoba lagi.`
    );
  }
}
