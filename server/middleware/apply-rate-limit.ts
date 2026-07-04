import { checkRateLimit } from "./rate-limiter";

/**
 * Apply rate limiting for mutation server actions.
 * Call at the start of any create/update/delete server action.
 *
 * @param sessionId - The authenticated user's ID (from requireAuth/requireAnyRole)
 * @throws Error with Indonesian message if rate limit exceeded
 */
export function applyRateLimit(sessionId: string): void {
  const result = checkRateLimit(sessionId);
  if (!result.allowed) {
    throw new Error(
      `Terlalu banyak permintaan. Silakan tunggu ${result.retryAfterSeconds} detik sebelum mencoba lagi.`
    );
  }
}
