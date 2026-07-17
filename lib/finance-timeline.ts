/**
 * Pure finance-timeline ordering helpers.
 *
 * This module is intentionally free of any database or React dependency so the
 * timeline ordering rule can be unit- and property-tested in isolation.
 *
 * Requirement mapping:
 * - Requirement 2.5 / 2.13: finance_activity_history records for an entity are
 *   presented in reverse chronological order (newest first), and this is the
 *   standard order for every entity-specific finance timeline.
 * - Requirement 7.10: the ledger transaction timeline uses the same
 *   newest-first order.
 *
 * The DB query in `components/finance/finance-timeline.tsx` already applies
 * `orderBy(desc(createdAt))`, but the component may combine DB rows with
 * derived fallback entries (e.g. from `audit_logs`). Routing every rendered
 * list through this single pure function makes the ordering rule the one
 * source of truth and keeps it verifiable without a database.
 */

/** Minimal shape required to order a timeline entry: a `createdAt` timestamp. */
export interface TimelineOrderable {
  createdAt: Date;
}

/**
 * Order timeline entries strictly newest-first by `createdAt` (descending).
 *
 * Guarantees:
 * - **Descending:** for every adjacent pair the earlier element's `createdAt`
 *   is greater than or equal to the later element's `createdAt`.
 * - **Permutation:** the result contains exactly the same elements as the input
 *   (no drops, no duplicates) — it never mutates the input array.
 * - **Stable on ties:** entries sharing the same `createdAt` keep their original
 *   relative order (`Array.prototype.sort` is stable in modern JS engines).
 * - **Idempotent:** sorting an already-sorted list returns the same order.
 */
export function sortTimelineEntriesNewestFirst<T extends TimelineOrderable>(
  entries: readonly T[],
): T[] {
  return [...entries].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export default sortTimelineEntriesNewestFirst;
