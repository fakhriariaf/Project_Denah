"use server";

/**
 * Finance Revision Server Actions — server/actions/finance-revision.ts
 *
 * Implements the two-step revision flow for rejected finance entities, as
 * defined in design.md ("Two-step revision model"). This file covers the
 * PAYMENT revision path (Task 5.4). Expense-approval revision lives in a later
 * task.
 *
 * The flow is deliberately split into two explicit server actions so the
 * `revised` → `resubmitted` history-marker pair is the single source of truth
 * for the logical "draft" state (no new persisted status enum value is added):
 *
 *   1. startPaymentRevision(paymentId)
 *      - Opens a revision draft by writing a `revised` finance-activity-history
 *        row with a snapshot of the current editable fields.
 *      - Does NOT change payments.status (the entity stays `rejected`).
 *      - Idempotent: a no-op success if an open draft already exists.
 *
 *   2. resubmitPaymentRevision(paymentId, data)
 *      - Validates the revised fields, applies the update, flips the entity
 *        `rejected → pending`, and writes a `resubmitted` row (with before/after
 *        snapshots preserving old + new attachment paths). This closes the draft.
 *      - On validation failure: no mutation, no `resubmitted` row, the entity
 *        stays `rejected`, the open-draft `revised` marker remains, and the
 *        action returns structured field errors so the dialog can stay open.
 *
 * Permission: both steps gate on `isKeuangan || isSuperAdmin` (Req 10.1). A
 * wrong-role call throws an authorization error WITHOUT mutating and WITHOUT a
 * redirect (Req 10.7, 10.8) — matching the existing `verifyPayment` convention.
 *
 * Both steps validate the logical transition through the pure
 * `canTransitionRevisionState` utility (Req 13.1, 13.2, 13.5).
 *
 * _Requirements: 4.1, 4.2, 4.4, 4.9, 4.14, 4.15, 6.5, 10.1, 10.7, 10.8, 13.1, 13.2, 13.5_
 */

import { db } from "@/db";
import { payments, transactions, invoices, financeActivityHistory } from "@/db/schema/finance";
import { financeCategories } from "@/db/schema/master";
import { attachments } from "@/db/schema/system";
import { requireAuth, getSessionRole } from "@/server/permissions";
import { eq, and, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { writeAuditLog } from "./audit";
import { recordFinanceActivity } from "./finance";
import {
  paymentRevisionSchema,
  expenseApprovalRevisionSchema,
  rejectionReasonSchema,
  transactionCorrectionSchema,
} from "../validators/finance";
import { canTransitionRevisionState } from "@/lib/finance-revision";
import { inverseAdjustmentSpec } from "@/lib/finance-reversal-model";

/**
 * The transaction handle passed by `db.transaction(async (tx) => { ... })`.
 * Derived from the actual `db.transaction` signature so it stays correct if the
 * driver changes (mirrors the type used in `finance.ts`).
 */
type FinanceTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Snapshot of the editable fields of a payment, stored in
 * `finance_activity_history.snapshotBefore` / `snapshotAfter`. Includes the
 * proof attachment id AND its resolved file path so old + new attachment paths
 * are preserved in the timeline (Req 4.9).
 */
interface PaymentEditableSnapshot {
  amount: number;
  paymentDate: string | null;
  paymentMethod: string;
  proofAttachmentId: string | null;
  proofAttachmentPath: string | null;
}

/**
 * Result contract for the payment revision actions. Serializable so it can be
 * returned to the client `RevisionDialog` (Task 6.2). On validation failure the
 * `fieldErrors` map lets the dialog render field-level messages and keep the
 * user's entered data (Req 4.15).
 */
export type PaymentRevisionResult =
  | { success: true; noop?: boolean }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Generic revision-action result shape, shared by the payment and expense-approval
 * revision flows (both return the same serializable success/field-error contract).
 * `PaymentRevisionResult` is kept as the historical name; `RevisionResult` and
 * `ExpenseApprovalRevisionResult` are aliases so callers can use an entity-specific
 * name without breaking the existing export.
 */
export type RevisionResult = PaymentRevisionResult;
export type ExpenseApprovalRevisionResult = PaymentRevisionResult;

const NOT_REJECTED_ERROR = "Hanya item yang ditolak yang dapat direvisi";
const NOT_EXPENSE_ERROR = "Transaksi ini bukan pengeluaran";

/**
 * Resolve the stored file path (fileUrl) for a proof attachment id, if any.
 * Returns null when the payment has no proof attachment or the attachment row
 * is missing. Runs inside the caller's transaction.
 */
async function resolveAttachmentPath(
  tx: FinanceTransaction,
  proofAttachmentId: string | null,
): Promise<string | null> {
  if (!proofAttachmentId) return null;

  const rows = await tx
    .select({ fileUrl: attachments.fileUrl })
    .from(attachments)
    .where(eq(attachments.id, proofAttachmentId))
    .limit(1)
    .all();

  return rows.length > 0 ? rows[0].fileUrl : null;
}

/**
 * Build the editable-field snapshot for a payment row, resolving the proof
 * attachment path. Runs inside the caller's transaction.
 */
async function buildPaymentSnapshot(
  tx: FinanceTransaction,
  payment: typeof payments.$inferSelect,
): Promise<PaymentEditableSnapshot> {
  const proofAttachmentPath = await resolveAttachmentPath(tx, payment.proofAttachmentId);
  return {
    amount: payment.amount,
    paymentDate: payment.paymentDate ? payment.paymentDate.toISOString() : null,
    paymentMethod: payment.paymentMethod,
    proofAttachmentId: payment.proofAttachmentId,
    proofAttachmentPath,
  };
}

/**
 * Determine whether an OPEN revision draft exists for an entity.
 *
 * An open draft = a `revised` history row whose `createdAt` is later than the
 * most recent `resubmitted` row for the same entity (or a `revised` row with no
 * `resubmitted` row after it at all). Once a `resubmitted` row is written after
 * the `revised` row, the draft is closed. Runs inside the caller's transaction.
 */
async function hasOpenDraft(
  tx: FinanceTransaction,
  entityType: "payment" | "approval",
  entityId: string,
): Promise<boolean> {
  const latestRevised = await tx
    .select({ createdAt: financeActivityHistory.createdAt })
    .from(financeActivityHistory)
    .where(
      and(
        eq(financeActivityHistory.entityType, entityType),
        eq(financeActivityHistory.entityId, entityId),
        eq(financeActivityHistory.action, "revised"),
      ),
    )
    .orderBy(desc(financeActivityHistory.createdAt))
    .limit(1)
    .all();

  if (latestRevised.length === 0) return false;

  const latestResubmitted = await tx
    .select({ createdAt: financeActivityHistory.createdAt })
    .from(financeActivityHistory)
    .where(
      and(
        eq(financeActivityHistory.entityType, entityType),
        eq(financeActivityHistory.entityId, entityId),
        eq(financeActivityHistory.action, "resubmitted"),
      ),
    )
    .orderBy(desc(financeActivityHistory.createdAt))
    .limit(1)
    .all();

  if (latestResubmitted.length === 0) return true;

  return latestRevised[0].createdAt.getTime() > latestResubmitted[0].createdAt.getTime();
}

/**
 * Step 1 — start a payment revision.
 *
 * Opens a revision draft for a rejected payment by recording a `revised`
 * history row with a snapshot of the current editable fields. Does NOT change
 * `payments.status` — the entity stays `rejected` for the whole draft window.
 *
 * Idempotent: if an open draft already exists (e.g. the dialog is re-opened),
 * this is a no-op success rather than writing a duplicate marker.
 *
 * @param paymentId - the payment to open a revision draft for.
 * @throws when the caller lacks the required role, or the payment is missing /
 *         not in `rejected` status (no mutation is performed in those cases).
 */
export async function startPaymentRevision(
  paymentId: string,
): Promise<PaymentRevisionResult> {
  const activeUser = await requireAuth();

  // Role gate (Req 10.1, 10.8): only Admin Keuangan or Super Admin may revise.
  // Wrong role throws WITHOUT mutating and WITHOUT redirect (Req 10.7).
  const { isKeuangan, isSuperAdmin } = await getSessionRole(activeUser.id);
  if (!isKeuangan && !isSuperAdmin) {
    throw new Error("Anda tidak memiliki akses untuk merevisi pembayaran.");
  }

  if (!paymentId || paymentId.trim().length === 0) {
    throw new Error("ID pembayaran tidak valid");
  }

  await db.transaction(async (tx) => {
    const paymentResults = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1)
      .all();

    if (paymentResults.length === 0) {
      throw new Error("Pembayaran tidak ditemukan");
    }

    const payment = paymentResults[0];

    // Guard: only rejected items can be revised (Req 4.14).
    if (payment.status !== "rejected") {
      throw new Error(NOT_REJECTED_ERROR);
    }

    // Validate the logical transition rejected → draft (Req 13.1, 13.7).
    if (!canTransitionRevisionState("payment", "rejected", "draft")) {
      throw new Error(NOT_REJECTED_ERROR);
    }

    // Idempotency: if an open draft already exists, no-op (do not duplicate the
    // marker). The transaction below simply does nothing and commits.
    if (await hasOpenDraft(tx, "payment", paymentId)) {
      return;
    }

    // Open the draft: record `revised` with a snapshot of the current editable
    // fields. NO status change — the entity stays `rejected` (design 4.1 step 3).
    const snapshotBefore = await buildPaymentSnapshot(tx, payment);
    await recordFinanceActivity(tx, {
      entityType: "payment",
      entityId: paymentId,
      action: "revised",
      actorId: activeUser.id,
      fromStatus: "rejected",
      toStatus: "rejected",
      snapshotBefore,
    });
  });

  revalidatePath("/finance/payments");
  revalidatePath(`/finance/payments/${paymentId}`);
  return { success: true };
}

/**
 * Step 2 — resubmit a revised payment.
 *
 * Validates the revised fields, captures a before/after snapshot, applies the
 * update, flips the entity `rejected → pending`, and writes a `resubmitted`
 * history row (closing the open draft). Old + new attachment paths are stored
 * in the snapshots (Req 4.9).
 *
 * On validation failure: NO mutation is performed, NO `resubmitted` row is
 * written, the entity stays `rejected`, the open-draft `revised` marker
 * remains, and a structured field-error result is returned so the dialog stays
 * open with the entered data preserved (Req 4.15).
 *
 * @param paymentId - the payment being resubmitted.
 * @param data      - the revised editable fields (validated by paymentRevisionSchema).
 * @throws when the caller lacks the required role, or the payment is missing /
 *         not in `rejected` status (no mutation is performed in those cases).
 */
export async function resubmitPaymentRevision(
  paymentId: string,
  data: unknown,
): Promise<PaymentRevisionResult> {
  const activeUser = await requireAuth();

  // Role gate (Req 10.1, 10.8): wrong role throws WITHOUT mutating (Req 10.7).
  const { isKeuangan, isSuperAdmin } = await getSessionRole(activeUser.id);
  if (!isKeuangan && !isSuperAdmin) {
    throw new Error("Anda tidak memiliki akses untuk merevisi pembayaran.");
  }

  if (!paymentId || paymentId.trim().length === 0) {
    throw new Error("ID pembayaran tidak valid");
  }

  // Validate the revised fields FIRST (Req 4.4). On failure return structured
  // field errors and perform no mutation and write no `resubmitted` row
  // (Req 4.15). The entity stays rejected and the open-draft marker remains.
  const parsed = paymentRevisionSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of (parsed.error as ZodError).issues) {
      const path = issue.path.join(".") || "_form";
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
    return { success: false, error: "Validasi input gagal", fieldErrors };
  }

  const revision = parsed.data;

  await db.transaction(async (tx) => {
    const paymentResults = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1)
      .all();

    if (paymentResults.length === 0) {
      throw new Error("Pembayaran tidak ditemukan");
    }

    const payment = paymentResults[0];

    // Re-guard: only rejected items can be resubmitted (Req 4.14).
    if (payment.status !== "rejected") {
      throw new Error(NOT_REJECTED_ERROR);
    }

    // Validate the logical transition draft → pending (Req 13.2, 13.5).
    if (!canTransitionRevisionState("payment", "draft", "pending")) {
      throw new Error(NOT_REJECTED_ERROR);
    }

    // Capture the BEFORE snapshot (current editable fields incl. old proof path).
    const snapshotBefore = await buildPaymentSnapshot(tx, payment);

    const newProofAttachmentId = revision.proofAttachmentId ?? null;

    // Apply the update and flip rejected → pending (Req 4.4, 13.2, 13.5).
    await tx
      .update(payments)
      .set({
        amount: revision.amount,
        paymentDate: revision.paymentDate,
        paymentMethod: revision.paymentMethod,
        proofAttachmentId: newProofAttachmentId,
        status: "pending",
      })
      .where(eq(payments.id, paymentId))
      .run();

    // Build the AFTER snapshot from the revised values, resolving the new proof
    // attachment path so both old + new attachment paths are preserved (Req 4.9).
    const newProofAttachmentPath = await resolveAttachmentPath(tx, newProofAttachmentId);
    const snapshotAfter: PaymentEditableSnapshot = {
      amount: revision.amount,
      paymentDate: revision.paymentDate.toISOString(),
      paymentMethod: revision.paymentMethod,
      proofAttachmentId: newProofAttachmentId,
      proofAttachmentPath: newProofAttachmentPath,
    };

    // Record `resubmitted` — this closes the open draft (design 4.4 step 4).
    await recordFinanceActivity(tx, {
      entityType: "payment",
      entityId: paymentId,
      action: "resubmitted",
      actorId: activeUser.id,
      fromStatus: "rejected",
      toStatus: "pending",
      reason: revision.reason ?? null,
      snapshotBefore,
      snapshotAfter,
    });
  });

  // Audit log for the status change (rejected → pending) consistent with the
  // existing finance mutation pattern (AGENTS.md §8.3).
  await writeAuditLog({
    action: "update",
    module: "finance",
    entityId: paymentId,
    entityType: "payment",
    details: {
      revision: "resubmitted",
      fromStatus: "rejected",
      toStatus: "pending",
      amount: revision.amount,
    },
  });

  revalidatePath("/finance/payments");
  revalidatePath(`/finance/payments/${paymentId}`);
  return { success: true };
}

/* ------------------------------------------------------------------------- *
 * Expense approval revision (Task 8.2)
 *
 * Two-step revision flow for a REJECTED expense approval, mirroring the payment
 * revision path above but operating on the `transactions` table (the backing
 * table for expense approvals — design "Approval detail route ID" decision).
 *
 * Identity note (design decision #3): the route/entity identity for an expense
 * approval is `transactions.id`. `transaction_approvals.id` is only a child audit
 * log row and is NEVER used as the entity id. All `finance_activity_history` rows
 * for this flow use `entityType: "approval"` and `entityId: transactions.id`, so
 * the approval timeline never mixes with the ledger (`transaction`) timeline.
 *
 * Shadow invoice: `createExpenseRequest` creates an `INV-EXP-*` invoice whose
 * `notes = "trxId:<transactionId>"`. On rejection `rejectExpense` set it to
 * `cancelled`; on resubmit we re-open it `cancelled → unpaid` inside the same tx.
 *
 * Permission: both steps gate on `isKeuangan || isSuperAdmin` (Req 10.1). A
 * wrong-role call throws an authorization error WITHOUT mutating and WITHOUT a
 * redirect (Req 10.7).
 *
 * _Requirements: 4.5, 4.6, 4.7, 4.14, 4.15, 8.3, 10.1, 10.7, 13.1, 13.2, 13.5_
 * ------------------------------------------------------------------------- */

/**
 * Snapshot of the editable fields of an expense-approval transaction, stored in
 * `finance_activity_history.snapshotBefore` / `snapshotAfter`. Includes the
 * attachment id AND its resolved file path so old + new attachment paths are
 * preserved in the timeline (Req 4.9, parallel to the payment snapshot).
 */
interface ExpenseApprovalEditableSnapshot {
  amount: number;
  accountId: string;
  categoryId: string;
  description: string;
  attachmentId: string | null;
  attachmentPath: string | null;
}

const NOT_AUTHORIZED_APPROVAL_ERROR =
  "Anda tidak memiliki akses untuk merevisi pengajuan pengeluaran.";

/**
 * Build the editable-field snapshot for an expense-approval transaction row,
 * resolving the attachment path. Runs inside the caller's transaction.
 */
async function buildExpenseApprovalSnapshot(
  tx: FinanceTransaction,
  transaction: typeof transactions.$inferSelect,
): Promise<ExpenseApprovalEditableSnapshot> {
  const attachmentPath = await resolveAttachmentPath(tx, transaction.attachmentId);
  return {
    amount: transaction.amount,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    description: transaction.description,
    attachmentId: transaction.attachmentId,
    attachmentPath,
  };
}

/**
 * Step 1 — start an expense-approval revision.
 *
 * Opens a revision draft for a rejected expense approval by recording a
 * `revised` history row (entityType `approval`, entityId = `transactions.id`)
 * with a snapshot of the current editable fields. Does NOT change
 * `transactions.approvalStatus` — it stays `rejected` for the whole draft window.
 *
 * Idempotent: if an open draft already exists, this is a no-op success rather
 * than writing a duplicate marker.
 *
 * @param transactionId - the expense transaction to open a revision draft for.
 * @throws when the caller lacks the required role, or the transaction is missing
 *         / not an expense / not in `rejected` approvalStatus (no mutation in
 *         those cases).
 */
export async function startExpenseApprovalRevision(
  transactionId: string,
): Promise<ExpenseApprovalRevisionResult> {
  const activeUser = await requireAuth();

  // Role gate (Req 10.1): only Admin Keuangan or Super Admin may revise.
  // Wrong role throws WITHOUT mutating and WITHOUT redirect (Req 10.7).
  const { isKeuangan, isSuperAdmin } = await getSessionRole(activeUser.id);
  if (!isKeuangan && !isSuperAdmin) {
    throw new Error(NOT_AUTHORIZED_APPROVAL_ERROR);
  }

  if (!transactionId || transactionId.trim().length === 0) {
    throw new Error("ID transaksi tidak valid");
  }

  await db.transaction(async (tx) => {
    const trxResults = await tx
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1)
      .all();

    if (trxResults.length === 0) {
      throw new Error("Transaksi pengeluaran tidak ditemukan");
    }

    const transaction = trxResults[0];

    // Guard: only an expense transaction can be an expense approval (Req 8.3).
    if (transaction.type !== "expense") {
      throw new Error(NOT_EXPENSE_ERROR);
    }

    // Guard: only rejected items can be revised (Req 4.14).
    if (transaction.approvalStatus !== "rejected") {
      throw new Error(NOT_REJECTED_ERROR);
    }

    // Validate the logical transition rejected → draft (Req 13.1, 13.7).
    if (!canTransitionRevisionState("approval", "rejected", "draft")) {
      throw new Error(NOT_REJECTED_ERROR);
    }

    // Idempotency: if an open draft already exists, no-op (do not duplicate the
    // marker). Entity identity is transactions.id (design decision #3).
    if (await hasOpenDraft(tx, "approval", transactionId)) {
      return;
    }

    // Open the draft: record `revised` with a snapshot of the current editable
    // fields. NO status change — approvalStatus stays `rejected`.
    const snapshotBefore = await buildExpenseApprovalSnapshot(tx, transaction);
    await recordFinanceActivity(tx, {
      entityType: "approval",
      entityId: transactionId,
      action: "revised",
      actorId: activeUser.id,
      fromStatus: "rejected",
      toStatus: "rejected",
      snapshotBefore,
    });
  });

  revalidatePath("/finance/approvals");
  revalidatePath(`/finance/approvals/${transactionId}`);
  return { success: true };
}

/**
 * Step 2 — resubmit a revised expense approval.
 *
 * Validates the revised fields, captures a before/after snapshot, applies the
 * update to the transaction, flips `approvalStatus rejected → pending`, re-opens
 * the shadow `INV-EXP-*` invoice (`notes = "trxId:<transactionId>"`) from
 * `cancelled → unpaid`, and writes a `resubmitted` history row (closing the open
 * draft). Old + new attachment paths are stored in the snapshots (Req 4.9).
 *
 * On validation failure: NO mutation is performed, NO `resubmitted` row is
 * written, `approvalStatus` stays `rejected`, the open-draft `revised` marker
 * remains, and a structured field-error result is returned so the dialog stays
 * open with the entered data preserved (Req 4.15).
 *
 * @param transactionId - the expense transaction being resubmitted.
 * @param data          - the revised editable fields (validated by
 *                        `expenseApprovalRevisionSchema`).
 * @throws when the caller lacks the required role, or the transaction is missing
 *         / not an expense / not in `rejected` approvalStatus.
 */
export async function resubmitExpenseApprovalRevision(
  transactionId: string,
  data: unknown,
): Promise<ExpenseApprovalRevisionResult> {
  const activeUser = await requireAuth();

  // Role gate (Req 10.1): wrong role throws WITHOUT mutating (Req 10.7).
  const { isKeuangan, isSuperAdmin } = await getSessionRole(activeUser.id);
  if (!isKeuangan && !isSuperAdmin) {
    throw new Error(NOT_AUTHORIZED_APPROVAL_ERROR);
  }

  if (!transactionId || transactionId.trim().length === 0) {
    throw new Error("ID transaksi tidak valid");
  }

  // Validate the revised fields FIRST (Req 4.6, 4.7). On failure return
  // structured field errors and perform no mutation and write no `resubmitted`
  // row (Req 4.15). The entity stays rejected and the open-draft marker remains.
  const parsed = expenseApprovalRevisionSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of (parsed.error as ZodError).issues) {
      const path = issue.path.join(".") || "_form";
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
    return { success: false, error: "Validasi input gagal", fieldErrors };
  }

  const revision = parsed.data;

  await db.transaction(async (tx) => {
    const trxResults = await tx
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1)
      .all();

    if (trxResults.length === 0) {
      throw new Error("Transaksi pengeluaran tidak ditemukan");
    }

    const transaction = trxResults[0];

    // Re-guard: expense + rejected only (Req 8.3, 4.14).
    if (transaction.type !== "expense") {
      throw new Error(NOT_EXPENSE_ERROR);
    }
    if (transaction.approvalStatus !== "rejected") {
      throw new Error(NOT_REJECTED_ERROR);
    }

    // Validate the logical transition draft → pending (Req 13.2, 13.5).
    if (!canTransitionRevisionState("approval", "draft", "pending")) {
      throw new Error(NOT_REJECTED_ERROR);
    }

    // Capture the BEFORE snapshot (current editable fields incl. old attachment).
    const snapshotBefore = await buildExpenseApprovalSnapshot(tx, transaction);

    const newAttachmentId = revision.attachmentId ?? null;

    // Apply the update and flip approvalStatus rejected → pending (Req 4.7, 13.2).
    await tx
      .update(transactions)
      .set({
        amount: revision.amount,
        accountId: revision.accountId,
        categoryId: revision.categoryId,
        description: revision.description,
        attachmentId: newAttachmentId,
        approvalStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, transactionId))
      .run();

    // Re-open the shadow INV-EXP-* invoice cancelled → unpaid, and keep its
    // amount in sync with the revised amount (Req 8.3). Matched by the same
    // `notes = "trxId:<id>"` marker rejectExpense uses to cancel it.
    await tx
      .update(invoices)
      .set({
        status: "unpaid",
        amount: revision.amount,
        updatedAt: new Date(),
      })
      .where(eq(invoices.notes, `trxId:${transactionId}`))
      .run();

    // Build the AFTER snapshot from the revised values, resolving the new
    // attachment path so both old + new attachment paths are preserved (Req 4.9).
    const newAttachmentPath = await resolveAttachmentPath(tx, newAttachmentId);
    const snapshotAfter: ExpenseApprovalEditableSnapshot = {
      amount: revision.amount,
      accountId: revision.accountId,
      categoryId: revision.categoryId,
      description: revision.description,
      attachmentId: newAttachmentId,
      attachmentPath: newAttachmentPath,
    };

    // Record `resubmitted` — closes the open draft. entityType `approval`,
    // entityId = transactions.id (design decision #3).
    await recordFinanceActivity(tx, {
      entityType: "approval",
      entityId: transactionId,
      action: "resubmitted",
      actorId: activeUser.id,
      fromStatus: "rejected",
      toStatus: "pending",
      reason: revision.reason ?? null,
      snapshotBefore,
      snapshotAfter,
    });
  });

  // Audit log for the status change (rejected → pending) consistent with the
  // existing finance mutation pattern (AGENTS.md §8.3).
  await writeAuditLog({
    action: "update",
    module: "finance",
    entityId: transactionId,
    entityType: "transaction",
    details: {
      revision: "resubmitted",
      fromStatus: "rejected",
      toStatus: "pending",
      amount: revision.amount,
    },
  });

  revalidatePath("/finance/approvals");
  revalidatePath(`/finance/approvals/${transactionId}`);
  revalidatePath("/finance/transactions");
  return { success: true };
}

/* ------------------------------------------------------------------------- *
 * Ledger correction / reversal (Task 10.2, Phase 4)
 *
 * Implements the design's "Correction event with a linked adjustment
 * transaction" model (design decision #2 + "Reversal Category Source"). The
 * ORIGINAL row is NEVER mutated. Instead we insert the ACCOUNTING INVERSE of the
 * original as a new adjustment transaction linked via `reversalOfTransactionId`,
 * so the existing `computeCurrentBalance` formula
 *
 *     openingBalance + Σ(income, approvalStatus='not_required')
 *                    − Σ(expense, approvalStatus='approved')
 *
 * nets the original and its adjustment to zero WITHOUT any engine change
 * (Req 12.6). The chosen adjustment type + approvalStatus per direction:
 *
 *   • original EXPENSE / approved      (counted as −amount)
 *       → adjustment INCOME  / not_required (counted as +amount) ⇒ nets to 0
 *   • original INCOME  / not_required  (counted as +amount)
 *       → adjustment EXPENSE / approved     (counted as −amount) ⇒ nets to 0
 *
 * Guards:
 *   • role gate isKeuangan || isSuperAdmin (Req 10.1); wrong role throws, no
 *     mutation, no redirect (Req 10.7).
 *   • only a FINALIZED original may be reversed: approvalStatus ∈
 *     {approved, not_required} (Req 7.5, 12.1). Anything else is rejected.
 *   • an already-reversed original (an adjustment already links to it) is
 *     rejected (Req 7.8) — no second adjustment is inserted.
 *   • the required seeded "Koreksi & Pembalikan" category (matching the
 *     adjustment type) MUST exist; if missing the action throws a Bahasa
 *     Indonesia validation error INSIDE the tx so nothing is inserted (Req 7.7).
 *
 * The reversal never runs the `approveExpense` budget-decrement path and never
 * touches `computeCurrentBalance` (design "Reversal Category Source" #4).
 *
 * _Requirements: 7.5, 7.6, 7.7, 7.8, 12.1, 12.4, 12.6_
 * ------------------------------------------------------------------------- */

/** Finalized approval statuses eligible for reversal/correction (Req 7.5, 12.1). */
const FINALIZED_APPROVAL_STATUSES = ["approved", "not_required"] as const;

const NOT_AUTHORIZED_REVERSAL_ERROR =
  "Anda tidak memiliki akses untuk membalik atau mengoreksi transaksi.";
const NOT_FINALIZED_ERROR =
  "Hanya transaksi final (disetujui / tidak memerlukan persetujuan) yang dapat dibalik.";
const ALREADY_REVERSED_ERROR =
  "Transaksi ini sudah pernah dibalik sebelumnya.";
const REVERSAL_CATEGORY_MISSING_ERROR =
  "Kategori 'Koreksi & Pembalikan' belum dikonfigurasi. Harap seed kategori koreksi di Master dahulu.";

/** Serializable result contract for the reversal/correction actions. */
export type ReversalResult =
  | { success: true; adjustmentTransactionId: string; replacementTransactionId?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * The accounting inverse of a transaction type + the netting approvalStatus is
 * defined once in the pure model `lib/finance-reversal-model.ts` and imported as
 * `inverseAdjustmentSpec` (see the top-of-file imports). The pure model mirrors
 * this mapping exactly and is property-tested in isolation (there is no live DB
 * test harness); keeping a single source of truth prevents the server action and
 * the tested model from drifting (Req 12.6).
 */

/**
 * Resolve the seeded global "Koreksi & Pembalikan" category whose `type` matches
 * the ADJUSTMENT type (the inverse of the original). Matches by well-known name
 * (case-insensitive `LIKE '%koreksi%pembalikan%'`) consistent with the existing
 * category-lookup pattern in `verifyPayment`. Returns null when none is found so
 * the caller can BLOCK the reversal (Req 7.7). Runs inside the caller's tx.
 */
async function resolveReversalCategoryId(
  tx: FinanceTransaction,
  adjustmentType: "income" | "expense",
): Promise<string | null> {
  const rows = await tx
    .select({ id: financeCategories.id })
    .from(financeCategories)
    .where(
      and(
        eq(financeCategories.type, adjustmentType),
        sql`lower(${financeCategories.name}) LIKE '%koreksi%pembalikan%'`,
      ),
    )
    .limit(1)
    .all();

  return rows.length > 0 ? rows[0].id : null;
}

/**
 * Whether the given original transaction already has a linked reversal
 * adjustment (i.e. some row has `reversalOfTransactionId = originalId`). Used to
 * reject double-reversal (Req 7.8). Runs inside the caller's tx.
 */
async function hasExistingReversal(
  tx: FinanceTransaction,
  originalId: string,
): Promise<boolean> {
  const rows = await tx
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.reversalOfTransactionId, originalId))
    .limit(1)
    .all();

  return rows.length > 0;
}

/** Generate a TRX-* number consistent with the existing finance numbering. */
function generateTransactionNumber(prefix: string): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${prefix}-${dateStr}-${rand}`;
}

/**
 * Insert the inverse adjustment for a finalized original transaction and record
 * the `reversed` timeline event, all inside the caller's `tx`. Returns the new
 * adjustment transaction id. The ORIGINAL row is never mutated.
 *
 * Throws {@link REVERSAL_CATEGORY_MISSING_ERROR} (rolling back the whole tx) when
 * the seeded reversal category is missing, so nothing is inserted (Req 7.7).
 *
 * Shared by both `reverseTransaction` and `correctTransaction`.
 */
async function insertReversalAdjustment(
  tx: FinanceTransaction,
  original: typeof transactions.$inferSelect,
  reason: string,
  actorId: string,
): Promise<string> {
  const { type: adjustmentType, approvalStatus } = inverseAdjustmentSpec(original.type);

  // Resolve the seeded reversal category for the ADJUSTMENT type; block if absent.
  const categoryId = await resolveReversalCategoryId(tx, adjustmentType);
  if (!categoryId) {
    throw new Error(REVERSAL_CATEGORY_MISSING_ERROR);
  }

  const adjustmentId = crypto.randomUUID();
  const adjustmentNumber = generateTransactionNumber(
    adjustmentType === "income" ? "TRX-REV-IN" : "TRX-REV-OUT",
  );

  // Insert the inverse adjustment: same amount + accountId as the original so
  // the pair nets to zero under computeCurrentBalance (Req 12.6). It carries the
  // reversal linkage + reason and is NEVER a mutation of the original (Req 7.6).
  await tx
    .insert(transactions)
    .values({
      id: adjustmentId,
      transactionNumber: adjustmentNumber,
      projectId: original.projectId,
      unitId: original.unitId,
      customerId: original.customerId,
      accountId: original.accountId,
      categoryId,
      type: adjustmentType,
      description: `Pembalikan transaksi ${original.transactionNumber}: ${reason}`,
      amount: original.amount,
      transactionDate: new Date(),
      paymentMethod: original.paymentMethod,
      approvalStatus,
      reversalOfTransactionId: original.id,
      reversalReason: reason,
      createdBy: actorId,
    })
    .run();

  // Record `reversed` against the ORIGINAL entity (entityType "transaction").
  await recordFinanceActivity(tx, {
    entityType: "transaction",
    entityId: original.id,
    action: "reversed",
    actorId,
    fromStatus: original.approvalStatus,
    toStatus: original.approvalStatus, // original is never mutated
    reason,
    snapshotAfter: {
      adjustmentTransactionId: adjustmentId,
      adjustmentTransactionNumber: adjustmentNumber,
      adjustmentType,
      adjustmentApprovalStatus: approvalStatus,
      amount: original.amount,
      accountId: original.accountId,
    },
  });

  return adjustmentId;
}

/**
 * Load + guard a finalized, not-yet-reversed original transaction inside `tx`.
 * Throws Bahasa Indonesia validation errors for every rejected case so the whole
 * tx rolls back and nothing is inserted (Req 7.5, 7.8, 12.1).
 */
async function loadReversibleOriginal(
  tx: FinanceTransaction,
  transactionId: string,
): Promise<typeof transactions.$inferSelect> {
  const rows = await tx
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1)
    .all();

  if (rows.length === 0) {
    throw new Error("Transaksi tidak ditemukan");
  }

  const original = rows[0];

  // Guard: never reverse an adjustment row itself.
  if (original.reversalOfTransactionId) {
    throw new Error("Transaksi penyesuaian (pembalikan) tidak dapat dibalik lagi.");
  }

  // Guard: only FINALIZED originals may be reversed (Req 7.5, 12.1).
  if (!FINALIZED_APPROVAL_STATUSES.includes(original.approvalStatus as (typeof FINALIZED_APPROVAL_STATUSES)[number])) {
    throw new Error(NOT_FINALIZED_ERROR);
  }

  // Guard: reject double reversal (Req 7.8).
  if (await hasExistingReversal(tx, transactionId)) {
    throw new Error(ALREADY_REVERSED_ERROR);
  }

  return original;
}

/**
 * Reverse a finalized ledger transaction.
 *
 * Inserts the accounting inverse of the original as a new adjustment
 * transaction (linked via `reversalOfTransactionId`, carrying `reversalReason`)
 * so the balance is restored under the existing `computeCurrentBalance` formula
 * with NO engine change (Req 12.6). The original row is left completely
 * unchanged (Req 7.6). Records a `reversed` timeline event.
 *
 * @param transactionId - the finalized original transaction to reverse.
 * @param reason        - required, non-empty, ≤500 chars (Req 7.6, 12.4, 13.4).
 * @throws when the caller lacks the required role (no mutation, no redirect —
 *         Req 10.7), or when a guard rejects the reversal (missing / non-final /
 *         already-reversed / missing reversal category) — in all guard cases the
 *         tx rolls back and nothing is inserted.
 */
export async function reverseTransaction(
  transactionId: string,
  reason: string,
): Promise<ReversalResult> {
  const activeUser = await requireAuth();

  // Role gate (Req 10.1): only Admin Keuangan or Super Admin. Wrong role throws
  // WITHOUT mutating and WITHOUT redirect (Req 10.7).
  const { isKeuangan, isSuperAdmin } = await getSessionRole(activeUser.id);
  if (!isKeuangan && !isSuperAdmin) {
    throw new Error(NOT_AUTHORIZED_REVERSAL_ERROR);
  }

  if (!transactionId || transactionId.trim().length === 0) {
    throw new Error("ID transaksi tidak valid");
  }

  // Validate the reason: non-empty, ≤500 chars (Req 7.6, 12.4, 13.4).
  const parsedReason = rejectionReasonSchema.safeParse(reason);
  if (!parsedReason.success) {
    return {
      success: false,
      error: "Alasan pembalikan wajib diisi (maksimal 500 karakter).",
      fieldErrors: { reason: parsedReason.error.issues.map((i) => i.message) },
    };
  }

  let adjustmentTransactionId = "";
  let originalNumber = "";

  await db.transaction(async (tx) => {
    const original = await loadReversibleOriginal(tx, transactionId);
    originalNumber = original.transactionNumber;
    adjustmentTransactionId = await insertReversalAdjustment(
      tx,
      original,
      parsedReason.data,
      activeUser.id,
    );
  });

  // Audit log post-tx, consistent with the existing finance mutation pattern
  // (AGENTS.md §8.3).
  await writeAuditLog({
    action: "update",
    module: "finance",
    entityId: transactionId,
    entityType: "transaction",
    details: {
      operation: "reversed",
      adjustmentTransactionId,
      originalTransactionNumber: originalNumber,
      reason: parsedReason.data,
    },
  });

  revalidatePath("/finance/transactions");
  revalidatePath(`/finance/transactions/${transactionId}`);
  return { success: true, adjustmentTransactionId };
}

/**
 * ⚠️ TODO — DO NOT wire this action to the UI until finance approval behavior
 * is reviewed. The replacement expense currently mirrors the original's
 * `approvalStatus` (and sets `approvedBy` to the acting user when the original
 * was `approved`), which may BYPASS the normal expense approval queue. This is
 * intentionally NOT exposed anywhere in the UI yet; `reverseTransaction` is the
 * only correction path currently surfaced. Do not change this behavior unless
 * explicitly requested and reviewed by finance.
 *
 * Correct a finalized ledger transaction (reversal PLUS replacement).
 *
 * This is the additive "reversal + replacement" flow (design decision #2):
 *   1. Insert the inverse adjustment for the original (nets the original out
 *      under `computeCurrentBalance`) — same as {@link reverseTransaction}.
 *   2. Insert a NEW replacement transaction carrying the corrected values. The
 *      replacement keeps the SAME type + approvalStatus as the original so it
 *      counts in the balance exactly like the original did, i.e. after the
 *      correction the account balance reflects the corrected amount:
 *        original(±A) + reversal(∓A) + replacement(±A') = ±A'.
 *   3. Record a `corrected` timeline event referencing the original.
 *
 * The ORIGINAL row is never mutated (Req 7.6). The correction never runs the
 * budget-decrement path and never touches `computeCurrentBalance`.
 *
 * @param transactionId - the finalized original transaction to correct.
 * @param data          - corrected values (validated by transactionCorrectionSchema),
 *                        including the required `reason`.
 * @throws when the caller lacks the required role (no mutation, no redirect), or
 *         when a guard rejects the correction; on validation failure returns a
 *         structured field-error result and performs no mutation.
 */
export async function correctTransaction(
  transactionId: string,
  data: unknown,
): Promise<ReversalResult> {
  const activeUser = await requireAuth();

  // Role gate (Req 10.1): wrong role throws WITHOUT mutating (Req 10.7).
  const { isKeuangan, isSuperAdmin } = await getSessionRole(activeUser.id);
  if (!isKeuangan && !isSuperAdmin) {
    throw new Error(NOT_AUTHORIZED_REVERSAL_ERROR);
  }

  if (!transactionId || transactionId.trim().length === 0) {
    throw new Error("ID transaksi tidak valid");
  }

  // Validate corrected fields FIRST (incl. required reason). On failure return
  // structured field errors and perform no mutation (Req 4.15 parity, 12.4).
  const parsed = transactionCorrectionSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of (parsed.error as ZodError).issues) {
      const path = issue.path.join(".") || "_form";
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
    return { success: false, error: "Validasi input gagal", fieldErrors };
  }

  const correction = parsed.data;

  let adjustmentTransactionId = "";
  let replacementTransactionId = "";
  let originalNumber = "";

  await db.transaction(async (tx) => {
    const original = await loadReversibleOriginal(tx, transactionId);
    originalNumber = original.transactionNumber;

    // 1. Reverse the original (inverse adjustment + `reversed` event).
    adjustmentTransactionId = await insertReversalAdjustment(
      tx,
      original,
      correction.reason,
      activeUser.id,
    );

    // 2. Insert the corrected REPLACEMENT transaction. It mirrors the original's
    //    type + approvalStatus so it counts in the balance exactly like the
    //    original did (the corrected amount replaces the reversed original).
    replacementTransactionId = crypto.randomUUID();
    const replacementNumber = generateTransactionNumber(
      original.type === "income" ? "TRX-COR-IN" : "TRX-COR-OUT",
    );

    await tx
      .insert(transactions)
      .values({
        id: replacementTransactionId,
        transactionNumber: replacementNumber,
        projectId: original.projectId, // inherited — a correction never moves project
        unitId: original.unitId,
        customerId: original.customerId,
        accountId: correction.accountId,
        categoryId: correction.categoryId,
        type: original.type,
        description: correction.description,
        amount: correction.amount,
        transactionDate: correction.transactionDate,
        paymentMethod: correction.paymentMethod,
        approvalStatus: original.approvalStatus,
        approvedBy: original.approvalStatus === "approved" ? activeUser.id : null,
        approvalNotes:
          original.approvalStatus === "approved"
            ? `Koreksi dari ${original.transactionNumber}: ${correction.reason}`
            : null,
        createdBy: activeUser.id,
      })
      .run();

    // 3. Record `corrected` against the ORIGINAL entity, linking the replacement.
    await recordFinanceActivity(tx, {
      entityType: "transaction",
      entityId: original.id,
      action: "corrected",
      actorId: activeUser.id,
      fromStatus: original.approvalStatus,
      toStatus: original.approvalStatus, // original untouched
      reason: correction.reason,
      snapshotBefore: {
        transactionNumber: original.transactionNumber,
        type: original.type,
        amount: original.amount,
        accountId: original.accountId,
        categoryId: original.categoryId,
        description: original.description,
        paymentMethod: original.paymentMethod,
      },
      snapshotAfter: {
        replacementTransactionId,
        replacementTransactionNumber: replacementNumber,
        adjustmentTransactionId,
        type: original.type,
        amount: correction.amount,
        accountId: correction.accountId,
        categoryId: correction.categoryId,
        description: correction.description,
        paymentMethod: correction.paymentMethod,
      },
    });
  });

  // Audit log post-tx (AGENTS.md §8.3).
  await writeAuditLog({
    action: "update",
    module: "finance",
    entityId: transactionId,
    entityType: "transaction",
    details: {
      operation: "corrected",
      adjustmentTransactionId,
      replacementTransactionId,
      originalTransactionNumber: originalNumber,
      amount: correction.amount,
      reason: correction.reason,
    },
  });

  revalidatePath("/finance/transactions");
  revalidatePath(`/finance/transactions/${transactionId}`);
  return { success: true, adjustmentTransactionId, replacementTransactionId };
}
