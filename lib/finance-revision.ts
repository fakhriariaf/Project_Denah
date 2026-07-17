/**
 * Finance Revision Transition Logic — lib/finance-revision.ts
 *
 * Pure utility module that encodes the two-step revision state machine for
 * rejected finance entities (payments and expense approvals) in the Denah
 * Property ERP. It answers a single question: is a given revision-state
 * transition allowed?
 *
 * Design context (see design.md, "Two-step revision model"):
 * - Revision is split into two explicit steps:
 *     1. start-revision: rejected → draft   (opens a draft marker, NO status change)
 *     2. resubmit:       draft → pending     (closes the draft, moves to pending)
 *   Rejection itself is:  pending → rejected.
 * - "draft" is a LOGICAL state string used only by this function. It is NEVER
 *   persisted as a status enum value. The persisted entity stays `rejected`
 *   for the whole draft window; the open/closed draft is tracked via
 *   `finance_activity_history` (`revised` → `resubmitted`) rows instead.
 *
 * The allowed edge set is EXACTLY (and identical across all entity types):
 *     rejected → draft
 *     draft    → pending
 *     pending  → rejected
 *
 * Everything else returns `false`, including:
 * - any transition out of a final state (verified, approved, paid, etc.)
 * - self-loops (e.g. rejected → rejected)
 * - unknown / freeform states
 * - reversed edges (e.g. pending → draft, draft → rejected)
 *
 * Contract:
 * - Pure function: no database, no React, no I/O, no side effects.
 * - Deterministic: output depends only on the arguments.
 * - `entityType` is accepted for API stability and future divergence, but the
 *   allowed edges are the same for every finance entity type per the design.
 *
 * _Requirements: 13.1, 13.2, 13.5, 13.6, 13.7_
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Finance entity types that participate in the revision flow, matching the
 * `entityType` union on `finance_activity_history` (db/schema/finance.ts).
 * Only `payment` and `approval` actually undergo revision today, but the full
 * union is accepted so the signature stays stable across the finance module.
 */
export type FinanceEntityType =
  | "invoice"
  | "payment"
  | "transaction"
  | "approval"
  | "budget";

/**
 * The set of states this transition function reasons about.
 *
 * - `rejected` and `pending` are real persisted `status`/`approvalStatus`
 *   values on the finance entities.
 * - `draft` is a LOGICAL-ONLY state, never persisted. It represents an open
 *   revision draft (a `revised` history row with no later `resubmitted` row).
 */
export type RevisionState = "rejected" | "draft" | "pending";

// ---------------------------------------------------------------------------
// Allowed edge set
// ---------------------------------------------------------------------------

/**
 * The complete, exact set of allowed revision-state edges, encoded as
 * `${from}->${to}` keys. Membership in this set is the ONLY thing that makes
 * a transition legal. The edges are the same for every entity type.
 */
const ALLOWED_EDGES: ReadonlySet<string> = new Set<string>([
  "rejected->draft", // start-revision: open a draft marker, no status change
  "draft->pending", //  resubmit: close the draft and move to pending
  "pending->rejected", // rejection: reject a pending item (requires a reason elsewhere)
]);

/** The states this function recognizes as valid inputs. */
const KNOWN_STATES: ReadonlySet<string> = new Set<RevisionState>([
  "rejected",
  "draft",
  "pending",
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the revision-state transition from `fromState` to
 * `toState` is allowed for the given `entityType`, and `false` otherwise.
 *
 * Allowed edges (exactly): rejected→draft, draft→pending, pending→rejected.
 * Any other transition — including transitions out of final states, self-loops,
 * reversed edges, and unknown/freeform states — returns `false`.
 *
 * This is a pure, database-independent function suitable for unit and property
 * testing in isolation (Req 13.7).
 *
 * @param entityType - The finance entity type (accepted for API stability;
 *                      allowed edges are identical across entity types).
 * @param fromState  - The current revision state.
 * @param toState    - The proposed next revision state.
 * @returns whether the transition is permitted.
 */
export function canTransitionRevisionState(
  entityType: FinanceEntityType,
  fromState: string,
  toState: string,
): boolean {
  // Reject unknown/freeform states outright. Any final state (verified,
  // approved, paid, cancelled, ...) is simply not a known revision state and
  // therefore has no allowed outgoing or incoming edge.
  if (!KNOWN_STATES.has(fromState) || !KNOWN_STATES.has(toState)) {
    return false;
  }

  // The edge set is identical across entity types per the design; `entityType`
  // is intentionally not branched on today.
  void entityType;

  return ALLOWED_EDGES.has(`${fromState}->${toState}`);
}
