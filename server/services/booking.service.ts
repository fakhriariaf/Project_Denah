/**
 * booking.service.ts
 *
 * Business-logic helpers for the Booking domain.
 * These functions operate at a higher level than repositories — they enforce
 * domain rules that cross table boundaries, e.g. "can this booking be cancelled?"
 *
 * Services accept a Drizzle transaction object so they can be composed inside
 * the caller's transaction for atomicity.
 *
 * Usage: import from "@/server/services" or directly from this file.
 */

import { db } from "@/db";
import { bookings, type bookings as bookingsType } from "@/db/schema/marketing";
import { invoices, payments } from "@/db/schema/finance";
import { eq, and, inArray } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result returned by validateBookingCancellation. */
export type CancellationValidationResult =
  | { canCancel: true }
  | { canCancel: false; reason: "paid_invoice" | "verified_payment"; message: string };

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Validate whether a booking can be directly cancelled (P0 guard).
 *
 * Cancellation is BLOCKED when:
 * 1. Any invoice linked to the booking has status "paid" or "partial", OR
 * 2. Any payment linked to the booking's invoices has status "verified".
 *
 * These checks must happen inside the caller's transaction to avoid
 * stale-read race conditions.
 *
 * @param bookingId  The booking to validate.
 * @param tx         An active Drizzle transaction (or the global `db` instance).
 * @returns          A discriminated union indicating whether cancellation is allowed.
 *
 * @example
 * ```ts
 * await db.transaction(async (tx) => {
 *   const guard = await validateBookingCancellation(bookingId, tx);
 *   if (!guard.canCancel) throw new Error(guard.message);
 *   // ... proceed with cancellation
 * });
 * ```
 */
export async function validateBookingCancellation(
  bookingId: string,
  tx: typeof db
): Promise<CancellationValidationResult> {
  // Guard 1: check for paid / partially-paid invoices
  const paidInvoices = await tx
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.bookingId, bookingId),
        inArray(invoices.status, ["paid", "partial"])
      )
    )
    .all();

  if (paidInvoices.length > 0) {
    return {
      canCancel: false,
      reason: "paid_invoice",
      message:
        "Booking ini sudah memiliki kuitansi pembayaran terverifikasi atau lunas sebagian. " +
        "Pembatalan langsung tidak diperbolehkan. " +
        "Silakan buat pengajuan refund atau pembatalan dengan persetujuan Direksi.",
    };
  }

  // Guard 2: check for verified payments on any invoice belonging to this booking
  const bookingInvoices = await tx
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.bookingId, bookingId))
    .all();

  const invoiceIds = bookingInvoices.map((r) => r.id);

  if (invoiceIds.length > 0) {
    const verifiedPayments = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          inArray(payments.invoiceId, invoiceIds),
          eq(payments.status, "verified")
        )
      )
      .all();

    if (verifiedPayments.length > 0) {
      return {
        canCancel: false,
        reason: "verified_payment",
        message:
          "Booking ini sudah memiliki kuitansi pembayaran terverifikasi. " +
          "Pembatalan langsung tidak diperbolehkan. " +
          "Silakan ajukan proses refund atau pembatalan melalui persetujuan Direksi.",
      };
    }
  }

  return { canCancel: true };
}
