"use server";

import { db } from "@/db";
import {
  invoices,
  payments,
  transactions,
  transactionApprovals,
  budgets,
  budgetLines,
  financeActivityHistory,
} from "@/db/schema/finance";
import {
  financeAccounts,
  financeCategories,
  units,
  customers,
  projects,
  unitStatusHistories,
} from "@/db/schema/master";
import { user as userTable } from "@/db/schema/auth";
import { materialRequests } from "@/db/schema/production";
import { bookings, kprProcesses } from "@/db/schema/marketing";
import { checkAndTransitionToConstruction } from "./marketing";
import { getCashPemberkasanReadiness } from "@/server/services/booking-construction-readiness";
import { attachments, notifications } from "@/db/schema/system";
import { getCurrentUser, requireAuth, requireAnyRole, hasRole, getSessionRole } from "@/server/permissions";
import { eq, and, desc, asc, sum, sql, inArray, lte, isNotNull, gte, count, ilike, or, lt, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cachedQuery } from "@/lib/cache";
import { computeInvoicePaymentSummary } from "@/lib/finance-invoice-summary";
import { calculateOffset, validatePaginationParams, type PaginatedResult } from "@/lib/pagination";
import { writeAuditLog } from "@/server/services/audit.service";
import { createNotification, notifyUsersWithRoles } from "@/server/services/notification.service";
import {
  recordFinanceActivity,
  recordFinanceActivitySafe,
} from "@/server/services/finance-activity.service";
import { runPaymentReminderScan } from "@/server/services/reminder.service";
import { applyRateLimit } from "@/server/middleware/apply-rate-limit";
import { round2, computeOutstanding, computeInvoiceStatus, computeInvoiceSchedule, generateInvoiceSchedule } from "@/server/services/booking.service";
import {
  invoiceSchema,
  paymentSchema,
  expenseRequestSchema,
  budgetSchema,
  reversalReasonSchema,
} from "../validators/finance";

// ==========================================
// FINANCE PAGINATION TYPES & HELPERS
// ==========================================

/**
 * Pagination parameters for finance service functions.
 * Default page size: 50.
 */
export type FinancePaginationParams = {
  page: number;
  pageSize?: number;
};

/**
 * Paginated response shape for finance queries.
 * Wraps data with nested pagination metadata.
 */
export interface FinancePaginatedResponse<T> {
  data: T[];
  pagination: {
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/** Default page size for finance paginated queries */
const FINANCE_DEFAULT_PAGE_SIZE = 50;

/**
 * Convert a flat PaginatedResult into the nested FinancePaginatedResponse shape.
 */
function toFinancePaginatedResponse<T>(result: PaginatedResult<T>): FinancePaginatedResponse<T> {
  return {
    data: result.data,
    pagination: {
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    },
  };
}

// ==========================================
// FINANCE ACTIVITY HISTORY (AUDIT TIMELINE) RECORDING
// ==========================================

/**
 * SECURITY BOUNDARY (P0): finance-activity WRITERS intentionally no longer live here.
 *
 * This file carries "use server", so every exported function is a browser-callable
 * RPC endpoint. `recordFinanceActivitySafe(input)` accepted a plain serialisable
 * object with no guard, letting any client append forged rows (e.g. a fake
 * "approved"/"verified" entry) to the finance activity timeline that finance
 * relies on to reconstruct who changed what.
 *
 * They now live in `server/services/finance-activity.service.ts` (no "use server").
 * Types are re-exported below so existing consumers keep compiling.
 */
export type {
  FinanceTransaction,
  FinanceActivityEntityType,
  FinanceActivityAction,
  RecordFinanceActivityInput,
} from "@/server/services/finance-activity.service";

// ==========================================
// UTILITY: Compute Real Account Balance
// ==========================================
/**
 * Computes the real current balance of a finance account.
 * openingBalance = immutable seed balance (never mutated after creation).
 * currentBalance = openingBalance + sum(verified income) - sum(approved expenses)
 */
export async function computeCurrentBalance(accountId: string): Promise<number> {
  const [account] = await db
    .select({ openingBalance: financeAccounts.openingBalance })
    .from(financeAccounts)
    .where(eq(financeAccounts.id, accountId))
    .limit(1);

  if (!account) throw new Error("Akun kas/bank tidak ditemukan");

  const [incResult] = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(and(
      eq(transactions.accountId, accountId),
      eq(transactions.type, "income"),
      // BUG 5 AUDIT: All income inserts use approvalStatus = "not_required" by design.
      // Payment verifications (verifyPayment) and KPR realizations (realizeKpr) both set
      // approvalStatus = "not_required" for income transactions. This filter is intentional
      // and consistent with all income insert paths in finance.ts and marketing.ts.
      eq(transactions.approvalStatus, "not_required")
    ));

  const [expResult] = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(and(
      eq(transactions.accountId, accountId),
      eq(transactions.type, "expense"),
      eq(transactions.approvalStatus, "approved")
    ));

  // Req 7.1: netting formula with 2-decimal precision (half-up) to avoid binary
  // FP drift from doublePrecision columns; reversal income (negative amount,
  // type="income", approvalStatus="not_required") is netted in automatically.
  return round2(account.openingBalance + Number(incResult?.total ?? 0) - Number(expResult?.total ?? 0));
}

// ==========================================
// 1. INVOICES SERVICE LAYER
// ==========================================

/** Row shape returned by getInvoices queries */
export type InvoiceRow = {
  invoice: typeof invoices.$inferSelect;
  project: typeof projects.$inferSelect;
  unit: typeof units.$inferSelect | null;
  customer: typeof customers.$inferSelect | null;
  booking: typeof bookings.$inferSelect | null;
};

// Overload signatures
export async function getInvoices(projectId?: string): Promise<InvoiceRow[]>;
export async function getInvoices(
  projectId: string | undefined,
  pagination: FinancePaginationParams
): Promise<FinancePaginatedResponse<InvoiceRow>>;

// Implementation
export async function getInvoices(
  projectId?: string,
  pagination?: FinancePaginationParams
): Promise<InvoiceRow[] | FinancePaginatedResponse<InvoiceRow>> {
  await requireAuth();

  // Legacy path: no pagination — return flat array (backward compatible)
  if (!pagination) {
    const query = db
      .select({
        invoice: invoices,
        project: projects,
        unit: units,
        customer: customers,
        booking: bookings,
      })
      .from(invoices)
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .leftJoin(units, eq(invoices.unitId, units.id))
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(bookings, eq(invoices.bookingId, bookings.id))
      .orderBy(desc(invoices.createdAt));

    if (projectId) {
      return query.where(eq(invoices.projectId, projectId));
    }

    return query;
  }

  // Paginated path: return { data, pagination } shape
  const pageSize = pagination.pageSize ?? FINANCE_DEFAULT_PAGE_SIZE;

  // Build WHERE condition
  const whereCondition = projectId
    ? eq(invoices.projectId, projectId)
    : undefined;

  // Count total records
  const countQuery = db
    .select({ totalCount: count() })
    .from(invoices)
    .innerJoin(projects, eq(invoices.projectId, projects.id));

  const [countResult] = whereCondition
    ? await countQuery.where(whereCondition)
    : await countQuery;

  const totalCount = countResult?.totalCount ?? 0;

  // Validate and normalize pagination params
  const validatedParams = validatePaginationParams(
    { page: pagination.page, pageSize },
    totalCount
  );

  const { limit, offset } = calculateOffset(validatedParams);
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / validatedParams.pageSize);

  // Fetch paginated data
  const dataQuery = db
    .select({
      invoice: invoices,
      project: projects,
      unit: units,
      customer: customers,
      booking: bookings,
    })
    .from(invoices)
    .innerJoin(projects, eq(invoices.projectId, projects.id))
    .leftJoin(units, eq(invoices.unitId, units.id))
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(bookings, eq(invoices.bookingId, bookings.id))
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset);

  const data: InvoiceRow[] = whereCondition
    ? await dataQuery.where(whereCondition)
    : await dataQuery;

  return toFinancePaginatedResponse({
    data,
    totalCount,
    page: validatedParams.page,
    pageSize: validatedParams.pageSize,
    totalPages,
  });
}

export async function getInvoice(invoiceId: string) {
  await requireAuth();

  const results = await db
    .select({
      invoice: invoices,
      project: projects,
      unit: units,
      customer: customers,
      booking: bookings,
    })
    .from(invoices)
    .innerJoin(projects, eq(invoices.projectId, projects.id))
    .leftJoin(units, eq(invoices.unitId, units.id))
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(bookings, eq(invoices.bookingId, bookings.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (results.length === 0) return null;

  const invoicePayments = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(desc(payments.createdAt));

  return {
    ...results[0],
    payments: invoicePayments,
  };
}

export async function createInvoice(data: unknown) {
  const activeUser = await requireAnyRole(["Super Admin", "Admin Keuangan", "Admin Kantor", "Direksi / Manager"]);
  applyRateLimit(activeUser.id);
  const parsed = invoiceSchema.parse(data);

  const invoiceId = crypto.randomUUID();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const invoiceNumber = `INV-${dateStr}-${rand}`;

  await db.transaction(async (tx) => {
    await tx.insert(invoices).values({
      id: invoiceId,
      invoiceNumber,
      projectId: parsed.projectId,
      unitId: parsed.unitId || null,
      customerId: parsed.customerId || null,
      bookingId: parsed.bookingId || null,
      type: parsed.type,
      amount: parsed.amount,
      dueDate: parsed.dueDate || null,
      status: "unpaid",
      notes: parsed.notes || null,
    }).run();

    // Finance activity timeline: record invoice creation (Req 3.3, 3.4, 3.9).
    // Recorded in the same tx as the insert so a history failure rolls back the create.
    await recordFinanceActivity(tx, {
      entityType: "invoice",
      entityId: invoiceId,
      action: "created",
      actorId: activeUser.id,
      fromStatus: null,
      toStatus: "unpaid",
    });
  });

  try {
    await writeAuditLog({
      action: "create",
      module: "finance",
      entityId: invoiceId,
      entityType: "invoice",
      details: { invoiceNumber, amount: parsed.amount, type: parsed.type },
    });
  } catch (err) {
    console.warn("[createInvoice] Audit log gagal ditulis:", err);
  }

  revalidatePath("/finance/payments");
  return { success: true, invoiceId };
}

// ==========================================
// 2. PAYMENTS SERVICE LAYER
// ==========================================

/** Row shape returned by getPayments queries */
export type PaymentRow = {
  payment: typeof payments.$inferSelect;
  invoice: typeof invoices.$inferSelect | null;
  project: typeof projects.$inferSelect;
  unit: typeof units.$inferSelect | null;
  customer: typeof customers.$inferSelect | null;
};

// Overload signatures
export async function getPayments(projectId?: string): Promise<PaymentRow[]>;
export async function getPayments(
  projectId: string | undefined,
  pagination: FinancePaginationParams
): Promise<FinancePaginatedResponse<PaymentRow>>;

// Implementation
export async function getPayments(
  projectId?: string,
  pagination?: FinancePaginationParams
): Promise<PaymentRow[] | FinancePaginatedResponse<PaymentRow>> {
  await requireAuth();

  // Legacy path: no pagination — return flat array (backward compatible)
  if (!pagination) {
    const query = db
      .select({
        payment: payments,
        invoice: invoices,
        project: projects,
        unit: units,
        customer: customers,
      })
      .from(payments)
      .innerJoin(projects, eq(payments.projectId, projects.id))
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .leftJoin(units, eq(payments.unitId, units.id))
      .leftJoin(customers, eq(payments.customerId, customers.id))
      .orderBy(desc(payments.createdAt));

    if (projectId) {
      return query.where(eq(payments.projectId, projectId));
    }

    return query;
  }

  // Paginated path: return { data, pagination } shape
  const pageSize = pagination.pageSize ?? FINANCE_DEFAULT_PAGE_SIZE;

  // Build WHERE condition
  const whereCondition = projectId
    ? eq(payments.projectId, projectId)
    : undefined;

  // Count total records
  const countQuery = db
    .select({ totalCount: count() })
    .from(payments)
    .innerJoin(projects, eq(payments.projectId, projects.id));

  const [countResult] = whereCondition
    ? await countQuery.where(whereCondition)
    : await countQuery;

  const totalCount = countResult?.totalCount ?? 0;

  // Validate and normalize pagination params
  const validatedParams = validatePaginationParams(
    { page: pagination.page, pageSize },
    totalCount
  );

  const { limit, offset } = calculateOffset(validatedParams);
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / validatedParams.pageSize);

  // Fetch paginated data
  const dataQuery = db
    .select({
      payment: payments,
      invoice: invoices,
      project: projects,
      unit: units,
      customer: customers,
    })
    .from(payments)
    .innerJoin(projects, eq(payments.projectId, projects.id))
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .leftJoin(units, eq(payments.unitId, units.id))
    .leftJoin(customers, eq(payments.customerId, customers.id))
    .orderBy(desc(payments.createdAt))
    .limit(limit)
    .offset(offset);

  const data: PaymentRow[] = whereCondition
    ? await dataQuery.where(whereCondition)
    : await dataQuery;

  return toFinancePaginatedResponse({
    data,
    totalCount,
    page: validatedParams.page,
    pageSize: validatedParams.pageSize,
    totalPages,
  });
}

/**
 * Records a customer payment / manual deposit.
 *
 * RBAC hardening (P0): previously `requireAuth()` only. The finance module is
 * readable by 7 roles (FINANCE_MODULE_ROLES) including Marketing, Marketing
 * Manager and Pengawas Lapangan, so plain `requireAuth()` let all of them write
 * cash-ledger rows. Restricted to finance-operational roles.
 *
 * The marketing-side proof flow is unaffected: it goes through
 * `uploadPaymentProof` / `attachExistingPaymentProof` in marketing.ts, which
 * carry their own booking-scoped guards and do not call this action.
 */
export async function createPayment(data: unknown) {
  const activeUser = await requireAnyRole([
    "Super Admin",
    "Admin Keuangan",
    "Admin Kantor",
  ]);
  applyRateLimit(activeUser.id);
  const parsed = paymentSchema.parse(data);

  const paymentId = crypto.randomUUID();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const paymentNumber = `PAY-${dateStr}-${rand}`;

  // ── Req 2.11: Outstanding guard — validate payment amount does not exceed invoice outstanding ──
  if (parsed.invoiceId) {
    const [targetInvoice] = await db
      .select({ id: invoices.id, amount: invoices.amount, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, parsed.invoiceId))
      .limit(1);

    if (!targetInvoice) {
      throw new Error("Invoice target tidak ditemukan.");
    }
    if (targetInvoice.status !== "unpaid" && targetInvoice.status !== "partial") {
      throw new Error("Invoice target sudah lunas atau dibatalkan.");
    }

    // Sum verified payments for this invoice to compute outstanding
    const [sumResult] = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(
        and(
          eq(payments.invoiceId, parsed.invoiceId),
          eq(payments.status, "verified")
        )
      );

    const paidTotal = Number(sumResult?.total ?? 0);
    const outstanding = computeOutstanding(targetInvoice.amount, paidTotal);

    if (parsed.amount > outstanding) {
      throw new Error(
        `Nominal pembayaran melebihi sisa tagihan. Outstanding: Rp ${outstanding.toLocaleString('id-ID')}`
      );
    }
  }

  await db.insert(payments).values({
    id: paymentId,
    invoiceId: parsed.invoiceId || null,
    paymentNumber,
    projectId: parsed.projectId,
    unitId: parsed.unitId || null,
    customerId: parsed.customerId || null,
    amount: parsed.amount,
    paymentDate: parsed.paymentDate,
    paymentMethod: parsed.paymentMethod,
    proofAttachmentId: parsed.proofAttachmentId || null,
    uploadedBy: activeUser.id,
    status: "pending",
  });

  try {
    await writeAuditLog({
      action: "create",
      module: "finance",
      entityId: paymentId,
      entityType: "payment",
      details: { paymentNumber, amount: parsed.amount },
    });
  } catch (err) {
    console.warn("[createPayment] Audit log gagal ditulis:", err);
  }

  // Notify Admin Keuangan and Super Admin about new payment verification
  try {
    await notifyUsersWithRoles({
      roleNames: ["Admin Keuangan", "Super Admin"],
      type: "approval_pending",
      title: "Verifikasi Pembayaran Baru",
      message: `Pembayaran baru senilai Rp ${parsed.amount.toLocaleString()} dari konsumen memerlukan verifikasi keuangan.`,
      entityId: paymentId,
      entityType: "payment",
    });
  } catch (err) {
    console.warn("[createPayment] Notifikasi gagal dikirim:", err);
  }

  revalidatePath("/finance/payments");
  revalidatePath("/dashboard");
  return { success: true, paymentId };
}

export async function verifyPayment(
  paymentId: string,
  isApproved: boolean,
  accountId: string,
  notes?: string
) {
  const activeUser = await requireAuth();

  // ── Task 6.5: Role guard — only Admin Keuangan, Direksi/Manager, or Super Admin (Req 3.10, 11.4–11.6) ──
  const { isKeuangan: isFinance, isDireksi: isDirector, isSuperAdmin: isSuper } = await getSessionRole(activeUser.id);

  if (!isFinance && !isDirector && !isSuper) {
    throw new Error("Anda tidak memiliki akses untuk verifikasi pembayaran.");
  }

  // ── Task 6.1 Req 3.9: Account validation — accountId must exist and be active ──
  if (isApproved) {
    const [targetAccount] = await db
      .select({ id: financeAccounts.id, status: financeAccounts.status })
      .from(financeAccounts)
      .where(eq(financeAccounts.id, accountId))
      .limit(1);

    if (!targetAccount || targetAccount.status !== "active") {
      throw new Error("Akun keuangan tidak valid.");
    }
  }

  // ── Task 6.2: Self-verify guard (Req 11.7) — pre-fetch payment for uploadedBy check ──
  const [prefetchPayment] = await db
    .select({
      id: payments.id,
      uploadedBy: payments.uploadedBy,
      proofAttachmentId: payments.proofAttachmentId,
    })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!prefetchPayment) {
    throw new Error("Pembayaran tidak ditemukan");
  }

  // Primary: if payment.uploadedBy is non-null, compare directly
  if (!isSuper && prefetchPayment.uploadedBy && prefetchPayment.uploadedBy === activeUser.id) {
    throw new Error("Anda tidak dapat memverifikasi bukti bayar yang Anda upload sendiri.");
  }

  // Fallback legacy: ONLY if uploadedBy is null, check attachments.uploadedBy
  if (!isSuper && !prefetchPayment.uploadedBy && prefetchPayment.proofAttachmentId) {
    const [proofAttachment] = await db
      .select({ uploadedBy: attachments.uploadedBy })
      .from(attachments)
      .where(eq(attachments.id, prefetchPayment.proofAttachmentId))
      .limit(1);

    if (proofAttachment?.uploadedBy && proofAttachment.uploadedBy === activeUser.id) {
      throw new Error("Anda tidak dapat memverifikasi bukti bayar yang Anda upload sendiri.");
    }
  }

  // ── Proof guard: an approval must be backed by an uploaded proof attachment.
  // Rejections do not require a proof. Legacy payments without proof cannot be
  // approved and must be re-uploaded first. ──
  if (isApproved && !prefetchPayment.proofAttachmentId) {
    throw new Error("Bukti pembayaran wajib dilampirkan sebelum verifikasi.");
  }

  let paymentNumber = "";
  let paymentAmount = 0;
  let shouldTransition = false;
  let bookingIdToTransition = "";
  // Sprint 2: Cash/Installment handover trigger
  let shouldTriggerHandoverWait = false;
  let handoverWaitUnitId = "";
  let handoverWaitBookingId = "";

  await db.transaction(async (tx) => {
    // 1. Get Payment details
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
    paymentNumber = payment.paymentNumber;
    paymentAmount = payment.amount;

    // ── Task 6.1 Req 3.3: State guard — reject if not pending (covers verified, rejected, voided) ──
    if (payment.status !== "pending") {
      throw new Error("Pembayaran ini sudah diproses sebelumnya.");
    }

    // ── Task 6.1 Req 2.7: Row-level lock on invoice (if linked) ──
    if (payment.invoiceId) {
      await tx.execute(sql`SELECT id FROM invoices WHERE id = ${payment.invoiceId} FOR UPDATE`);
    }

    // ── Task 6.1 Req 2.2: Overpayment guard (skip if invoiceId is null per Req 2.8) ──
    if (isApproved && payment.invoiceId) {
      const [targetInvoice] = await tx
        .select({
          id: invoices.id,
          amount: invoices.amount,
          bookingId: invoices.bookingId,
          type: invoices.type,
          scheduleKind: invoices.scheduleKind,
        })
        .from(invoices)
        .where(eq(invoices.id, payment.invoiceId))
        .limit(1)
        .all();

      if (targetInvoice) {
        if (targetInvoice.bookingId) {
          const booking = await tx
            .select({ paymentScheme: bookings.paymentScheme })
            .from(bookings)
            .where(eq(bookings.id, targetInvoice.bookingId))
            .get();

          // Cash settlement AND Cash Bertahap (installment) termin payments both
          // require the pemberkasan gate (BF + DP + KTP/KK verified) to pass
          // before the follow-up invoice may be verified.
          const isSettlementOrTermin =
            (booking?.paymentScheme === "cash" || booking?.paymentScheme === "installment") &&
            (targetInvoice.scheduleKind === "cash_settlement" ||
              targetInvoice.scheduleKind === "installment" ||
              targetInvoice.type === "installment");

          if (isSettlementOrTermin) {
            const pemberkasanReadiness = await getCashPemberkasanReadiness(tx, targetInvoice.bookingId);
            if (!pemberkasanReadiness.eligible) {
              const label = booking?.paymentScheme === "installment" ? "Termin Cash Bertahap" : "Pelunasan Cash";
              throw new Error(
                `${label} belum dapat diverifikasi. ${pemberkasanReadiness.reason}`
              );
            }
          }
        }

        const sumPayments = await tx
          .select({ total: sum(payments.amount) })
          .from(payments)
          .where(
            and(
              eq(payments.invoiceId, payment.invoiceId),
              eq(payments.status, "verified")
            )
          )
          .all();

        const paidTotal = Number(sumPayments[0]?.total || 0);

        if (paidTotal + payment.amount > targetInvoice.amount) {
          const outstanding = computeOutstanding(targetInvoice.amount, paidTotal);
          throw new Error(
            `Nominal pembayaran melebihi sisa tagihan. Outstanding: Rp ${outstanding.toLocaleString("id-ID")}`
          );
        }
      }
    }

    const newStatus = isApproved ? "verified" : "rejected";

    // 2. Update payment status with verifiedBy, verifiedAt (Req 3.7)
    await tx
      .update(payments)
      .set({
        status: newStatus,
        verifiedBy: activeUser.id,
        verifiedAt: new Date(),
      })
      .where(eq(payments.id, paymentId))
      .run();

    // Finance activity timeline: record the payment verification/rejection (Req 3.3,
    // 3.9, 5.4, 6.7). Recorded in the SAME tx as the status change so a history-insert
    // failure rolls back the whole verify/reject. `verified` on approve, `rejected`
    // (with the rejection notes as reason) on reject. Immutability itself is already
    // enforced by the `payment.status !== "pending"` guard above (Req 4.12, 6.7, 12.2).
    await recordFinanceActivity(tx, {
      entityType: "payment",
      entityId: paymentId,
      action: isApproved ? "verified" : "rejected",
      actorId: activeUser.id,
      fromStatus: "pending",
      toStatus: newStatus,
      reason: isApproved ? null : (notes ?? null),
    });

    if (isApproved) {
      // 3. Find target Account & check existence (already validated above, re-fetch in tx)
      const accountResults = await tx
        .select()
        .from(financeAccounts)
        .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.status, "active")))
        .limit(1)
        .all();

      if (accountResults.length === 0) {
        throw new Error("Akun keuangan tidak valid.");
      }

      // 4. Find/Select target Finance Category for income
      const categoryResults = await tx
        .select()
        .from(financeCategories)
        .where(
          and(
            eq(financeCategories.type, "income"),
            sql`lower(${financeCategories.name}) LIKE '%pemasukan%' OR lower(${financeCategories.name}) LIKE '%booking%' OR lower(${financeCategories.name}) LIKE '%kpr%' OR lower(${financeCategories.name}) LIKE '%dp%'`
          )
        )
        .limit(1)
        .all();

      let categoryId = "";
      if (categoryResults.length > 0) {
        categoryId = categoryResults[0].id;
      } else {
        const fallbackResults = await tx
          .select()
          .from(financeCategories)
          .where(eq(financeCategories.type, "income"))
          .limit(1)
          .all();
        if (fallbackResults.length === 0) {
          throw new Error(
            "Kategori keuangan pemasukan belum dikonfigurasi. Harap buat kategori pemasukan di menu Master dahulu."
          );
        }
        categoryId = fallbackResults[0].id;
      }

      // ── Task 6.1 Req 3.6: Idempotency guard — skip if income already exists for this paymentId ──
      const existingIncome = await tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.paymentId, payment.id),
            eq(transactions.type, "income")
          )
        )
        .limit(1);

      if (existingIncome.length > 0) {
        // Idempotency: income already created, return success without side-effect
        return;
      }

      // 5. Generate Ledger Transaction record
      const trxId = crypto.randomUUID();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
      const transactionNumber = `TRX-IN-${dateStr}-${rand}`;

      await tx.insert(transactions).values({
        id: trxId,
        transactionNumber,
        projectId: payment.projectId,
        unitId: payment.unitId,
        customerId: payment.customerId,
        paymentId: payment.id,
        accountId: accountId,
        categoryId: categoryId,
        type: "income",
        description: `Pemasukan terverifikasi dari ${payment.paymentNumber} (${payment.paymentMethod})`,
        amount: payment.amount,
        transactionDate: new Date(),
        paymentMethod: payment.paymentMethod,
        approvalStatus: "not_required",
        attachmentId: payment.proofAttachmentId,
        createdBy: activeUser.id,
      }).run();

      // 6. Balance updated implicitly via the verified income transaction record.
      // currentBalance = openingBalance + sum(verified income) - sum(approved expenses)
      // No mutation of financeAccounts.openingBalance needed.

      // ── Task 6.1 Req 2.3–2.6: Recompute invoice status atomically via computeInvoiceStatus ──
      if (payment.invoiceId) {
        const invoiceResults = await tx
          .select()
          .from(invoices)
          .where(eq(invoices.id, payment.invoiceId))
          .limit(1)
          .all();

        if (invoiceResults.length > 0) {
          const invoice = invoiceResults[0];

          // Fetch sum of all verified payments for this invoice (includes the just-verified one)
          const sumPayments = await tx
            .select({ total: sum(payments.amount) })
            .from(payments)
            .where(
              and(
                eq(payments.invoiceId, payment.invoiceId),
                eq(payments.status, "verified")
              )
            )
            .all();

          const paidTotal = Number(sumPayments[0]?.total || 0);
          const newInvoiceStatus = computeInvoiceStatus(paidTotal, invoice.amount);

          await tx
            .update(invoices)
            .set({
              status: newInvoiceStatus,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, payment.invoiceId))
            .run();

          // Finance activity timeline: record the invoice payment-status change ONLY
          // when the recompute actually changes the invoice status (Req 3.3, 3.9, 5.4).
          // `paid_full` when it becomes "paid", `paid_partial` when it becomes "partial".
          // Recorded in the SAME tx as the invoice update so a history failure rolls back.
          if (
            newInvoiceStatus !== invoice.status &&
            (newInvoiceStatus === "paid" || newInvoiceStatus === "partial")
          ) {
            await recordFinanceActivity(tx, {
              entityType: "invoice",
              entityId: payment.invoiceId,
              action: newInvoiceStatus === "paid" ? "paid_full" : "paid_partial",
              actorId: activeUser.id,
              fromStatus: invoice.status,
              toStatus: newInvoiceStatus,
            });
          }

          if (newInvoiceStatus === "paid" && invoice.bookingId) {
            shouldTransition = true;
            bookingIdToTransition = invoice.bookingId;

            // ── Sprint 2: Cash/Installment lunas → menunggu_serah_terima ──
            // Check 5 conditions from Decision Record (2026-05-30)
            const bookingData = await tx
              .select({
                paymentScheme: bookings.paymentScheme,
                status: bookings.status,
                unitId: bookings.unitId,
              })
              .from(bookings)
              .where(eq(bookings.id, invoice.bookingId))
              .get();

            // Condition 1: paymentScheme ≠ kpr (KPR has its own path via realisasi)
            // Condition 2: PPJB/Akad harus sudah benar-benar selesai.
            if (
              bookingData &&
              bookingData.paymentScheme !== "kpr" &&
              bookingData.status === "completed" &&
              bookingData.unitId
            ) {
              // Condition 3: all invoices for this booking must be paid
              const unpaidInvoices = await tx
                .select({ id: invoices.id })
                .from(invoices)
                .where(
                  and(
                    eq(invoices.bookingId, invoice.bookingId),
                    inArray(invoices.status, ["unpaid", "partial"])
                  )
                )
                .all();

              if (unpaidInvoices.length === 0) {
                // Condition 4 & 5: unit not already in terminal handover status
                const unitData = await tx
                  .select({ status: units.status })
                  .from(units)
                  .where(eq(units.id, bookingData.unitId))
                  .get();

                if (
                  unitData &&
                  unitData.status !== "menunggu_serah_terima" &&
                  unitData.status !== "handover_complete"
                ) {
                  shouldTriggerHandoverWait = true;
                  handoverWaitUnitId = bookingData.unitId;
                  handoverWaitBookingId = invoice.bookingId;
                }
              }
            } else if (
              bookingData &&
              bookingData.paymentScheme !== "kpr" &&
              bookingData.status === "active"
            ) {
              // Anomaly: all invoices paid but booking still active — log and skip
              console.warn(
                `[verifyPayment] Anomali data: booking ${invoice.bookingId} (${bookingData.paymentScheme}) ` +
                `memiliki semua invoice lunas tetapi status masih 'active'. ` +
                `Auto-transition ke menunggu_serah_terima dibatalkan. Perlu investigasi.`
              );
            }
          }
        }
      }
    }
  });

  // Run transition outside transaction to avoid returning a promise from SQLite transaction
  if (shouldTransition && bookingIdToTransition) {
    await checkAndTransitionToConstruction(db, bookingIdToTransition, activeUser.id);
  }

  // Sprint 2: Cash/Installment lunas → menunggu_serah_terima
  if (shouldTriggerHandoverWait && handoverWaitUnitId && handoverWaitBookingId) {
    await triggerMenungguSerahTerima(handoverWaitUnitId, handoverWaitBookingId, activeUser.id);
  }

  // 8. Log activities outside transaction
  const newStatus = isApproved ? "verified" : "rejected";
  try {
    await writeAuditLog({
      action: isApproved ? "approve" : "reject",
      module: "finance",
      entityId: paymentId,
      entityType: "payment",
      details: {
        paymentNumber: paymentNumber,
        status: newStatus,
        notes: notes || null,
      },
    });
  } catch (err) {
    console.warn("[verifyPayment] Audit log gagal ditulis:", err);
  }

  // Find related booking and marketing PIC to send a targeted notification
  // BUG 2 FIX: Use single JOIN query instead of 3 chained N+1 queries post-transaction
  let marketingPicId: string | null = null;
  let unitCodeStr = "";
  let bookingNumStr = "";

  try {
    const notifData = await db
      .select({
        marketingId: bookings.marketingId,
        bookingNumber: bookings.bookingNumber,
        unitCode: units.code,
      })
      .from(payments)
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .leftJoin(bookings, eq(invoices.bookingId, bookings.id))
      .leftJoin(units, eq(invoices.unitId, units.id))
      .where(eq(payments.id, paymentId))
      .limit(1)
      .then((res) => res[0]);

    if (notifData) {
      marketingPicId = notifData.marketingId ?? null;
      bookingNumStr = notifData.bookingNumber ?? "";
      unitCodeStr = notifData.unitCode ?? "";
    }
  } catch (err) {
    console.error("[verifyPayment] Gagal mengambil data booking untuk notifikasi:", err);
  }

  // 1. Send targeted notification to the Marketing PIC who made the booking
  if (marketingPicId) {
    try {
      await createNotification({
        userId: marketingPicId,
        type: "info",
        title: isApproved ? "Pembayaran Booking Disetujui" : "Pembayaran Booking Ditolak",
        message: `Pembayaran ${paymentNumber} senilai Rp ${paymentAmount.toLocaleString("id-ID")} untuk Unit ${unitCodeStr || "kavling"} (Booking: ${bookingNumStr || "—"}) telah ${isApproved ? "disetujui" : "ditolak"} oleh Admin Keuangan.`,
        entityId: paymentId,
        entityType: "payment",
      });
    } catch (err) {
      console.warn("[verifyPayment] Notifikasi ke Marketing PIC gagal:", err);
    }
  }

  // 2. Broadcast notification to Super Admin and Marketing Manager
  try {
    await notifyUsersWithRoles({
      roleNames: ["Super Admin", "Marketing Manager"],
      type: "info",
      title: isApproved ? "Pembayaran Diverifikasi" : "Pembayaran Ditolak",
      message: `Pembayaran ${paymentNumber} senilai Rp ${paymentAmount.toLocaleString("id-ID")} telah ${isApproved ? "diverifikasi sukses" : "ditolak"}.`,
      entityId: paymentId,
      entityType: "payment",
    });
  } catch (err) {
    console.warn("[verifyPayment] Notifikasi broadcast gagal:", err);
  }

  revalidatePath("/finance/payments");
  revalidatePath("/finance/transactions");
  revalidatePath("/dashboard");
  // Sprint 3: Return structured response so UI can show handover feedback
  return {
    success: true,
    handoverTriggered: shouldTriggerHandoverWait,
    unitId: shouldTriggerHandoverWait ? handoverWaitUnitId : null,
    unitCode: null, // resolved inside triggerMenungguSerahTerima — not accessible here
    bookingId: shouldTriggerHandoverWait ? handoverWaitBookingId : null,
    newUnitStatus: shouldTriggerHandoverWait ? "menunggu_serah_terima" : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPER: Cash/Installment Lunas → menunggu_serah_terima (Sprint 2)
// Dipanggil dari verifyPayment() saat semua 5 kondisi terpenuhi.
// Tidak diexport — hanya untuk internal finance module use.
// ─────────────────────────────────────────────────────────────────────────────
async function triggerMenungguSerahTerima(
  unitId: string,
  bookingId: string,
  changedById: string
) {
  const unit = await db
    .select({ id: units.id, code: units.code, status: units.status, isReadyStock: units.isReadyStock, constructionProgress: units.constructionProgress, currentSpkId: units.currentSpkId })
    .from(units)
    .where(eq(units.id, unitId))
    .get();
  if (!unit) return;

  // For non-ready-stock (indent) units: physical construction must be 100% complete
  if (!unit.isReadyStock && unit.constructionProgress < 100) {
    console.warn(
      `[triggerMenungguSerahTerima] Skip: unit ${unit.code} (indent) constructionProgress=${unit.constructionProgress}% < 100%. ` +
      `Pembayaran lunas tapi fisik belum selesai. Status tidak diubah.`
    );
    return;
  }

  if (!unit.isReadyStock) {
    console.warn(
      `[triggerMenungguSerahTerima] Skip: unit ${unit.code} belum melalui verifikasi BAST Vendor ke Developer.`
    );
    return;
  }

  // For indent units: SPK must also be officially completed (BAST Vendor uploaded)
  // This ensures the vendor → developer handover is formally closed before consumer handover
  if (!unit.isReadyStock && unit.currentSpkId) {
    const { spks } = await import("@/db/schema/production");
    const activeSpk = await db
      .select({ status: spks.status })
      .from(spks)
      .where(eq(spks.id, unit.currentSpkId))
      .get();

    // Only block if SPK is still in active/in-progress state (not yet completed)
    const SPK_NOT_DONE_STATUSES = ["active", "proses_konstruksi", "overdue"];
    if (activeSpk && SPK_NOT_DONE_STATUSES.includes(activeSpk.status)) {
      console.warn(
        `[triggerMenungguSerahTerima] Skip: unit ${unit.code} (indent) SPK status=${activeSpk.status}. ` +
        `SPK belum diselesaikan (BAST Vendor belum diupload). Status tidak diubah ke menunggu_serah_terima.`
      );
      return;
    }
  }

  const booking = await db
    .select({
      paymentScheme: bookings.paymentScheme,
      marketingId: bookings.marketingId,
      projectId: bookings.projectId,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .get();

  const oldStatus = unit.status;
  const schemeLabel = booking?.paymentScheme === "cash" ? "Cash" : "Installment";

  // Update unit status + history (in transaction)
  await db.transaction(async (tx) => {
    await tx.update(units).set({
      status: "menunggu_serah_terima",
      updatedAt: new Date(),
    }).where(eq(units.id, unitId)).run();

    await tx.insert(unitStatusHistories).values({
      id: crypto.randomUUID(),
      unitId,
      previousStatus: oldStatus,
      newStatus: "menunggu_serah_terima",
      reason: `Seluruh invoice ${schemeLabel} telah lunas — unit menunggu serah terima fisik kepada konsumen`,
      changedBy: changedById,
      changedAt: new Date(),
    }).run();
  });

  // Audit log
  try {
    await writeAuditLog({
      action: "update",
      module: "finance",
      entityId: unitId,
      entityType: "unit_handover_wait",
      details: {
        unitCode: unit.code,
        bookingId,
        oldStatus,
        newStatus: "menunggu_serah_terima",
        trigger: `${schemeLabel} invoice paid_full`,
      },
    });
  } catch (err) {
    console.warn("[triggerMenungguSerahTerima] Audit log gagal ditulis:", err);
  }

  // Notifikasi ke role berwenang
  // Sprint 3: Gunakan type "handover_waiting" (bukan "info") agar routing notifikasi eksplisit
  // entityType "unit_handover_wait" + entityId bookingId → redirect ke /marketing/bookings/[id]
  try {
    await notifyUsersWithRoles({
      roleNames: ["Super Admin", "Admin Kantor", "Direksi / Manager", "Marketing Manager"],
      type: "handover_waiting",
      title: "Unit Siap Serah Terima",
      message: `Unit ${unit.code} — seluruh pembayaran ${schemeLabel} telah lunas. Unit siap untuk diserahterimakan kepada konsumen.`,
      entityId: bookingId,  // bookingId utk deep link ke /marketing/bookings/[id]
      entityType: "unit_handover_wait",
    });

    if (booking?.marketingId) {
      await createNotification({
        userId: booking.marketingId,
        type: "handover_waiting",
        title: "Unit Siap Serah Terima",
        message: `Unit ${unit.code} yang Anda tangani telah lunas dan siap diserahterimakan.`,
        entityId: bookingId,  // bookingId utk deep link ke /marketing/bookings/[id]
        entityType: "unit_handover_wait",
      });
    }
  } catch (err) {
    console.warn("[triggerMenungguSerahTerima] Gagal mengirim notifikasi:", err);
  }

  revalidatePath("/finance/payments");
  revalidatePath("/master/units");
  if (booking?.projectId) {
    revalidatePath(`/siteplan/${booking.projectId}`);
  }
  revalidatePath("/siteplan");
}

export async function reversePayment(paymentId: string, reason: unknown) {
  // 1. Auth + Role guard: Admin Keuangan / Super Admin only (Req 4.1, 4.2)
  const activeUser = await requireAuth();
  const { isKeuangan, isSuperAdmin } = await getSessionRole(activeUser.id);
  if (!isKeuangan && !isSuperAdmin) {
    throw new Error("Hanya Admin Keuangan atau Super Admin yang dapat membatalkan pembayaran terverifikasi.");
  }

  // 2. Validate reason via reversalReasonSchema (min 10, max 500 chars) (Req 4.6)
  const validatedReason = reversalReasonSchema.parse(reason);

  // 3. Atomic transaction
  let auditDetails: any = {};

  await db.transaction(async (tx) => {
    // 3.1 Fetch payment
    const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment) throw new Error("Pembayaran tidak ditemukan.");

    // 3.2 State guards (Req 4.3, 4.4, 4.5)
    if (payment.status === "voided") throw new Error("Pembayaran ini sudah pernah di-void sebelumnya.");
    if (payment.status === "pending") throw new Error("Pembayaran pending tidak perlu di-void. Gunakan hapus/reject.");
    if (payment.status === "rejected") throw new Error("Pembayaran yang sudah ditolak tidak dapat di-void.");
    if (payment.status !== "verified") throw new Error("Hanya pembayaran terverifikasi yang dapat di-void.");

    // Pembayaran yang sudah menjadi dasar konstruksi, akad, atau serah-terima
    // tidak boleh di-void secara langsung. Koreksi tahap lanjut memerlukan
    // proses revisi/refund tersendiri agar status unit tidak terbelah.
    if (payment.invoiceId) {
      const invoice = await tx.select({ bookingId: invoices.bookingId }).from(invoices).where(eq(invoices.id, payment.invoiceId)).get();
      if (invoice?.bookingId) {
        const booking = await tx.select({ status: bookings.status, paymentScheme: bookings.paymentScheme, unitId: bookings.unitId })
          .from(bookings)
          .where(eq(bookings.id, invoice.bookingId))
          .get();
        const unit = booking
          ? await tx.select({ status: units.status }).from(units).where(eq(units.id, booking.unitId)).get()
          : null;
        if (
          booking &&
          (booking.status !== "active" || ["construction", "construction_done", "sold", "menunggu_serah_terima", "handover_complete"].includes(unit?.status ?? ""))
        ) {
          throw new Error("Pembayaran tidak dapat di-void setelah unit memasuki konstruksi, akad, atau serah terima. Gunakan proses revisi/refund terkontrol.");
        }
        if (booking?.paymentScheme === "kpr") {
          const kpr = await tx.select({ status: kprProcesses.status }).from(kprProcesses).where(eq(kprProcesses.bookingId, invoice.bookingId)).get();
          if (kpr && !["bi_checking", "rejected"].includes(kpr.status)) {
            throw new Error("Pembayaran KPR tidak dapat di-void setelah pipeline KPR berjalan. Gunakan proses revisi/refund terkontrol.");
          }
        }
      }
    }

    // 3.3 Find original income transaction for this payment (Req 4.7)
    const [originalIncome] = await tx.select().from(transactions)
      .where(and(
        eq(transactions.paymentId, payment.id),
        eq(transactions.type, "income"),
        // Must be non-reversal (originalIncome, not itself a reversal)
        sql`${transactions.reversalOfPaymentId} IS NULL`
      )).limit(1);

    if (!originalIncome) throw new Error("Transaksi income asli untuk pembayaran ini tidak ditemukan.");

    // 3.4 Use the original income's category for the reversal entry
    const categoryId = originalIncome.categoryId;

    // 3.5 Insert reversal transaction (netting model: negative income) (Req 4.8, 4.9, 7.5)
    const reversalTrxId = crypto.randomUUID();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();

    await tx.insert(transactions).values({
      id: reversalTrxId,
      transactionNumber: `TRX-REV-${dateStr}-${rand}`,
      projectId: originalIncome.projectId,
      unitId: originalIncome.unitId,
      customerId: originalIncome.customerId,
      paymentId: null, // NOT the original paymentId — avoids idempotency guard
      accountId: originalIncome.accountId,
      categoryId: categoryId,
      type: "income",
      description: `Reversal pembayaran ${payment.paymentNumber}: ${validatedReason}`,
      amount: -Math.abs(originalIncome.amount), // NEGATIVE (Req 4.9)
      transactionDate: new Date(),
      paymentMethod: originalIncome.paymentMethod,
      approvalStatus: "not_required",
      attachmentId: null,
      createdBy: activeUser.id,
      reversalOfPaymentId: payment.id,
      reversalOfTransactionId: originalIncome.id,
      reversalReason: validatedReason,
    }).run();

    // 3.6 Update payment status to "voided" (Req 4.10)
    await tx.update(payments).set({
      status: "voided",
    }).where(eq(payments.id, paymentId)).run();

    // 3.7 Recompute invoice status from remaining verified (non-voided) payments (Req 4.11)
    if (payment.invoiceId) {
      const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, payment.invoiceId)).limit(1);
      if (invoice) {
        const sumResult = await tx.select({ total: sum(payments.amount) }).from(payments)
          .where(and(
            eq(payments.invoiceId, payment.invoiceId),
            eq(payments.status, "verified")
          ));
        const paidTotal = Number(sumResult[0]?.total ?? 0);
        const newStatus = computeInvoiceStatus(paidTotal, invoice.amount);
        await tx.update(invoices).set({ status: newStatus, updatedAt: new Date() })
          .where(eq(invoices.id, payment.invoiceId)).run();
      }
    }

    // 3.8 Record finance activity in same tx (Req 4.13)
    await recordFinanceActivity(tx, {
      entityType: "payment",
      entityId: paymentId,
      action: "reversed",
      actorId: activeUser.id,
      fromStatus: "verified",
      toStatus: "voided",
      reason: validatedReason,
    });

    // Prepare audit details for outside-tx audit log
    auditDetails = {
      paymentId: payment.id,
      paymentNumber: payment.paymentNumber,
      amount: payment.amount,
      reason: validatedReason,
      originalPaymentId: payment.id,
      originalTransactionId: originalIncome.id,
      reversalTransactionId: reversalTrxId,
      userId: activeUser.id,
    };
  });

  // 4. Task 7.4: Audit void/reversal — non-blocking per Req 12.7
  try {
    await writeAuditLog({
      action: "void",
      module: "finance",
      entityId: paymentId,
      entityType: "payment",
      details: auditDetails,
    });
  } catch (err) {
    console.warn("[reversePayment] Audit log gagal ditulis:", err);
  }

  revalidatePath("/finance/payments");
  revalidatePath("/finance/transactions");
  return { success: true };
}

export async function deletePayment(paymentId: string) {
  const activeUser = await requireAuth();

  // Role guard: hard delete ONLY Super Admin (Req 4.1, 4.3, 11.8)
  const { isSuperAdmin } = await getSessionRole(activeUser.id);
  if (!isSuperAdmin) {
    throw new Error("Penghapusan permanen pembayaran hanya dapat dilakukan oleh Super Admin.");
  }

  // Fetch payment
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) throw new Error("Pembayaran tidak ditemukan.");

  // Status guards (Req 4.3, 4.4, 4.5)
  if (payment.status === "verified") {
    throw new Error("Pembayaran terverifikasi tidak dapat dihapus langsung. Gunakan proses void/reversal.");
  }
  if (payment.status === "voided") {
    throw new Error("Pembayaran yang sudah di-void tidak dapat dihapus.");
  }
  // Only pending/rejected allowed
  if (payment.status !== "pending" && payment.status !== "rejected") {
    throw new Error("Hanya pembayaran berstatus pending atau rejected yang dapat dihapus.");
  }

  // Proceed with hard delete
  await db.delete(payments).where(eq(payments.id, paymentId));

  // Audit (non-blocking per Req 12.6)
  try {
    await writeAuditLog({
      action: "delete",
      module: "finance",
      entityId: paymentId,
      entityType: "payment",
      details: { paymentNumber: payment.paymentNumber, status: payment.status, userId: activeUser.id },
    });
  } catch (err) {
    console.warn("[deletePayment] Audit log gagal ditulis:", err);
  }

  revalidatePath("/finance/payments");
  return { success: true };
}

// ==========================================
// 3. TRANSACTIONS / EXPENSE SERVICE LAYER
// ==========================================

export async function getTransactions(projectId?: string) {
  await requireAuth();

  const query = db
    .select({
      transaction: transactions,
      project: projects,
      account: financeAccounts,
      category: financeCategories,
      unit: units,
      customer: customers,
    })
    .from(transactions)
    .innerJoin(projects, eq(transactions.projectId, projects.id))
    .innerJoin(financeAccounts, eq(transactions.accountId, financeAccounts.id))
    .innerJoin(
      financeCategories,
      eq(transactions.categoryId, financeCategories.id)
    )
    .leftJoin(units, eq(transactions.unitId, units.id))
    .leftJoin(customers, eq(transactions.customerId, customers.id))
    .orderBy(desc(transactions.createdAt));

  if (projectId) {
    return query.where(eq(transactions.projectId, projectId));
  }

  return query;
}

/**
 * TransactionListItem — shape returned by server-side paginated transactions query.
 * Only includes columns needed for table display + filtering.
 */
export interface TransactionListItem {
  id: string;
  transactionNumber: string;
  projectId: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  transactionDate: Date;
  paymentMethod: "cash" | "transfer" | "giro" | "other";
  approvalStatus: "not_required" | "pending" | "approved" | "rejected" | "insufficient_balance";
  createdAt: Date;
  projectName: string;
  accountName: string;
  categoryName: string;
  categoryId: string;
  unitCode: string | null;
  customerName: string | null;
}

/**
 * Server-side paginated + filtered transactions query.
 * Eliminates N+1 by using JOINs and returns only the columns needed for the list view.
 */
export async function getTransactionsPaginated(params: {
  page: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  projectId?: string;
}): Promise<PaginatedResult<TransactionListItem>> {
  await requireAuth();

  const pageSize = params.pageSize || 20;

  // Build WHERE conditions
  const filterConditions: ReturnType<typeof eq>[] = [];

  // Project filter
  if (params.projectId) {
    filterConditions.push(eq(transactions.projectId, params.projectId));
  }

  // Category filter
  if (params.categoryId) {
    filterConditions.push(eq(transactions.categoryId, params.categoryId));
  }

  // Date range filter — start date (inclusive)
  if (params.startDate) {
    const start = new Date(params.startDate);
    filterConditions.push(gte(transactions.transactionDate, start));
  }

  // Date range filter — end date (inclusive, end of day)
  if (params.endDate) {
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);
    filterConditions.push(lte(transactions.transactionDate, end));
  }

  // Combine all conditions
  const whereClause = filterConditions.length > 0
    ? and(...filterConditions)
    : undefined;

  // Count query for pagination navigation (uses same JOINs for filter accuracy)
  const [countResult] = await db
    .select({ totalCount: count() })
    .from(transactions)
    .innerJoin(projects, eq(transactions.projectId, projects.id))
    .innerJoin(financeAccounts, eq(transactions.accountId, financeAccounts.id))
    .innerJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
    .leftJoin(units, eq(transactions.unitId, units.id))
    .leftJoin(customers, eq(transactions.customerId, customers.id))
    .where(whereClause);

  const totalCount = countResult?.totalCount ?? 0;

  // Validate and normalize pagination params
  const validatedParams = validatePaginationParams({ page: params.page, pageSize }, totalCount);
  const { limit, offset } = calculateOffset(validatedParams);
  const totalPages = Math.ceil(totalCount / validatedParams.pageSize);

  // Main data query with JOINs — specific columns only
  const results = await db
    .select({
      id: transactions.id,
      transactionNumber: transactions.transactionNumber,
      projectId: transactions.projectId,
      type: transactions.type,
      description: transactions.description,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
      paymentMethod: transactions.paymentMethod,
      approvalStatus: transactions.approvalStatus,
      createdAt: transactions.createdAt,
      projectName: projects.name,
      accountName: financeAccounts.name,
      categoryName: financeCategories.name,
      categoryId: transactions.categoryId,
      unitCode: units.code,
      customerName: customers.name,
    })
    .from(transactions)
    .innerJoin(projects, eq(transactions.projectId, projects.id))
    .innerJoin(financeAccounts, eq(transactions.accountId, financeAccounts.id))
    .innerJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
    .leftJoin(units, eq(transactions.unitId, units.id))
    .leftJoin(customers, eq(transactions.customerId, customers.id))
    .where(whereClause)
    .orderBy(desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data: results as TransactionListItem[],
    totalCount,
    page: validatedParams.page,
    pageSize: validatedParams.pageSize,
    totalPages,
  };
}

export async function createExpenseRequest(data: unknown) {
  const activeUser = await requireAnyRole(["Super Admin", "Admin Keuangan", "Admin Kantor", "Pengawas Lapangan", "Direksi / Manager"]);
  const parsed = expenseRequestSchema.parse(data);

  // ── Part B: Master data validation BEFORE inserting any record ──

  // 1. accountId validation — must exist, be active, and be cash or bank type
  const [account] = await db.select().from(financeAccounts).where(eq(financeAccounts.id, parsed.accountId)).limit(1);
  if (!account) throw new Error("Akun keuangan tidak ditemukan.");
  if (account.status !== "active") throw new Error("Akun keuangan tidak aktif.");
  if (account.type !== "cash" && account.type !== "bank") throw new Error("Akun pengeluaran harus bertipe Cash atau Bank.");

  // 2. categoryId validation — must exist, be active, and be expense type
  const [category] = await db.select().from(financeCategories).where(eq(financeCategories.id, parsed.categoryId)).limit(1);
  if (!category) throw new Error("Kategori keuangan tidak ditemukan.");
  if (category.status !== "active") throw new Error("Kategori keuangan tidak aktif.");
  if (category.type !== "expense") throw new Error("Kategori harus bertipe pengeluaran (expense).");

  // 3. projectId validation — must exist and be active
  const [project] = await db.select().from(projects).where(eq(projects.id, parsed.projectId)).limit(1);
  if (!project) throw new Error("Proyek tidak ditemukan.");
  if (project.status !== "active") throw new Error("Proyek tidak aktif.");

  const trxId = crypto.randomUUID();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const transactionNumber = `TRX-OUT-${dateStr}-${rand}`;

  let approvalStatusResult: "pending" | "insufficient_balance" = "pending";

  await db.transaction(async (tx) => {
    // 4. Balance check — compute real current balance from all settled transactions
    const expCheckData = await tx.select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(and(eq(transactions.accountId, parsed.accountId), eq(transactions.type, "expense"), eq(transactions.approvalStatus, "approved")))
      .all();
    const incCheckData = await tx.select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(and(eq(transactions.accountId, parsed.accountId), eq(transactions.type, "income"), eq(transactions.approvalStatus, "not_required")))
      .all();
    const realExpenseBalance = account.openingBalance + Number(incCheckData[0]?.total ?? 0) - Number(expCheckData[0]?.total ?? 0);
    const hasSufficient = realExpenseBalance >= parsed.amount;
    const approvalStatus = hasSufficient ? "pending" : "insufficient_balance";
    approvalStatusResult = approvalStatus;

    await tx.insert(transactions).values({
      id: trxId,
      transactionNumber,
      projectId: parsed.projectId,
      accountId: parsed.accountId,
      categoryId: parsed.categoryId,
      type: "expense",
      description: parsed.description,
      amount: parsed.amount,
      transactionDate: parsed.transactionDate,
      paymentMethod: parsed.paymentMethod,
      approvalStatus,
      attachmentId: parsed.attachmentId || null,
      createdBy: activeUser.id,
    }).run();

    const expenseInvoiceId = crypto.randomUUID();
    const expenseInvoiceNumber = `INV-EXP-${dateStr}-${rand}`;

    await tx.insert(invoices).values({
      id: expenseInvoiceId,
      invoiceNumber: expenseInvoiceNumber,
      projectId: parsed.projectId,
      unitId: null,
      customerId: null,
      bookingId: null,
      type: "other",
      amount: parsed.amount,
      dueDate: parsed.transactionDate,
      status: "unpaid",
      notes: `trxId:${trxId}`,
    }).run();

    // Record the expense-request submission in the finance activity timeline
    // (Req 3.3, 3.4, 3.9, 8.5). entityType "approval", entityId = transactions.id,
    // action "submitted", fromStatus null → toStatus = the resulting approvalStatus.
    // Inside the same tx so a history-insert failure rolls back the whole request.
    await recordFinanceActivity(tx, {
      entityType: "approval",
      entityId: trxId,
      action: "submitted",
      actorId: activeUser.id,
      fromStatus: null,
      toStatus: approvalStatus,
    });
  });

  try {
    await writeAuditLog({
      action: "create",
      module: "finance",
      entityId: trxId,
      entityType: "transaction",
      details: {
        transactionNumber,
        amount: parsed.amount,
        approvalStatus: approvalStatusResult,
      },
    });
  } catch (err) {
    console.warn("[createExpenseRequest] Audit log gagal ditulis:", err);
  }

  // Notify Direksi / Manager and Super Admin
  try {
    await notifyUsersWithRoles({
      roleNames: ["Direksi / Manager", "Super Admin"],
      type: "approval_pending",
      title: "Pengajuan Kas Keluar Baru",
      message: `Pengajuan kas keluar senilai Rp ${parsed.amount.toLocaleString()} untuk ${parsed.description} memerlukan persetujuan Anda.`,
      entityId: trxId,
      entityType: "transaction",
    });
  } catch (err) {
    console.warn("[createExpenseRequest] Notifikasi gagal dikirim:", err);
  }

  revalidatePath("/finance/transactions");
  revalidatePath("/finance/approvals");
  revalidatePath("/dashboard");
  return { success: true, transactionId: trxId };
}

export async function approveExpense(transactionId: string, notes?: string) {
  const activeUser = await requireAuth();

  // Role guard: Direksi/Manager or Super Admin only
  const { isDireksi: isDirector, isSuperAdmin: isSuper } = await getSessionRole(activeUser.id);

  if (!isDirector && !isSuper) {
    throw new Error("Hanya Direktur atau Manager yang dapat memberikan persetujuan.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 0 — Fetch + Guards (before any transaction)
  // ──────────────────────────────────────────────────────────────────────────

  // 1. Fetch the transaction by transactionId
  const trxResults = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (trxResults.length === 0) {
    throw new Error("Transaksi pengeluaran tidak ditemukan.");
  }

  const transaction = trxResults[0];

  // 2. Guard: must be expense type (Req 6.9)
  if (transaction.type !== "expense") {
    throw new Error("Transaksi pengeluaran tidak ditemukan.");
  }

  // 3. Guard terminal states (Req 6.3): approved, rejected, not_required are terminal
  if (transaction.approvalStatus === "approved") {
    throw new Error("Transaksi ini sudah disetujui dan tidak dapat diubah statusnya.");
  }
  if (transaction.approvalStatus === "rejected") {
    throw new Error("Transaksi yang sudah ditolak tidak dapat disetujui.");
  }
  if (transaction.approvalStatus === "not_required") {
    throw new Error("Transaksi ini tidak memerlukan persetujuan.");
  }

  // 4. Only "pending" and "insufficient_balance" are allowed to proceed
  // (any other unknown status is rejected)
  if (transaction.approvalStatus !== "pending" && transaction.approvalStatus !== "insufficient_balance") {
    throw new Error("Status transaksi tidak valid untuk persetujuan.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 1 — Balance check + insufficient_balance standalone commit (RISK-03 fix)
  // ──────────────────────────────────────────────────────────────────────────

  // 5. Compute real current balance
  const balance = await computeCurrentBalance(transaction.accountId);

  // 6. If balance < amount: standalone write OUTSIDE any transaction block,
  //    then throw. The write persists because it is auto-committed (Req 6.10, 6.11).
  if (balance < transaction.amount) {
    await db.update(transactions).set({
      approvalStatus: "insufficient_balance",
      updatedAt: new Date(),
    }).where(eq(transactions.id, transactionId));

    throw new Error(
      `Saldo akun tidak mencukupi untuk persetujuan. Saldo tersedia: Rp ${balance.toLocaleString('id-ID')}`
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 2 — Approval (inside db.transaction) (Req 6.1, 6.2, 6.4)
  // ──────────────────────────────────────────────────────────────────────────

  let transactionNumber = transaction.transactionNumber;
  let transactionAmount = transaction.amount;

  await db.transaction(async (tx) => {
    // Re-check balance inside tx for race condition safety
    const txBalance = await computeCurrentBalance(transaction.accountId);
    if (txBalance < transaction.amount) {
      // Another approval happened concurrently — mark insufficient_balance
      await db.update(transactions).set({
        approvalStatus: "insufficient_balance",
        updatedAt: new Date(),
      }).where(eq(transactions.id, transactionId));

      throw new Error(
        `Saldo akun tidak mencukupi untuk persetujuan. Saldo tersedia: Rp ${txBalance.toLocaleString('id-ID')}`
      );
    }

    // Set approvalStatus = "approved", approvedBy, approvalNotes, updatedAt
    await tx
      .update(transactions)
      .set({
        approvalStatus: "approved",
        approvedBy: activeUser.id,
        approvalNotes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, transactionId))
      .run();

    // Update corresponding auto-generated invoice (notes pattern "trxId:{id}") to "paid"
    await tx
      .update(invoices)
      .set({
        status: "paid",
        updatedAt: new Date(),
      })
      .where(eq(invoices.notes, `trxId:${transactionId}`))
      .run();

    // Close the material-request loop: when this expense originates from a
    // material request, propagate the approval back so production sees the
    // request move out of "finance_pending". Normal expenses leave this null.
    if (transaction.materialRequestId) {
      await tx
        .update(materialRequests)
        .set({ status: "approved" })
        .where(eq(materialRequests.id, transaction.materialRequestId))
        .run();
    }

    // Insert transactionApprovals record (Req 6.4)
    await tx.insert(transactionApprovals).values({
      id: crypto.randomUUID(),
      transactionId,
      approverId: activeUser.id,
      level: 1,
      status: "approved",
      notes: notes || null,
      actedAt: new Date(),
    }).run();

    // ── Budget deduct exactly-once (Req 6.5, 8.3, 8.4, 8.5, 8.7, 8.8, 8.9) ──
    // This block ONLY executes inside the approval transaction (PHASE 2), which
    // means it fires exclusively when the expense successfully transitions to
    // "approved". It never fires during create pending, create insufficient_balance,
    // reject, or re-approve (terminal guard already prevents re-approve).

    // Only active budget — "draft" and "closed" are excluded by the status filter.
    const activeBudgetResults = await tx
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.projectId, transaction.projectId),
          eq(budgets.status, "active")
        )
      )
      .limit(1)
      .all();

    if (activeBudgetResults.length > 0) {
      const activeBudget = activeBudgetResults[0];

      // Find matching budgetLine for this expense's category
      const budgetLineResults = await tx
        .select()
        .from(budgetLines)
        .where(
          and(
            eq(budgetLines.budgetId, activeBudget.id),
            eq(budgetLines.categoryId, transaction.categoryId)
          )
        )
        .limit(1)
        .all();

      // Req 8.5: No matching budgetLine → approval still succeeds, skip budget tracking
      if (budgetLineResults.length > 0) {
        const line = budgetLineResults[0];

        // Req 8.8: Row-level lock on budgetLine to serialize concurrent approvals
        await tx.execute(sql`SELECT id FROM budget_lines WHERE id = ${line.id} FOR UPDATE`);

        // Req 8.3, 8.7: Update exactly once per approval event
        const newUsed = line.usedAmount + transaction.amount;
        const newRemaining = line.allocatedAmount - newUsed;

        await tx
          .update(budgetLines)
          .set({
            usedAmount: newUsed,
            remainingAmount: newRemaining,
          })
          .where(eq(budgetLines.id, line.id))
          .run();

        // Req 8.4: Warning if remainingAmount <= 0 (budget line depleted)
        if (newRemaining <= 0) {
          await createNotification({
            userId: activeBudget.createdBy,
            type: "info",
            title: "Anggaran Kategori Habis",
            message: `Anggaran kategori ${transaction.categoryId} pada budget "${activeBudget.name}" telah habis (sisa: Rp ${newRemaining.toLocaleString('id-ID')}).`,
            entityId: activeBudget.id,
            entityType: "budget",
          });
        }
      }
    }

    // Record the approval in the finance activity timeline (Req 3.3, 3.9, 8.5).
    // entityType "approval", entityId = transactions.id, fromStatus → approved.
    // Inside the same tx so a history-insert failure rolls back the whole approval.
    await recordFinanceActivity(tx, {
      entityType: "approval",
      entityId: transactionId,
      action: "approved",
      actorId: activeUser.id,
      fromStatus: transaction.approvalStatus,
      toStatus: "approved",
    });
  });

  // Write Audit Log outside transaction
  try {
    await writeAuditLog({
      action: "approve",
      module: "finance",
      entityId: transactionId,
      entityType: "transaction",
      details: {
        transactionNumber,
        amount: transactionAmount,
      },
    });
  } catch (err) {
    console.warn("[approveExpense] Audit log gagal ditulis:", err);
  }

  // Notify requester
  try {
    const finalTrx = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
    if (finalTrx.length > 0 && finalTrx[0].createdBy) {
      await createNotification({
        userId: finalTrx[0].createdBy,
        type: "info",
        title: "Pengajuan Kas Keluar Disetujui",
        message: `Pengajuan kas keluar Anda senilai Rp ${finalTrx[0].amount.toLocaleString()} untuk "${finalTrx[0].description}" telah disetujui.`,
        entityId: transactionId,
        entityType: "transaction",
      });
    }
  } catch (err) {
    console.warn("[approveExpense] Notifikasi gagal dikirim:", err);
  }

  revalidatePath("/finance/transactions");
  revalidatePath("/finance/approvals");
  revalidatePath("/finance/budgets");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function rejectExpense(transactionId: string, notes: string) {
  const activeUser = await requireAuth();

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 0 — Input validation + Guards (before any mutation)
  // ──────────────────────────────────────────────────────────────────────────

  // 1. Notes validation: must be trimmed and non-empty (Req 6.6)
  const trimmedNotes = (notes ?? "").trim();
  if (trimmedNotes.length === 0) {
    throw new Error("Catatan penolakan wajib diisi.");
  }

  // Role guard: Direksi/Manager or Super Admin only
  const { isDireksi: isDirector, isSuperAdmin: isSuper } = await getSessionRole(activeUser.id);

  if (!isDirector && !isSuper) {
    throw new Error("Hanya Direktur atau Manager yang dapat menolak transaksi.");
  }

  // 2. Fetch transaction by transactionId
  const trxResults = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (trxResults.length === 0) {
    throw new Error("Transaksi pengeluaran tidak ditemukan.");
  }

  const transaction = trxResults[0];

  // 3. Type guard: must be expense type (Req 6.9)
  if (transaction.type !== "expense") {
    throw new Error("Transaksi pengeluaran tidak ditemukan.");
  }

  // 4. Terminal state guards (Req 6.3, 6.12)
  if (transaction.approvalStatus === "approved") {
    throw new Error("Transaksi yang sudah disetujui tidak dapat ditolak.");
  }
  if (transaction.approvalStatus === "rejected") {
    throw new Error("Transaksi ini sudah pernah ditolak.");
  }
  if (transaction.approvalStatus === "not_required") {
    throw new Error("Transaksi ini tidak memerlukan persetujuan.");
  }

  // 5. Only "pending" and "insufficient_balance" are allowed to proceed with rejection
  if (transaction.approvalStatus !== "pending" && transaction.approvalStatus !== "insufficient_balance") {
    throw new Error("Status transaksi tidak valid untuk penolakan.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 1 — Rejection (inside db.transaction) (Req 6.6, 6.7, 6.8, 6.12)
  // ──────────────────────────────────────────────────────────────────────────

  let transactionNumber = transaction.transactionNumber;
  let transactionAmount = transaction.amount;

  await db.transaction(async (tx) => {
    // 6. Set approvalStatus = "rejected", approvalNotes = trimmedNotes, updatedAt
    await tx
      .update(transactions)
      .set({
        approvalStatus: "rejected",
        approvalNotes: trimmedNotes,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, transactionId))
      .run();

    // 7. Cancel associated invoice with notes = "trxId:{transactionId}" → set status "cancelled"
    await tx
      .update(invoices)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(invoices.notes, `trxId:${transactionId}`))
      .run();

    // Close the material-request loop on rejection so production sees the
    // request move from "finance_pending" to "rejected". Normal expenses skip.
    if (transaction.materialRequestId) {
      await tx
        .update(materialRequests)
        .set({ status: "rejected" })
        .where(eq(materialRequests.id, transaction.materialRequestId))
        .run();
    }

    // 8. Insert transactionApprovals record (Req 6.4)
    await tx.insert(transactionApprovals).values({
      id: crypto.randomUUID(),
      transactionId,
      approverId: activeUser.id,
      level: 1,
      status: "rejected",
      notes: trimmedNotes,
      actedAt: new Date(),
    }).run();

    // 9. Record the rejection in the finance activity timeline (Req 3.3, 3.9, 8.5).
    // entityType "approval", entityId = transactions.id, toStatus "rejected",
    // reason = the persisted trimmedNotes. Inside the same tx so a history-insert
    // failure rolls back the whole rejection.
    await recordFinanceActivity(tx, {
      entityType: "approval",
      entityId: transactionId,
      action: "rejected",
      actorId: activeUser.id,
      fromStatus: transaction.approvalStatus,
      toStatus: "rejected",
      reason: trimmedNotes,
    });
  });

  // Write Audit Log outside transaction
  try {
    await writeAuditLog({
      action: "reject",
      module: "finance",
      entityId: transactionId,
      entityType: "transaction",
      details: {
        transactionNumber,
        amount: transactionAmount,
        reason: trimmedNotes,
      },
    });
  } catch (err) {
    console.warn("[rejectExpense] Audit log gagal ditulis:", err);
  }

  // Notify requester
  try {
    const finalTrx = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
    if (finalTrx.length > 0 && finalTrx[0].createdBy) {
      await createNotification({
        userId: finalTrx[0].createdBy,
        type: "info",
        title: "Pengajuan Kas Keluar Ditolak",
        message: `Pengajuan kas keluar Anda senilai Rp ${finalTrx[0].amount.toLocaleString()} untuk "${finalTrx[0].description}" ditolak. Catatan: ${trimmedNotes}`,
        entityId: transactionId,
        entityType: "transaction",
      });
    }
  } catch (err) {
    console.warn("[rejectExpense] Notifikasi gagal dikirim:", err);
  }

  revalidatePath("/finance/transactions");
  revalidatePath("/finance/approvals");
  return { success: true };
}

// ==========================================
// 4. BUDGETING SERVICE LAYER
// ==========================================

export async function getBudgets(projectId: string) {
  await requireAuth();

  return db
    .select({
      budget: budgets,
      project: projects,
    })
    .from(budgets)
    .innerJoin(projects, eq(budgets.projectId, projects.id))
    .where(eq(budgets.projectId, projectId))
    .orderBy(desc(budgets.createdAt));
}

export async function getBudgetDetails(budgetId: string) {
  await requireAuth();

  const results = await db
    .select({
      budget: budgets,
      project: projects,
    })
    .from(budgets)
    .innerJoin(projects, eq(budgets.projectId, projects.id))
    .where(eq(budgets.id, budgetId))
    .limit(1);

  if (results.length === 0) return null;

  const lines = await db
    .select({
      line: budgetLines,
      category: financeCategories,
    })
    .from(budgetLines)
    .innerJoin(financeCategories, eq(budgetLines.categoryId, financeCategories.id))
    .where(eq(budgetLines.budgetId, budgetId));

  return {
    ...results[0],
    lines,
  };
}

export async function createBudget(data: unknown) {
  const activeUser = await requireAnyRole(["Super Admin", "Admin Keuangan", "Direksi / Manager"]);
  const parsed = budgetSchema.parse(data);

  // ── Req 8.1: Validate budget line allocations ──
  for (const line of parsed.lines) {
    if (line.allocatedAmount < 0.01) {
      throw new Error("Setiap alokasi budget line harus bernilai minimal Rp 0,01.");
    }
  }

  const totalAllocated = parsed.lines.reduce((sum, l) => sum + l.allocatedAmount, 0);
  if (totalAllocated > parsed.totalAmount) {
    throw new Error(`Total alokasi budget line (Rp ${totalAllocated.toLocaleString('id-ID')}) melebihi total anggaran (Rp ${parsed.totalAmount.toLocaleString('id-ID')}).`);
  }

  const budgetId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    // 1. Insert Budget Header
    await tx.insert(budgets).values({
      id: budgetId,
      projectId: parsed.projectId,
      name: parsed.name,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      totalAmount: parsed.totalAmount,
      status: "draft",
      createdBy: activeUser.id,
    }).run();

    // 2. Insert Budget Lines
    for (const line of parsed.lines) {
      await tx.insert(budgetLines).values({
        id: crypto.randomUUID(),
        budgetId,
        categoryId: line.categoryId,
        allocatedAmount: line.allocatedAmount,
        usedAmount: 0,
        remainingAmount: line.allocatedAmount,
      }).run();
    }

    // 3. Finance activity timeline: record budget creation (Req 3.3, 3.4, 3.9, 9.4).
    // Recorded in the same tx as the budget insert so a history failure rolls back the create.
    await recordFinanceActivity(tx, {
      entityType: "budget",
      entityId: budgetId,
      action: "created",
      actorId: activeUser.id,
      fromStatus: null,
      toStatus: "draft",
    });
  });

  // 3. Audit Log outside transaction
  try {
    await writeAuditLog({
      action: "create",
      module: "finance",
      entityId: budgetId,
      entityType: "budget",
      details: { name: parsed.name, totalAmount: parsed.totalAmount },
    });
  } catch (err) {
    console.warn("[createBudget] Audit log gagal ditulis:", err);
  }

  revalidatePath("/finance/budgets");
  return { success: true, budgetId };
}

export async function updateDraftBudget(budgetId: string, data: unknown) {
  const activeUser = await requireAnyRole(["Super Admin", "Admin Keuangan", "Direksi / Manager"]);
  const parsed = budgetSchema.parse(data);

  const [budget] = await db.select().from(budgets).where(eq(budgets.id, budgetId)).limit(1);
  if (!budget) throw new Error("Budget tidak ditemukan.");
  if (budget.status !== "draft") {
    throw new Error("Hanya budget berstatus draft yang dapat diedit.");
  }

  for (const line of parsed.lines) {
    if (line.allocatedAmount < 0.01) {
      throw new Error("Setiap alokasi budget line harus bernilai minimal Rp 0,01.");
    }
  }

  const totalAllocated = parsed.lines.reduce((sum, line) => sum + line.allocatedAmount, 0);
  if (totalAllocated > parsed.totalAmount) {
    throw new Error(`Total alokasi budget line (Rp ${totalAllocated.toLocaleString("id-ID")}) melebihi total anggaran (Rp ${parsed.totalAmount.toLocaleString("id-ID")}).`);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(budgets)
      .set({
        projectId: parsed.projectId,
        name: parsed.name,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        totalAmount: parsed.totalAmount,
      })
      .where(eq(budgets.id, budgetId));

    await tx.delete(budgetLines).where(eq(budgetLines.budgetId, budgetId));

    for (const line of parsed.lines) {
      await tx.insert(budgetLines).values({
        id: crypto.randomUUID(),
        budgetId,
        categoryId: line.categoryId,
        allocatedAmount: line.allocatedAmount,
        usedAmount: 0,
        remainingAmount: line.allocatedAmount,
      });
    }

    await recordFinanceActivity(tx, {
      entityType: "budget",
      entityId: budgetId,
      action: "updated",
      actorId: activeUser.id,
      fromStatus: "draft",
      toStatus: "draft",
    });
  });

  try {
    await writeAuditLog({
      action: "update",
      module: "finance",
      entityId: budgetId,
      entityType: "budget",
      details: { name: parsed.name, totalAmount: parsed.totalAmount },
    });
  } catch (err) {
    console.warn("[updateDraftBudget] Audit log gagal ditulis:", err);
  }

  revalidatePath("/finance");
  revalidatePath("/finance/budgets");
  return { success: true };
}

export async function deleteDraftBudget(budgetId: string) {
  const activeUser = await requireAnyRole(["Super Admin", "Admin Keuangan", "Direksi / Manager"]);

  const [budget] = await db.select().from(budgets).where(eq(budgets.id, budgetId)).limit(1);
  if (!budget) throw new Error("Budget tidak ditemukan.");
  if (budget.status !== "draft") {
    throw new Error("Hanya budget berstatus draft yang dapat dihapus.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(budgetLines).where(eq(budgetLines.budgetId, budgetId));
    await tx.delete(budgets).where(eq(budgets.id, budgetId));

    await recordFinanceActivity(tx, {
      entityType: "budget",
      entityId: budgetId,
      action: "cancelled",
      actorId: activeUser.id,
      fromStatus: "draft",
      toStatus: "deleted",
      reason: "Draft budget dihapus sebelum aktivasi",
    });
  });

  try {
    await writeAuditLog({
      action: "delete",
      module: "finance",
      entityId: budgetId,
      entityType: "budget",
      details: { previousStatus: "draft", name: budget.name },
    });
  } catch (err) {
    console.warn("[deleteDraftBudget] Audit log gagal ditulis:", err);
  }

  revalidatePath("/finance");
  revalidatePath("/finance/budgets");
  return { success: true };
}

export async function activateBudget(budgetId: string) {
  await requireAnyRole(["Super Admin", "Admin Keuangan", "Direksi / Manager"]);

  // 1. Fetch budget
  const [budget] = await db.select().from(budgets).where(eq(budgets.id, budgetId)).limit(1);
  if (!budget) throw new Error("Budget tidak ditemukan.");
  if (budget.status === "active") throw new Error("Budget ini sudah aktif.");
  if (budget.status === "closed") throw new Error("Budget yang sudah ditutup tidak dapat diaktifkan.");
  if (budget.status !== "draft") throw new Error("Hanya budget berstatus draft yang dapat diaktifkan.");

  // 2. Check for overlapping active budget for same project (Req 8.2)
  // Overlap: startA < endB AND startB < endA (exclusive boundary)
  let overlapping: Array<{ id: string; name: string }> = [];
  try {
    overlapping = await db.select({ id: budgets.id, name: budgets.name })
      .from(budgets)
      .where(and(
        eq(budgets.projectId, budget.projectId),
        eq(budgets.status, "active"),
        // startA < endB
        lt(budgets.periodStart, budget.periodEnd),
        // startB < endA
        gt(budgets.periodEnd, budget.periodStart)
      ))
      .limit(1);
  } catch (err) {
    console.error("[activateBudget] Gagal memeriksa overlap periode budget:", err);
    throw new Error("Gagal memeriksa overlap periode anggaran. Silakan coba lagi atau hubungi admin sistem.");
  }

  if (overlapping.length > 0) {
    throw new Error(
      `Tidak dapat mengaktifkan budget: sudah ada budget aktif "${overlapping[0].name}" untuk proyek ini pada periode yang overlap.`
    );
  }

  // 3. Activate
  await db.update(budgets).set({ status: "active" }).where(eq(budgets.id, budgetId));

  // 4. Audit + activity
  try {
    await writeAuditLog({
      action: "update",
      module: "finance",
      entityId: budgetId,
      entityType: "budget",
      details: { previousStatus: "draft", newStatus: "active" },
    });
  } catch (err) {
    console.warn("[activateBudget] Audit log gagal ditulis:", err);
  }

  revalidatePath("/finance");
  revalidatePath("/finance/budgets");
  return { success: true };
}

// ==========================================
// 5. FINANCIAL STATEMENTS & REPORTING
// ==========================================

export async function getFinancialReport(projectId: string) {
  await requireAuth();

  // Incomes (approved / no approval needed)
  const incomeConditions = [eq(transactions.type, "income")];
  if (projectId && projectId !== "all") {
    incomeConditions.push(eq(transactions.projectId, projectId));
  }
  const incomeTrxs = await db
    .select()
    .from(transactions)
    .where(and(...incomeConditions));

  // Expenses (must be approved)
  const expenseConditions = [
    eq(transactions.type, "expense"),
    eq(transactions.approvalStatus, "approved")
  ];
  if (projectId && projectId !== "all") {
    expenseConditions.push(eq(transactions.projectId, projectId));
  }
  const expenseTrxs = await db
    .select()
    .from(transactions)
    .where(and(...expenseConditions));

  const totalIncome = incomeTrxs.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = expenseTrxs.reduce((sum, item) => sum + item.amount, 0);

  // Get all finance accounts with computed current balances
  const accountsList = await db.select().from(financeAccounts);

  // Aggregate settled transaction amounts per account and type in one query
  const balanceSums = await db
    .select({
      accountId: transactions.accountId,
      type: transactions.type,
      total: sum(transactions.amount),
    })
    .from(transactions)
    .where(
      sql`(
        (${transactions.type} = 'income' AND ${transactions.approvalStatus} = 'not_required') OR
        (${transactions.type} = 'expense' AND ${transactions.approvalStatus} = 'approved')
      )`
    )
    .groupBy(transactions.accountId, transactions.type);

  const accountsWithBalance = accountsList.map((acc) => {
    const incomeTotal = balanceSums
      .filter((s) => s.accountId === acc.id && s.type === "income")
      .reduce((t, s) => t + Number(s.total ?? 0), 0);
    const expenseTotal = balanceSums
      .filter((s) => s.accountId === acc.id && s.type === "expense")
      .reduce((t, s) => t + Number(s.total ?? 0), 0);
    return { ...acc, currentBalance: acc.openingBalance + incomeTotal - expenseTotal };
  });

  // Get budgets status
  const budgetList = await db
    .select({ budget: budgets })
    .from(budgets)
    .where(projectId && projectId !== "all" ? eq(budgets.projectId, projectId) : undefined);

  // Category wise expenses
  const categoryConditions = [
    eq(transactions.type, "expense"),
    eq(transactions.approvalStatus, "approved")
  ];
  if (projectId && projectId !== "all") {
    categoryConditions.push(eq(transactions.projectId, projectId));
  }
  const categoryExpenses = await db
    .select({
      categoryName: financeCategories.name,
      categoryId: transactions.categoryId,
      totalAmount: sum(transactions.amount),
    })
    .from(transactions)
    .innerJoin(
      financeCategories,
      eq(transactions.categoryId, financeCategories.id)
    )
    .where(and(...categoryConditions))
    .groupBy(transactions.categoryId, financeCategories.name);

  return {
    totalIncome,
    totalExpense,
    netCashFlow: totalIncome - totalExpense,
    accounts: accountsWithBalance,
    budgetsCount: budgetList.length,
    categoryExpenses: categoryExpenses.map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      amount: Number(c.totalAmount || 0),
    })),
    recentTransactions: [...incomeTrxs, ...expenseTrxs]
      .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime())
      .slice(0, 10),
  };
}

/**
 * Manual trigger for the overdue-invoice reminder scan (Settings page button).
 *
 * RBAC hardening (P0): previously `requireAuth()` only, so ANY authenticated
 * user — including Viewer / Kontraktor — could kick off a full invoice scan and
 * a broadcast to finance + management. Restricted to finance-operational roles.
 * The scan itself lives in an internal service so it is not separately callable.
 */
export async function checkPaymentReminders() {
  await requireAnyRole(["Super Admin", "Admin Keuangan", "Admin Kantor"]);
  return runPaymentReminderScan();
}

export async function deleteInvoice(invoiceId: string) {
  const activeUser = await requireAuth();

  // Validate authorization role: Super Admin or Admin Keuangan or Admin Kantor
  const { isSuperAdmin, isKeuangan, isAdminKantor } = await getSessionRole(activeUser.id);
  
  if (!isSuperAdmin && !isKeuangan && !isAdminKantor) {
    throw new Error("Anda tidak memiliki akses untuk menghapus invoice.");
  }

  // 1. Get Invoice details first
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) {
    throw new Error("Invoice tidak ditemukan.");
  }

  // 2. Check if invoice has any payments linked (verified or unverified)
  const linkedPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .limit(1);

  if (linkedPayments.length > 0) {
    throw new Error("Invoice tidak dapat dihapus karena sudah memiliki data pembayaran.");
  }

  // 3. Delete the invoice record
  await db.delete(invoices).where(eq(invoices.id, invoiceId));

  // 4. Write audit log
  try {
    await writeAuditLog({
      action: "delete",
      module: "finance",
      entityId: invoiceId,
      entityType: "invoice",
      details: {
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        type: invoice.type,
      },
    });
  } catch (err) {
    console.warn("[deleteInvoice] Audit log gagal ditulis:", err);
  }

  revalidatePath("/finance");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Backfill Utility — backfillInvoiceSchedule (Req 13.4)
// Backfills missing invoice schedules on existing bookings (cash/installment).
// ─────────────────────────────────────────────────────────────────────────────

export async function backfillInvoiceSchedule({ dryRun = true }: { dryRun?: boolean } = {}) {
  // 1. Role guard: Super Admin only
  const activeUser = await requireAuth();
  const { isSuperAdmin } = await getSessionRole(activeUser.id);
  if (!isSuperAdmin) throw new Error("Backfill hanya dapat dijalankan oleh Super Admin.");

  // 2. Find candidate bookings: active, not cancelled/rejected, paymentScheme cash/installment
  const candidateBookings = await db.select({
    id: bookings.id,
    bookingFee: bookings.bookingFee,
    dpAmount: bookings.dpAmount,
    paymentScheme: bookings.paymentScheme,
    termin: bookings.termin,
    bookingDate: bookings.bookingDate,
    projectId: bookings.projectId,
    unitId: bookings.unitId,
    customerId: bookings.customerId,
    status: bookings.status,
  }).from(bookings).where(
    and(
      inArray(bookings.paymentScheme, ["cash", "installment"]),
      inArray(bookings.status, ["active", "akad", "completed"])
    )
  );

  const report: Array<{ bookingId: string; action: "backfill" | "skip"; reason?: string; invoicesCreated?: number }> = [];

  for (const booking of candidateBookings) {
    // 3. Guard: unit not handover_complete
    const [unit] = await db.select({ status: units.status, price: units.price }).from(units).where(eq(units.id, booking.unitId)).limit(1);
    if (!unit || unit.status === "handover_complete") {
      report.push({ bookingId: booking.id, action: "skip", reason: "Unit handover_complete atau tidak ditemukan" });
      continue;
    }

    // 4. Guard: check if schedule already exists (has installment/cash_settlement invoices)
    const existingSchedule = await db.select({ id: invoices.id }).from(invoices).where(
      and(
        eq(invoices.bookingId, booking.id),
        inArray(invoices.scheduleKind, ["cash_settlement", "installment"])
      )
    ).limit(1);

    if (existingSchedule.length > 0) {
      report.push({ bookingId: booking.id, action: "skip", reason: "Schedule sudah ada" });
      continue;
    }

    // 5. Guard: check if remainingAmount <= 0
    const remainingForSchedule = unit.price - booking.bookingFee - booking.dpAmount;

    if (remainingForSchedule <= 0) {
      report.push({ bookingId: booking.id, action: "skip", reason: "remainingAmount <= 0, tidak perlu schedule" });
      continue;
    }

    // 6. Compute schedule (will only produce the missing pelunasan/termin invoices)
    if (dryRun) {
      // Dry-run: report what WOULD be created without writing DB
      try {
        const components = computeInvoiceSchedule(
          unit.price, booking.bookingFee, booking.dpAmount,
          booking.paymentScheme as "cash" | "installment",
          booking.termin || null, booking.bookingDate
        );
        const newComponents = components.filter(c => c.kind === "cash_settlement" || c.kind === "installment");
        report.push({ bookingId: booking.id, action: "backfill", invoicesCreated: newComponents.length });
      } catch (err) {
        report.push({ bookingId: booking.id, action: "skip", reason: `Compute error: ${err instanceof Error ? err.message : String(err)}` });
      }
    } else {
      // Real execution: use generateInvoiceSchedule which handles idempotent upsert
      try {
        await generateInvoiceSchedule(db, booking as any, { price: unit.price }, activeUser.id);
        // Count how many new schedule invoices now exist
        const afterSchedule = await db.select({ id: invoices.id }).from(invoices).where(
          and(eq(invoices.bookingId, booking.id), inArray(invoices.scheduleKind, ["cash_settlement", "installment"]))
        );
        report.push({ bookingId: booking.id, action: "backfill", invoicesCreated: afterSchedule.length });

        // Audit per booking
        try {
          await writeAuditLog({
            action: "create",
            module: "finance",
            entityId: booking.id,
            entityType: "backfill_schedule",
            details: { bookingId: booking.id, invoicesCreated: afterSchedule.length, dryRun: false },
          });
        } catch (err) { console.warn("[backfill] Audit gagal:", err); }
      } catch (err) {
        report.push({ bookingId: booking.id, action: "skip", reason: `Execution error: ${err instanceof Error ? err.message : String(err)}` });
      }
    }
  }

  return { success: true, dryRun, report, totalCandidates: candidateBookings.length, backfilled: report.filter(r => r.action === "backfill").length, skipped: report.filter(r => r.action === "skip").length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared page data loader — used by finance/page.tsx and finance/approvals/page.tsx
// Centralizes all DB queries + in-memory enrichment in one place.
// ─────────────────────────────────────────────────────────────────────────────
export async function getFinancePageData() {
  const [
    projectsList,
    unitsList,
    customersList,
    accountsList,
    categoriesList,
    invoicesList,
    paymentsList,
    transactionsList,
    budgetsList,
    usersList,
    bookingProofAttachments,
    budgetLinesList,
  ] = await Promise.all([
    cachedQuery(
      () => db.select().from(projects),
      ["projects", "list"],
      { tags: ["projects"], revalidate: 300, fallback: [] }
    ),
    cachedQuery(
      () => db.select().from(units),
      ["units", "all"],
      { tags: ["units"], revalidate: 300, fallback: [] }
    ),
    cachedQuery(
      () => db.select().from(customers),
      ["customers", "all"],
      { tags: ["customers"], revalidate: 300, fallback: [] }
    ),
    db.select().from(financeAccounts),
    db.select().from(financeCategories),

    // Invoices with project and customer joins
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        projectId: invoices.projectId,
        unitId: invoices.unitId,
        customerId: invoices.customerId,
        bookingId: invoices.bookingId,
        type: invoices.type,
        amount: invoices.amount,
        dueDate: invoices.dueDate,
        status: invoices.status,
        notes: invoices.notes,
        createdAt: invoices.createdAt,
        scheduleKind: invoices.scheduleKind,
        scheduleSequence: invoices.scheduleSequence,
        scheduleLabel: invoices.scheduleLabel,
        projectName: projects.name,
        customerName: customers.name,
        unitCode: units.code,
      })
      .from(invoices)
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(units, eq(invoices.unitId, units.id))
      .orderBy(desc(invoices.createdAt)),

    // Payments with joined details
    db
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        paymentNumber: payments.paymentNumber,
        projectId: payments.projectId,
        unitId: payments.unitId,
        customerId: payments.customerId,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
        paymentMethod: payments.paymentMethod,
        proofAttachmentId: payments.proofAttachmentId,
        proofFileUrl: attachments.fileUrl,
        proofUploadedBy: attachments.uploadedBy,
        status: payments.status,
        verifiedBy: payments.verifiedBy,
        verifiedAt: payments.verifiedAt,
        uploadedBy: payments.uploadedBy,
        createdAt: payments.createdAt,
        projectName: projects.name,
        customerName: customers.name,
        unitCode: units.code,
        invoiceNumber: invoices.invoiceNumber,
      })
      .from(payments)
      .innerJoin(projects, eq(payments.projectId, projects.id))
      .leftJoin(customers, eq(payments.customerId, customers.id))
      .leftJoin(units, eq(payments.unitId, units.id))
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .leftJoin(attachments, eq(payments.proofAttachmentId, attachments.id))
      .orderBy(desc(payments.createdAt)),

    // Ledger Transactions (includes reversal markers for ledger classification)
    db
      .select({
        id: transactions.id,
        transactionNumber: transactions.transactionNumber,
        projectId: transactions.projectId,
        unitId: transactions.unitId,
        customerId: transactions.customerId,
        paymentId: transactions.paymentId,
        accountId: transactions.accountId,
        categoryId: transactions.categoryId,
        type: transactions.type,
        description: transactions.description,
        amount: transactions.amount,
        transactionDate: transactions.transactionDate,
        paymentMethod: transactions.paymentMethod,
        approvalStatus: transactions.approvalStatus,
        approvedBy: transactions.approvedBy,
        approvalNotes: transactions.approvalNotes,
        attachmentId: transactions.attachmentId,
        createdBy: transactions.createdBy,
        createdAt: transactions.createdAt,
        // Additive: reversal markers for ledger tab classification (Req 6.2, 17.4)
        reversalOfTransactionId: transactions.reversalOfTransactionId,
        reversalOfPaymentId: transactions.reversalOfPaymentId,
        reversalReason: transactions.reversalReason,
        projectName: projects.name,
        accountName: financeAccounts.name,
        categoryName: financeCategories.name,
        unitCode: units.code,
        customerName: customers.name,
      })
      .from(transactions)
      .innerJoin(projects, eq(transactions.projectId, projects.id))
      .innerJoin(financeAccounts, eq(transactions.accountId, financeAccounts.id))
      .innerJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
      .leftJoin(units, eq(transactions.unitId, units.id))
      .leftJoin(customers, eq(transactions.customerId, customers.id))
      .orderBy(desc(transactions.createdAt)),

    // Budgets
    db
      .select({
        id: budgets.id,
        projectId: budgets.projectId,
        name: budgets.name,
        periodStart: budgets.periodStart,
        periodEnd: budgets.periodEnd,
        totalAmount: budgets.totalAmount,
        status: budgets.status,
        createdAt: budgets.createdAt,
        projectName: projects.name,
      })
      .from(budgets)
      .innerJoin(projects, eq(budgets.projectId, projects.id))
      .orderBy(desc(budgets.createdAt)),

    // Users
    db.select({ id: userTable.id, name: userTable.name }).from(userTable),

    // Bukti pembayaran pada halaman Booking dapat dipakai kembali oleh Finance
    // sebagai fallback tampilan. Ini tidak mengubah relasi payment atau file.
    db
      .select({
        bookingId: attachments.entityId,
        entityType: attachments.entityType,
        fileUrl: attachments.fileUrl,
        fileName: attachments.fileName,
        createdAt: attachments.createdAt,
      })
      .from(attachments)
      .where(
        inArray(attachments.entityType, [
          "booking_bf",
          "booking_dp",
          "booking_cash_settlement",
        ])
      )
      .orderBy(desc(attachments.createdAt)),

    // Additive: Budget lines for all budgets (Req 9.3, 10.2, 17.4)
    // Provides budgetLines.usedAmount and allocatedAmount for budget summary/detail
    db
      .select({
        id: budgetLines.id,
        budgetId: budgetLines.budgetId,
        categoryId: budgetLines.categoryId,
        allocatedAmount: budgetLines.allocatedAmount,
        usedAmount: budgetLines.usedAmount,
        remainingAmount: budgetLines.remainingAmount,
      })
      .from(budgetLines),
  ]);

  // A payment proof that is directly attached to a payment remains the source
  // of truth. The following mapping only fills the display gap for legacy
  // booking uploads that are stored under the booking entity instead.
  const bookingProofAttachmentByKey = new Map<
    string,
    (typeof bookingProofAttachments)[number]
  >();
  for (const attachment of bookingProofAttachments) {
    const key = `${attachment.bookingId}:${attachment.entityType}`;
    if (!bookingProofAttachmentByKey.has(key)) {
      bookingProofAttachmentByKey.set(key, attachment);
    }
  }

  const enrichedInvoices = invoicesList.map((invoice) => {
    const bookingProofEntityType =
      invoice.type === "booking_fee"
        ? "booking_bf"
        : invoice.type === "dp"
          ? "booking_dp"
          : invoice.scheduleKind === "cash_settlement"
            ? "booking_cash_settlement"
            : null;

    const bookingProof =
      invoice.bookingId && bookingProofEntityType
        ? bookingProofAttachmentByKey.get(
            `${invoice.bookingId}:${bookingProofEntityType}`
          )
        : undefined;

    // Additive: Total payment verified per invoice & remaining balance (Req 5.2, 17.4)
    // Used by payment selector to show sisa tagihan and by invoice tab for Sudah Dibayar column
    const verifiedPaymentsForInvoice = paymentsList.filter(
      (p) => p.invoiceId === invoice.id && p.status === "verified"
    );
    // A paid internal expense invoice can be settled by the approval flow and
    // therefore legitimately have no verified payment row.
    const paymentSummary = computeInvoicePaymentSummary(
      invoice.amount,
      verifiedPaymentsForInvoice,
      { invoiceStatus: invoice.status },
    );

    // Additive: Invoice internal context (Req 2.4, 17.4)
    // Only classify as internal if notes = "trxId:<id>" AND that id references an expense transaction
    let relatedExpenseTransactionId: string | null = null;
    let relatedApprovalId: string | null = null;

    if (invoice.notes) {
      const trxIdMatch = invoice.notes.match(/^trxId:(.+)$/);
      if (trxIdMatch) {
        const candidateId = trxIdMatch[1];
        const matchedTrx = transactionsList.find(
          (t) => t.id === candidateId && t.type === "expense"
        );
        if (matchedTrx) {
          relatedExpenseTransactionId = matchedTrx.id;
          // The approval for this expense transaction is the transaction itself
          // (transactions with approvalStatus = approved are the approved expense)
          relatedApprovalId = matchedTrx.id;
        }
      }
    }

    return {
      ...invoice,
      bookingProofFileUrl: bookingProof?.fileUrl ?? null,
      bookingProofFileName: bookingProof?.fileName ?? null,
      // Additive optional fields (Req 17.4, 17.5)
      totalPaidVerified: paymentSummary.totalPaid,
      remainingBalance: paymentSummary.remainingBalance,
      relatedExpenseTransactionId,
      relatedApprovalId,
    };
  });

  // Enrich transactions: resolve approver/verifier names + link to invoice
  const enrichedTransactions = transactionsList.map((trx) => {
    let resolvedApproverName = null;

    if (trx.type === "income" && trx.paymentId) {
      const payment = paymentsList.find((p) => p.id === trx.paymentId);
      if (payment?.verifiedBy) {
        const verifier = usersList.find((u) => u.id === payment.verifiedBy);
        if (verifier) resolvedApproverName = verifier.name;
      }
    }
    if (trx.type === "expense" && trx.approvedBy) {
      const approver = usersList.find((u) => u.id === trx.approvedBy);
      if (approver) resolvedApproverName = approver.name;
    }

    let invoiceNumber = null;
    let invoiceId = null;
    if (trx.paymentId) {
      const payment = paymentsList.find((p) => p.id === trx.paymentId);
      if (payment?.invoiceId) {
        const invoice = invoicesList.find((i) => i.id === payment.invoiceId);
        if (invoice) { invoiceNumber = invoice.invoiceNumber; invoiceId = invoice.id; }
      }
    } else {
      const matchInvoice = invoicesList.find((i) => i.notes === `trxId:${trx.id}`);
      if (matchInvoice) { invoiceNumber = matchInvoice.invoiceNumber; invoiceId = matchInvoice.id; }
    }

    return { ...trx, invoiceNumber, invoiceId, resolvedApproverName };
  });

  // Compute balance per account — only approved transactions count
  const balanceMap: Record<string, number> = {};
  for (const acc of accountsList) {
    balanceMap[acc.id] = acc.openingBalance ?? 0;
  }
  for (const trx of transactionsList) {
    if (!(trx.accountId in balanceMap)) balanceMap[trx.accountId] = 0;
    if (trx.type === "income" && (trx.approvalStatus === "approved" || trx.approvalStatus === "not_required")) {
      balanceMap[trx.accountId] += trx.amount;
    } else if (trx.type === "expense" && trx.approvalStatus === "approved") {
      balanceMap[trx.accountId] -= trx.amount;
    }
  }

  const enrichedAccounts = accountsList.map((acc) => ({
    ...acc,
    currentBalance: balanceMap[acc.id] ?? acc.openingBalance ?? 0,
  }));

  // Additive: Actual budget usage per budget per category (Req 9.3, 10.2, 17.4)
  // Aggregates expense transactions with approvalStatus = "approved" grouped by
  // projectId + categoryId within each budget's period. This provides "Realisasi Aktual"
  // for Budget Summary and BudgetsTab independent of persisted budgetLines.usedAmount.
  const budgetActualUsage: Array<{
    budgetId: string;
    categoryId: string;
    actualAmount: number;
  }> = [];

  for (const budget of budgetsList) {
    if (budget.status !== "active") continue;

    // Get category IDs allocated in this budget
    const budgetCategoryIds = budgetLinesList
      .filter((bl) => bl.budgetId === budget.id)
      .map((bl) => bl.categoryId);

    if (budgetCategoryIds.length === 0) continue;

    // Aggregate approved expense transactions matching this budget's project, categories, and period
    for (const catId of budgetCategoryIds) {
      const actualAmount = transactionsList
        .filter((trx) =>
          trx.type === "expense" &&
          trx.approvalStatus === "approved" &&
          trx.projectId === budget.projectId &&
          trx.categoryId === catId &&
          trx.transactionDate >= budget.periodStart &&
          trx.transactionDate <= budget.periodEnd
        )
        .reduce((sum, trx) => sum + trx.amount, 0);

      budgetActualUsage.push({
        budgetId: budget.id,
        categoryId: catId,
        actualAmount,
      });
    }
  }

  return {
    projects: projectsList,
    units: unitsList,
    customers: customersList,
    accounts: enrichedAccounts,
    categories: categoriesList,
    invoices: enrichedInvoices,
    payments: paymentsList,
    transactions: enrichedTransactions,
    budgets: budgetsList,
    // Additive fields for UI revamp (Req 17.4, 17.5)
    budgetLines: budgetLinesList,
    budgetActualUsage,
  };
}
