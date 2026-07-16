/**
 * Pure invoice payment-summary arithmetic.
 *
 * This module is intentionally free of any database or React dependency so the
 * invoice payment-summary rule can be unit- and property-tested in isolation.
 *
 * Requirement mapping:
 * - Requirement 5.2: the invoice detail page displays a payment status summary
 *   showing total invoice amount, total paid amount (sum of VERIFIED payments
 *   only), and remaining balance (total amount minus paid amount, minimum
 *   zero).
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

/**
 * Compute the invoice payment summary from an invoice amount and its related
 * payments.
 *
 * Rules (Requirement 5.2):
 * - `totalPaid` is the sum of amounts of payments whose `status === "verified"`.
 *   Pending and rejected payments are excluded.
 * - `remainingBalance = max(0, invoiceAmount - totalPaid)`, so it is never
 *   negative.
 */
export function computeInvoicePaymentSummary(
  invoiceAmount: number,
  payments: readonly PaymentSummaryInput[],
): InvoicePaymentSummary {
  const totalPaid = payments.reduce(
    (sum, payment) => (payment.status === "verified" ? sum + payment.amount : sum),
    0,
  );

  const remainingBalance = Math.max(0, invoiceAmount - totalPaid);

  return { totalPaid, remainingBalance };
}

export default computeInvoicePaymentSummary;
