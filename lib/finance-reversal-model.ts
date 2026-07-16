/**
 * Finance Reversal Model — lib/finance-reversal-model.ts
 *
 * Pure, database-independent model of the ledger reversal/correction accounting
 * computation, extracted from `reverseTransaction` /
 * `insertReversalAdjustment` in `server/actions/finance-revision.ts`. It mirrors
 * the server action's `inverseAdjustmentSpec` + adjustment field mapping EXACTLY
 * so the reversal accounting can be property-tested in isolation (there is no
 * live DB test harness in this repo).
 *
 * Design context (see design.md, design decision #2 "Ledger reversal/correction
 * accounting" + "Reversal Category Source"):
 *
 *   A reversal inserts the ACCOUNTING INVERSE of the original as a NEW
 *   adjustment transaction, linked back via `reversalOfTransactionId`, WITHOUT
 *   ever mutating the original row (Req 7.6, 12.4). The adjustment carries the
 *   same amount + accountId as the original, the inverse type (income↔expense),
 *   and the approvalStatus that makes it actually count in the existing
 *   `computeCurrentBalance` formula so the original and its adjustment net to
 *   zero with NO engine change (Req 12.6):
 *
 *       computeCurrentBalance =
 *         openingBalance
 *         + Σ(amount where type='income'  AND approvalStatus='not_required')
 *         − Σ(amount where type='expense' AND approvalStatus='approved')
 *
 *   Inverse spec (must match `inverseAdjustmentSpec` in the server action):
 *     • original EXPENSE / approved     → adjustment INCOME  / not_required
 *     • original INCOME  / not_required → adjustment EXPENSE / approved
 *
 * NOTE (task 10.4 reuse): this module also exposes `signedBalanceContribution`,
 * a pure helper for the signed balance effect of a transaction under the
 * `computeCurrentBalance` rule, so the balance-restoration property (Property 6)
 * can reuse the same model.
 *
 * _Requirements: 7.6, 12.4, 12.6_
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The transaction type discriminator (mirrors `transactions.type`). */
export type TransactionType = "income" | "expense";

/** The approval statuses relevant to reversal + balance (mirrors `transactions.approvalStatus`). */
export type ApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "insufficient_balance";

/**
 * The subset of an original transaction's fields the reversal computation needs.
 * Mirrors the fields `insertReversalAdjustment` reads off the original row.
 */
export interface OriginalTransaction {
  id: string;
  type: TransactionType;
  approvalStatus: ApprovalStatus;
  amount: number;
  accountId: string;
}

/**
 * The descriptor of the inverse adjustment the reversal inserts. Mirrors the
 * accounting-relevant fields of the row `insertReversalAdjustment` writes:
 * inverse type, netting approvalStatus, same amount + accountId, and the
 * reversal linkage back to the original.
 */
export interface ReversalAdjustment {
  type: TransactionType;
  approvalStatus: "not_required" | "approved";
  amount: number;
  accountId: string;
  reversalOfTransactionId: string;
}

// ---------------------------------------------------------------------------
// Inverse spec — MUST mirror `inverseAdjustmentSpec` in the server action
// ---------------------------------------------------------------------------

/**
 * The accounting inverse of a transaction type, and the approvalStatus the
 * inverse adjustment must carry so it counts in `computeCurrentBalance` and nets
 * the original out (Req 12.6).
 *
 * This is the single source of truth for the inverse spec; the server action
 * (`inverseAdjustmentSpec`) delegates here so the two can never drift.
 */
export function inverseAdjustmentSpec(
  originalType: TransactionType,
): { type: TransactionType; approvalStatus: "not_required" | "approved" } {
  return originalType === "expense"
    ? { type: "income", approvalStatus: "not_required" }
    : { type: "expense", approvalStatus: "approved" };
}

// ---------------------------------------------------------------------------
// Reversal adjustment builder
// ---------------------------------------------------------------------------

/**
 * Build the inverse adjustment descriptor for a finalized original transaction.
 *
 * Pure: the `original` object is NEVER mutated (Req 7.6). Returns a NEW,
 * distinct descriptor whose linkage (`reversalOfTransactionId`) points back to
 * the original. Mirrors the field mapping in `insertReversalAdjustment`:
 *   - `type`  = inverse of `original.type`
 *   - `approvalStatus` = the netting status for that inverse type
 *   - `amount` = `original.amount` (unchanged)
 *   - `accountId` = `original.accountId` (unchanged)
 *   - `reversalOfTransactionId` = `original.id`
 */
export function buildReversalAdjustment(
  original: OriginalTransaction,
): ReversalAdjustment {
  const { type, approvalStatus } = inverseAdjustmentSpec(original.type);
  return {
    type,
    approvalStatus,
    amount: original.amount,
    accountId: original.accountId,
    reversalOfTransactionId: original.id,
  };
}

// ---------------------------------------------------------------------------
// Balance contribution — reused by Property 6 (task 10.4)
// ---------------------------------------------------------------------------

/**
 * The signed balance contribution of a single transaction under the existing
 * `computeCurrentBalance` rule (design decision #2):
 *
 *   +amount  when type='income'  AND approvalStatus='not_required'
 *   −amount  when type='expense' AND approvalStatus='approved'
 *    0       otherwise (pending, rejected, insufficient_balance, and any other
 *            type/status combination that the balance engine does not count)
 *
 * Pure and total. Reused by the balance-restoration property (task 10.4) to
 * assert that an original + its inverse adjustment net to zero.
 */
export function signedBalanceContribution(
  tx: Pick<OriginalTransaction, "type" | "approvalStatus" | "amount">,
): number {
  if (tx.type === "income" && tx.approvalStatus === "not_required") {
    return tx.amount;
  }
  if (tx.type === "expense" && tx.approvalStatus === "approved") {
    return -tx.amount;
  }
  return 0;
}
