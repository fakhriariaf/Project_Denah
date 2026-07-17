/**
 * Finance Two-Step Revision Model — lib/finance-revision-model.ts
 *
 * Pure, database-independent model of the two-step revision behavior for
 * rejected finance entities (payments and expense approvals). It mirrors the
 * exact semantics of the server actions in
 * `server/actions/finance-revision.ts` (`startPaymentRevision` /
 * `resubmitPaymentRevision`, and their expense-approval siblings) WITHOUT any
 * database, React, or I/O, so the two-step behavior can be property-tested in
 * isolation (there is no live DB test harness in this repo).
 *
 * Design context (see design.md, "Two-step revision model"):
 *
 *   Step 1 — start-revision (rejected → draft):
 *     - Writes a `revised` finance_activity_history row (a snapshot marker).
 *     - Does NOT change the persisted entity status (it stays `rejected`).
 *     - Idempotent: if an OPEN draft already exists it is a no-op (no duplicate
 *       `revised` marker is written).
 *
 *   Step 2 — resubmit (draft → pending):
 *     - Applies the revised fields and flips the entity `rejected → pending`.
 *     - Writes a `resubmitted` row, which CLOSES the open draft.
 *     - On validation failure: no mutation, no `resubmitted` row, the entity
 *       stays `rejected`, and the open-draft `revised` marker remains.
 *
 * "draft" is a LOGICAL state only — it is never a persisted status value. The
 * open/closed draft is tracked entirely through the `revised` → `resubmitted`
 * history-marker pair. An OPEN draft is a `revised` row with no later
 * `resubmitted` row for the same entity.
 *
 * This model reuses the pure `canTransitionRevisionState` edge check from
 * `lib/finance-revision.ts` so the transition rules are validated identically
 * to the server actions.
 *
 * _Requirements: 4.4, 4.7, 13.1, 13.2, 13.5_
 */

import {
  canTransitionRevisionState,
  type FinanceEntityType,
} from "./finance-revision";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Entity types that actually undergo revision today. */
export type RevisionEntityType = "payment" | "approval";

/**
 * Persisted status values relevant to the revision flow. `rejected` and
 * `pending` participate in transitions; the final states (`verified` for
 * payments, `approved` for approvals) are included so the model can reject
 * start-revision on a finalized entity, exactly as the server guard does.
 */
export type PersistedRevisionStatus =
  | "rejected"
  | "pending"
  | "verified"
  | "approved";

/**
 * Actions recorded on the revision timeline. Only `revised` and `resubmitted`
 * drive the draft open/close logic; the others may appear in history and must
 * be ignored by the draft computation.
 */
export type RevisionAction =
  | "created"
  | "submitted"
  | "rejected"
  | "revised"
  | "resubmitted"
  | "verified"
  | "approved";

/**
 * A single ordered history row. The array position encodes chronological order
 * (earlier index = earlier `createdAt`), matching the ordered inserts the
 * server actions perform inside a single transaction.
 *
 * `reason` is the persisted rejection reason on a `rejected` row (Req 4.10,
 * 4.11). It is retained verbatim so the append-only guarantee can be verified
 * to preserve prior rejection reasons across unlimited revision cycles.
 */
export interface RevisionHistoryRow {
  action: RevisionAction;
  reason?: string;
}

/**
 * In-memory model of a finance entity participating in revision: its persisted
 * status plus its ordered activity history.
 */
export interface RevisionEntityState {
  entityType: RevisionEntityType;
  status: PersistedRevisionStatus;
  history: RevisionHistoryRow[];
}

/**
 * Result of applying a revision step. On success the (possibly unchanged, when
 * `noop`) next state is returned; on failure the state is returned UNCHANGED so
 * callers can assert immutability of the entity on rejected operations.
 */
export type ApplyResult =
  | { ok: true; noop: boolean; state: RevisionEntityState }
  | { ok: false; error: string; state: RevisionEntityState };

/**
 * Bahasa Indonesia error mirrored from the server action guard (Req 4.14).
 */
export const NOT_REJECTED_ERROR = "Hanya item yang ditolak yang dapat direvisi";

/** Error mirrored from the resubmit validation-failure path (Req 4.15). */
export const VALIDATION_FAILED_ERROR = "Validasi input gagal";

/**
 * Error mirrored from the rejection guard: a non-empty reason (1..500 chars) is
 * required when transitioning a finance entity to `rejected` (Req 13.4).
 */
export const REJECTION_REASON_REQUIRED_ERROR =
  "Alasan penolakan wajib diisi";

// ---------------------------------------------------------------------------
// Draft computation
// ---------------------------------------------------------------------------

/**
 * Whether an OPEN revision draft exists for the given ordered history.
 *
 * An open draft = the most recent `revised` row occurs AFTER the most recent
 * `resubmitted` row (or there is a `revised` row and no `resubmitted` row at
 * all). Once a `resubmitted` row follows a `revised` row, the draft is closed.
 * This mirrors `hasOpenDraft` in `server/actions/finance-revision.ts`.
 *
 * Pure: does not mutate `history`.
 */
export function hasOpenDraft(
  history: readonly RevisionHistoryRow[],
): boolean {
  let lastRevised = -1;
  let lastResubmitted = -1;
  history.forEach((row, index) => {
    if (row.action === "revised") lastRevised = index;
    else if (row.action === "resubmitted") lastResubmitted = index;
  });
  if (lastRevised === -1) return false;
  return lastRevised > lastResubmitted;
}

// ---------------------------------------------------------------------------
// Step 1 — start-revision (rejected → draft)
// ---------------------------------------------------------------------------

/**
 * Apply the start-revision step to an entity state.
 *
 * Semantics (mirroring `startPaymentRevision` / `startExpenseApprovalRevision`):
 * - Guard: the entity MUST be `rejected`, else fail with {@link NOT_REJECTED_ERROR}
 *   and leave the state unchanged (Req 4.14).
 * - Validate the logical transition `rejected → draft` via
 *   `canTransitionRevisionState` (Req 13.1).
 * - Idempotency: if an OPEN draft already exists, this is a no-op success — the
 *   state is returned unchanged and NO duplicate `revised` marker is appended.
 * - Otherwise append exactly one `revised` marker WITHOUT changing `status`
 *   (the entity stays `rejected`) (Req 4.4 step 1, 13.1).
 *
 * Pure: never mutates the input `state`; returns a new state on change.
 */
export function applyStartRevision(
  state: RevisionEntityState,
): ApplyResult {
  // Guard: only rejected items can be revised (Req 4.14).
  if (state.status !== "rejected") {
    return { ok: false, error: NOT_REJECTED_ERROR, state };
  }

  // Validate the logical transition rejected → draft (Req 13.1, 13.7).
  if (!canTransitionRevisionState(state.entityType, "rejected", "draft")) {
    return { ok: false, error: NOT_REJECTED_ERROR, state };
  }

  // Idempotency: an open draft already exists → no-op success, no duplicate.
  if (hasOpenDraft(state.history)) {
    return { ok: true, noop: true, state };
  }

  // Open the draft: append `revised`, status UNCHANGED (stays rejected).
  return {
    ok: true,
    noop: false,
    state: {
      ...state,
      status: state.status,
      history: [...state.history, { action: "revised" }],
    },
  };
}

// ---------------------------------------------------------------------------
// Step 2 — resubmit (draft → pending)
// ---------------------------------------------------------------------------

/**
 * Apply the resubmit step to an entity state.
 *
 * Semantics (mirroring `resubmitPaymentRevision` / resubmit approval):
 * - Field validation happens first; when `data.valid === false` the resubmit
 *   fails with {@link VALIDATION_FAILED_ERROR}, performs NO mutation, writes NO
 *   `resubmitted` row, and leaves the entity `rejected` with its open-draft
 *   marker intact (Req 4.15).
 * - Guard: the entity MUST still be `rejected`, else fail with
 *   {@link NOT_REJECTED_ERROR} and leave the state unchanged (Req 4.14).
 * - Validate the logical transition `draft → pending` via
 *   `canTransitionRevisionState` (Req 13.2, 13.5).
 * - On success: flip `status` to `pending` and append a `resubmitted` marker,
 *   which CLOSES the open draft (Req 4.4 step 2, 4.7, 13.2, 13.5).
 *
 * `data.valid` defaults to `true` (a valid resubmission) when omitted.
 *
 * Pure: never mutates the input `state`; returns a new state on change.
 */
export function applyResubmit(
  state: RevisionEntityState,
  data: { valid?: boolean } = {},
): ApplyResult {
  const isValid = data.valid ?? true;

  // Validation runs first (Req 4.4): on failure, nothing changes (Req 4.15).
  if (!isValid) {
    return { ok: false, error: VALIDATION_FAILED_ERROR, state };
  }

  // Re-guard: only rejected items can be resubmitted (Req 4.14).
  if (state.status !== "rejected") {
    return { ok: false, error: NOT_REJECTED_ERROR, state };
  }

  // Validate the logical transition draft → pending (Req 13.2, 13.5).
  if (!canTransitionRevisionState(state.entityType, "draft", "pending")) {
    return { ok: false, error: NOT_REJECTED_ERROR, state };
  }

  // Success: flip rejected → pending and append `resubmitted` (closes draft).
  return {
    ok: true,
    noop: false,
    state: {
      ...state,
      status: "pending",
      history: [...state.history, { action: "resubmitted" }],
    },
  };
}

// ---------------------------------------------------------------------------
// Rejection (pending → rejected)
// ---------------------------------------------------------------------------

/**
 * Apply a rejection to an entity state.
 *
 * Semantics (mirroring the server rejection guard used by `rejectPayment` /
 * `rejectExpense`):
 * - Guard: the entity MUST be `pending`, else fail with
 *   {@link NOT_REJECTED_ERROR}-equivalent behavior and leave the state
 *   unchanged (a rejection only applies to a pending item).
 * - A non-empty reason (1..500 chars) is required (Req 13.4); on a missing or
 *   empty reason the rejection fails with {@link REJECTION_REASON_REQUIRED_ERROR}
 *   and leaves the state unchanged.
 * - Validate the logical transition `pending → rejected` via
 *   `canTransitionRevisionState` (Req 13.6).
 * - On success: append a `rejected` row (carrying the persisted `reason`) and
 *   flip `status` to `rejected`. Prior history is preserved verbatim — the new
 *   row is only ever APPENDED (Req 4.8, 4.11, 12.5).
 *
 * This helper exists to drive multi-cycle revision sequences
 * (reject → start → resubmit → reject → …) in tests. It is a pure mirror of the
 * server rejection semantics: rejection is `pending → rejected` and appends a
 * `rejected` history row.
 *
 * Pure: never mutates the input `state`; returns a new state on change.
 */
export function applyReject(
  state: RevisionEntityState,
  data: { reason?: string } = {},
): ApplyResult {
  const reason = data.reason;

  // A non-empty reason is required to reject (Req 13.4).
  if (reason === undefined || reason.length === 0 || reason.length > 500) {
    return { ok: false, error: REJECTION_REASON_REQUIRED_ERROR, state };
  }

  // Guard: only a pending item can be rejected.
  if (state.status !== "pending") {
    return { ok: false, error: NOT_REJECTED_ERROR, state };
  }

  // Validate the logical transition pending → rejected (Req 13.6).
  if (!canTransitionRevisionState(state.entityType, "pending", "rejected")) {
    return { ok: false, error: NOT_REJECTED_ERROR, state };
  }

  // Success: append `rejected` (with reason) and flip pending → rejected.
  return {
    ok: true,
    noop: false,
    state: {
      ...state,
      status: "rejected",
      history: [...state.history, { action: "rejected", reason }],
    },
  };
}
