export const PRESENCE_TIMEOUT_SECONDS = 60;
export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGES_PER_PAGE = 50;

/**
 * Generates a deterministic conversation_id from two user IDs.
 * Sorts IDs lexicographically to ensure consistency.
 */
export function generateConversationId(userA: string, userB: string): string {
  const sorted = [userA, userB].sort();
  return `conv_${sorted[0]}_${sorted[1]}`;
}

/**
 * Computes presence status based on last heartbeat timestamp.
 * Returns "offline" if diff > 60 seconds, else "online".
 */
export function computePresenceStatus(
  lastHeartbeat: Date,
  now?: Date
): "online" | "offline" {
  const currentTime = now ?? new Date();
  const diffMs = currentTime.getTime() - lastHeartbeat.getTime();
  const diffSeconds = diffMs / 1000;
  return diffSeconds > PRESENCE_TIMEOUT_SECONDS ? "offline" : "online";
}
