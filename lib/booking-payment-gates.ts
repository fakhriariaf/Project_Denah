/**
 * Pure payment gates shared by booking actions.
 *
 * These helpers intentionally contain no database access so the same rules can
 * be enforced by server actions and covered by regression tests.
 */

export type BookingPaymentScheme = "cash" | "installment" | "kpr" | string | null | undefined;

export type ScheduledInvoiceStatus = "unpaid" | "partial" | "paid" | "cancelled" | string;

export interface ScheduledInstallment {
  id: string;
  status: ScheduledInvoiceStatus;
}

/**
 * A one-time Cash purchase must be fully settled before consumer construction
 * begins. Cash Bertahap starts construction after BF/DP and documents pass;
 * its remaining terms are enforced before Akad / PPJB.
 */
export function requiresFullSettlementBeforeConstruction(paymentScheme: BookingPaymentScheme): boolean {
  return paymentScheme === "cash";
}

/**
 * Prevents a user from uploading proof for a later term while any earlier term
 * is still unpaid. A cancelled earlier term is not payable and therefore does
 * not block the following term.
 */
export function getInstallmentProofGate(
  installments: readonly ScheduledInstallment[],
  targetInvoiceId: string,
): { eligible: true } | { eligible: false; reason: string } {
  const targetIndex = installments.findIndex((invoice) => invoice.id === targetInvoiceId);
  if (targetIndex < 0) {
    return {
      eligible: false,
      reason: "Jadwal termin tidak valid. Silakan hubungi Admin Keuangan.",
    };
  }

  const hasUnpaidPriorTermin = installments
    .slice(0, targetIndex)
    .some((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled");

  return hasUnpaidPriorTermin
    ? {
        eligible: false,
        reason: "Termin sebelumnya harus lunas dan terverifikasi sebelum bukti pembayaran termin ini dapat diunggah.",
      }
    : { eligible: true };
}
