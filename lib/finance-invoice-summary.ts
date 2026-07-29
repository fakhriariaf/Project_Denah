/**
 * Pure invoice payment-summary arithmetic.
 *
 * This module is intentionally free of any database or React dependency so the
 * invoice payment-summary rule can be unit- and property-tested in isolation.
 *
 * Requirement mapping:
 * - Requirement 5.2: the invoice detail page displays a payment status summary
 *   showing total invoice amount, total paid amount, and remaining balance.
 * - Finance expense invoices (`INV-EXP-*`) are settled by the approval flow
 *   rather than the `payments` table. When an invoice is already marked `paid`,
 *   the summary must show it as fully paid even when there is no verified
 *   payment row.
 *
 * The invoice detail page (`app/finance/invoices/[id]/page.tsx`) fetches the
 * related payments from the database and then computes the summary purely from
 * that in-memory list. Routing that computation through this single pure
 * function makes the arithmetic rule the one source of truth and keeps it
 * verifiable without a database.
 */

/** Payment verification status values (mirrors `payments.status`). */
export type PaymentSummaryStatus = "pending" | "verified" | "rejected" | "voided";

/** Minimal shape required to summarise a payment: an amount and a status. */
export interface PaymentSummaryInput {
  amount: number;
  status: PaymentSummaryStatus;
}

/** The computed invoice payment summary. */
export interface InvoicePaymentSummary {
  /** Sum of amounts of VERIFIED payments only. */
  totalPaid: number;
  /** `max(0, invoiceAmount - totalPaid)` — never negative. */
  remainingBalance: number;
}

export interface InvoicePaymentSummaryOptions {
  /** Invoice status, when available from the caller. */
  invoiceStatus?: string | null;
}

/**
 * Compute the invoice payment summary from an invoice amount and its related
 * payments.
 *
 * Rules (Requirement 5.2):
 * - `totalPaid` is the sum of amounts of payments whose `status === "verified"`.
 *   Pending and rejected payments are excluded.
 * - If the invoice status is already `paid`, `totalPaid` is at least the
 *   invoice amount. This supports approval-settled expense invoices that do not
 *   have payment rows.
 * - `remainingBalance = max(0, invoiceAmount - totalPaid)`, so it is never
 *   negative.
 */
export function computeInvoicePaymentSummary(
  invoiceAmount: number,
  payments: readonly PaymentSummaryInput[],
  options: InvoicePaymentSummaryOptions = {},
): InvoicePaymentSummary {
  const verifiedPaymentTotal = payments.reduce(
    (sum, payment) => (payment.status === "verified" ? sum + payment.amount : sum),
    0,
  );
  const totalPaid =
    options.invoiceStatus === "paid"
      ? Math.max(verifiedPaymentTotal, invoiceAmount)
      : verifiedPaymentTotal;

  const remainingBalance = Math.max(0, invoiceAmount - totalPaid);

  return { totalPaid, remainingBalance };
}

export default computeInvoicePaymentSummary;

// ---------------------------------------------------------------------------
// Invoice Document Context Classification (Requirement 2.4, 5.4)
// ---------------------------------------------------------------------------

/**
 * Badge variant for document context presentation.
 * Used by FinanceDocumentContextBadge component.
 */
export type InvoiceDocumentContextKind = "customer" | "internal" | "neutral";

/**
 * Result of classifying an invoice into its document context.
 * Pure presentation value — no persistence, no side effects.
 */
export interface InvoiceDocumentContext {
  /** Classification kind: customer, internal, or neutral. */
  kind: InvoiceDocumentContextKind;
  /** Human-readable label in Bahasa Indonesia. */
  label: string;
  /** Label for the customer or recipient column. */
  customerOrRecipientLabel: string;
  /** Badge variant for FinanceDocumentContextBadge. */
  badgeVariant: InvoiceDocumentContextKind;
  /** Related approval ID if invoice is internal and approval data available. */
  relatedApprovalId?: string | null;
}

/**
 * Input shape for the classification helper.
 * Mirrors the enriched invoice fields from getFinancePageData.
 */
export interface InvoiceDocumentContextInput {
  /** Invoice type: booking_fee, dp, installment, cash_settlement, or other. */
  type: string;
  /** Customer ID from the invoice. Null does NOT alone indicate internal. */
  customerId?: string | null;
  /** Booking ID from the invoice. Presence strengthens customer context. */
  bookingId?: string | null;
  /** Customer name for display purposes. */
  customerName?: string | null;
  /** Invoice notes field; may contain "trxId:<id>" pattern. */
  notes?: string | null;
  /** Schedule kind if available (booking_fee, dp, installment, cash_settlement). */
  scheduleKind?: string | null;
  /**
   * Set by the data loader ONLY when `notes = trxId:<id>` has been verified
   * against an actual expense transaction. This is the authoritative signal
   * for internal classification.
   */
  relatedExpenseTransactionId?: string | null;
  /**
   * Related approval ID, set by the data loader when the expense transaction
   * reference is verified.
   */
  relatedApprovalId?: string | null;
}

/**
 * Classify an invoice into its document context for UI presentation.
 *
 * This is a PURE function — deterministic, no side effects, no queries.
 * Same input always produces the same output.
 *
 * Classification order (per design §5.2):
 * 1. Internal: ONLY if `relatedExpenseTransactionId` is set (meaning the loader
 *    verified that `notes = trxId:<id>` references an expense transaction).
 *    `customerId = null` or `type = other` alone is NOT sufficient.
 * 2. Customer: schedule/type indicates customer invoice (booking_fee, dp,
 *    installment, cash_settlement) OR has booking/customer relation.
 * 3. Neutral: fallback when context cannot be determined with certainty.
 *
 * @param invoice - Enriched invoice data from data loader.
 * @returns InvoiceDocumentContext with classification and display labels.
 *
 * _Requirements: 2.4, 5.4_
 */
export function getInvoiceDocumentContext(
  invoice: InvoiceDocumentContextInput,
): InvoiceDocumentContext {
  const customerName = invoice.customerName?.trim() || null;
  // --- Step 1: Internal classification ---
  // Only if the loader has verified notes = trxId:<id> → expense transaction
  if (invoice.relatedExpenseTransactionId) {
    return {
      kind: "internal",
      label: "Pengeluaran Internal",
      customerOrRecipientLabel: "Penerima",
      badgeVariant: "internal",
      relatedApprovalId: invoice.relatedApprovalId ?? null,
    };
  }

  // --- Step 2: Customer classification ---
  // Customer invoice types from schedule system
  const customerScheduleKinds = new Set([
    "booking_fee",
    "dp",
    "installment",
    "cash_settlement",
  ]);

  // Customer invoice types from legacy type field
  const customerTypes = new Set(["booking_fee", "dp", "installment", "cash_settlement"]);

  const hasCustomerSchedule =
    invoice.scheduleKind != null &&
    customerScheduleKinds.has(invoice.scheduleKind);

  const hasCustomerType = customerTypes.has(invoice.type);

  const hasCustomerRelation = Boolean(invoice.customerId) || Boolean(invoice.bookingId);

  if (hasCustomerSchedule || hasCustomerType || hasCustomerRelation) {
    return {
      kind: "customer",
      label: "Invoice Customer",
      customerOrRecipientLabel: customerName ?? "Customer",
      badgeVariant: "customer",
      relatedApprovalId: null,
    };
  }

  // --- Step 3: Neutral fallback ---
  // Context cannot be determined with certainty. Do NOT assume internal
  // from customerId = null or type = other alone.
  return {
    kind: "neutral",
    label: "Dokumen Keuangan",
    customerOrRecipientLabel: customerName ?? "\u2014",
    badgeVariant: "neutral",
    relatedApprovalId: null,
  };
}
