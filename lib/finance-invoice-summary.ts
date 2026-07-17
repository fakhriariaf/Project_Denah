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
