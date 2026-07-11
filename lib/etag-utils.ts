import { createHash } from "crypto";

export interface ETagMessageSeed {
  id: string;
  createdAt: string;
  isRead?: boolean;
}

/**
 * Generate a stable ETag from message rows.
 * Uses SHA-1 hash of a deterministic seed built from id, createdAt, and isRead fields.
 */
export function generateMessagesETag(rows: ETagMessageSeed[]): string {
  const seed = rows
    .map((row) => `${row.id}:${row.createdAt}:${row.isRead ? 1 : 0}`)
    .join("|");
  return createHash("sha1").update(seed).digest("hex");
}

/**
 * Check if a request ETag matches the current ETag.
 * Strips quotes and weak-validator prefix (W/) before comparison.
 */
export function checkETagMatch(
  requestETag: string | null,
  currentETag: string
): boolean {
  if (!requestETag) return false;
  // Strip weak validator prefix and surrounding quotes
  const clean = requestETag.replace(/^(W\/)?"?|"?$/g, "");
  return clean === currentETag;
}
