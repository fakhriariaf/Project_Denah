/**
 * Finance activity timeline service — INTERNAL ONLY.
 *
 * SECURITY BOUNDARY (P0):
 * This module deliberately has NO "use server" directive.
 *
 * Previously both writers lived in `server/actions/finance.ts` ("use server"):
 *   - `recordFinanceActivity(tx, input)` was not practically exploitable because
 *     its first argument is a live Drizzle transaction handle, which cannot be
 *     serialised over the RPC boundary.
 *   - `recordFinanceActivitySafe(input)` DID accept a plain serialisable object
 *     with no guard, so any client could append arbitrary rows to the finance
 *     activity timeline — forging "approved"/"verified" history entries on any
 *     invoice, payment or budget. That trail is what finance uses to reconstruct
 *     who changed what, so forgery there is a material integrity problem.
 *
 * Rule: finance mutations import from THIS module.
 */

import { db } from "@/db";
import { financeActivityHistory } from "@/db/schema/finance";

/**
 * The transaction handle passed by `db.transaction(async (tx) => { ... })`.
 * Derived from the actual `db.transaction` signature so it stays correct if the
 * driver changes, and so callers can pass their existing `tx` without importing
 * Drizzle's generic transaction types.
 */
export type FinanceTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Entity types supported by the finance activity timeline (Req 3.6). */
export type FinanceActivityEntityType =
  | "invoice"
  | "payment"
  | "transaction"
  | "approval"
  | "budget";

/** Action values supported by the finance activity timeline (Req 3.7). */
export type FinanceActivityAction =
  | "created"
  | "submitted"
  | "approved"
  | "verified"
  | "rejected"
  | "revised"
  | "resubmitted"
  | "cancelled"
  | "reversed"
  | "corrected"
  | "updated"
  | "activated"
  | "closed"
  | "paid_partial"
  | "paid_full";

/**
 * Input for {@link recordFinanceActivity}. `actorId` is always the acting user
 * (available because every finance mutation runs after `requireAuth`). Snapshots
 * are stored as JSON and may hold any editable-field subset of the entity.
 */
export interface RecordFinanceActivityInput {
  entityType: FinanceActivityEntityType;
  entityId: string;
  action: FinanceActivityAction;
  actorId: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  snapshotBefore?: unknown;
  snapshotAfter?: unknown;
}

/**
 * Insert a single `finance_activity_history` row.
 *
 * Transaction-boundary rule (Req 3.9, 3.10):
 * For every STATUS-CHANGING mutation (verify, reject, resubmit, approve,
 * reverse, correct, create-in-tx) this helper MUST be called with the SAME `tx`
 * as the entity update. It performs no error swallowing: if the insert throws,
 * the exception propagates and the parent `db.transaction` rolls back, so there
 * is never a partial state where the entity changed but the timeline did not.
 *
 * The ONLY permitted history-only fallback that logs-and-swallows is
 * {@link recordFinanceActivitySafe} below, which is reserved for non-status,
 * best-effort events (e.g. reconstructing a legacy `created` event on first
 * detail-page view). It MUST NOT be used for status-changing mutations.
 */
export async function recordFinanceActivity(
  tx: FinanceTransaction,
  input: RecordFinanceActivityInput,
): Promise<void> {
  await tx
    .insert(financeActivityHistory)
    .values({
      id: crypto.randomUUID(),
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      reason: input.reason ?? null,
      snapshotBefore: input.snapshotBefore ?? null,
      snapshotAfter: input.snapshotAfter ?? null,
      actorId: input.actorId,
    })
    .run();
}

/**
 * History-only, NON-status best-effort recording (the single permitted fallback
 * documented by the transaction-boundary rule, Req 3.10 / Req 2.6 / Req 2.7).
 *
 * Use this ONLY for non-critical, history-only events that run OUTSIDE a status
 * mutation — for example deriving/backfilling a limited `created` event for a
 * legacy record when its detail page is first viewed. It opens its own tiny
 * transaction and logs-and-swallows any failure so that a timeline-recording
 * problem can never block detail-page rendering.
 *
 * NEVER call this from inside a status-changing mutation; those must use
 * {@link recordFinanceActivity} with the parent `tx` so failures roll back.
 */
export async function recordFinanceActivitySafe(
  input: RecordFinanceActivityInput,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await recordFinanceActivity(tx, input);
    });
  } catch (error) {
    // Best-effort only: log and swallow. A history-only failure must not block
    // detail-page rendering or any read path.
    console.error("[finance] recordFinanceActivitySafe failed (swallowed):", error);
  }
}
