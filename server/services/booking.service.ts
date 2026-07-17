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

/** Payment scheme accepted by the invoice schedule generator. */
export type PaymentScheme = "cash" | "installment" | "kpr";

/**
 * Stable schedule identity for a generated invoice component (Req 1.14, 1.17).
 * Used for idempotent duplicate detection independent of `type` + `dueDate`.
 */
export type InvoiceScheduleKind = "booking_fee" | "dp" | "cash_settlement" | "installment";

/**
 * Raw `invoices.type` value for a component. The actual schema only supports
 * booking_fee/dp/installment/other, so cash settlement + termin both map to
 * "installment" while their domain meaning is preserved via `kind`/`label`.
 */
export type InvoiceComponentType = "booking_fee" | "dp" | "installment";

/**
 * One component of a computed invoice schedule. Never has `amount === 0`
 * (zero-amount components are skipped, per Req 1.1).
 */
export interface InvoiceScheduleComponent {
  /** Stable schedule identity (Req 1.14). */
  kind: InvoiceScheduleKind;
  /** Raw `invoices.type` to persist (Req 1.7). */
  type: InvoiceComponentType;
  /** Positive amount, rounded to Rp 0.01 precision. */
  amount: number;
  /** Termin sequence (1..N) for installment kind, otherwise null. */
  seq: number | null;
  /** Due date derived from bookingDate. */
  dueDate: Date;
  /** Domain label, e.g. "Booking Fee", "Pelunasan Cash", "Termin 1". */
  label: string;
}

// ---------------------------------------------------------------------------
// Pure helpers (no DB access) — property-testable
// ---------------------------------------------------------------------------

/** Round to Rp 0.01 precision (2 decimal places), avoiding binary FP drift. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Return a new Date `days` calendar days after `base` (does not mutate `base`). */
function addDays(base: Date, days: number): Date {
  const result = new Date(base.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

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

// ---------------------------------------------------------------------------
// Pure function — computeInvoiceSchedule (Req 1.1–1.6, 1.15)
// ---------------------------------------------------------------------------

/**
 * Compute the full invoice schedule for a booking (PURE — no DB access).
 *
 * Rules (Req 1.1–1.6, 1.15):
 * - Guards: bookingFee >= 0, dpAmount >= 0, bookingFee + dpAmount <= unitPrice.
 *   installment ⇒ termin != null && 1 <= termin <= 120. Any guard failure throws
 *   (no partial schedule is returned).
 * - remaining = round2(unitPrice - bookingFee - dpAmount).
 * - Zero-skip: only components with amount > 0 are emitted; a schedule NEVER
 *   contains a component with amount === 0.
 * - cash: BF (due = bookingDate), DP (due = +14d), and, when remaining > 0, a
 *   "cash_settlement" component (type "installment", label "Pelunasan Cash",
 *   due = +30d).
 * - installment: BF, DP, then N termin. base = floor((remaining / termin) * 100) / 100;
 *   the last termin absorbs the rounding remainder. Each termin has seq = i,
 *   label "Termin i", due = bookingDate + 30*i days. Emitted only when remaining > 0.
 * - kpr: only BF/DP components.
 *
 * @throws Error when a guard fails (Indonesian message, per Req 1.5/1.15).
 */
export function computeInvoiceSchedule(
  unitPrice: number,
  bookingFee: number,
  dpAmount: number,
  scheme: PaymentScheme,
  termin: number | null,
  bookingDate: Date
): InvoiceScheduleComponent[] {
  // --- Guards (Req 1.5) --------------------------------------------------
  if (bookingFee < 0 || dpAmount < 0) {
    throw new Error("Booking Fee dan DP tidak boleh bernilai negatif.");
  }
  if (round2(bookingFee + dpAmount) > round2(unitPrice)) {
    throw new Error(
      "Total Booking Fee dan DP tidak boleh melebihi harga unit."
    );
  }

  // --- Guard: installment requires a valid termin (Req 1.15) -------------
  if (scheme === "installment") {
    if (termin == null || termin < 1 || termin > 120) {
      throw new Error(
        "Jumlah termin wajib diisi minimal 1 (maksimal 120) untuk skema installment."
      );
    }
  }

  const remaining = round2(unitPrice - bookingFee - dpAmount);
  const components: InvoiceScheduleComponent[] = [];

  // Booking Fee (due today) — Req 1.4
  if (bookingFee > 0) {
    components.push({
      kind: "booking_fee",
      type: "booking_fee",
      amount: round2(bookingFee),
      seq: null,
      dueDate: bookingDate,
      label: "Booking Fee",
    });
  }

  // DP (due bookingDate + 14 days) — Req 1.4
  if (dpAmount > 0) {
    components.push({
      kind: "dp",
      type: "dp",
      amount: round2(dpAmount),
      seq: null,
      dueDate: addDays(bookingDate, 14),
      label: "Uang Muka (DP)",
    });
  }

  if (scheme === "cash") {
    // Pelunasan Cash (due bookingDate + 30 days) — Req 1.1, 1.4, 1.7
    if (remaining > 0) {
      components.push({
        kind: "cash_settlement",
        type: "installment",
        amount: remaining,
        seq: null,
        dueDate: addDays(bookingDate, 30),
        label: "Pelunasan Cash",
      });
    }
  } else if (scheme === "installment") {
    // N termin — Req 1.2, 1.3. termin is guaranteed non-null/valid above.
    const n = termin as number;
    if (remaining > 0) {
      const base = Math.floor((remaining / n) * 100) / 100;
      for (let i = 1; i <= n; i++) {
        const amount =
          i < n ? base : round2(remaining - base * (n - 1));
        // Zero-skip: never emit a Rp 0 component (Req 1.1).
        if (amount > 0) {
          components.push({
            kind: "installment",
            type: "installment",
            amount,
            seq: i,
            dueDate: addDays(bookingDate, 30 * i),
            label: `Termin ${i}`,
          });
        }
      }
    }
  }
  // scheme === "kpr": only BF/DP components (no settlement/termin).

  return components;
}

// ---------------------------------------------------------------------------
// Pure function — computeOutstanding (Req 2.1)
// ---------------------------------------------------------------------------

/** Minimal shape needed to sum verified, non-voided payments. */
export interface PaymentLike {
  amount: number;
  status?: "pending" | "verified" | "rejected" | "voided";
}

/**
 * Compute invoice outstanding (PURE — no DB access), per Req 2.1:
 *
 *   outstanding = max(0, invoiceAmount - sum(verified, non-voided payment amounts))
 *
 * `verifiedNonVoidPayments` may be either:
 * - a pre-summed number (caller already summed verified/non-voided amounts), or
 * - an array of payment-like objects. When items carry a `status`, only
 *   "verified" payments contribute (pending/rejected/voided are excluded); when
 *   items omit `status`, they are treated as already filtered and counted.
 *
 * Result is never negative and is rounded to Rp 0.01 precision.
 */
export function computeOutstanding(
  invoiceAmount: number,
  verifiedNonVoidPayments: number | PaymentLike[]
): number {
  let paidTotal: number;
  if (typeof verifiedNonVoidPayments === "number") {
    paidTotal = verifiedNonVoidPayments;
  } else {
    paidTotal = verifiedNonVoidPayments.reduce((sum, p) => {
      // Exclude voided/pending/rejected; count only "verified" when status known.
      if (p.status !== undefined && p.status !== "verified") return sum;
      return sum + p.amount;
    }, 0);
  }

  const outstanding = round2(invoiceAmount - paidTotal);
  return outstanding > 0 ? outstanding : 0;
}

// ---------------------------------------------------------------------------
// Pure function — computeInvoiceStatus (Req 2.3, 2.4, 2.5)
// ---------------------------------------------------------------------------

/** Invoice payment status derived from paid total vs invoice amount. */
export type InvoicePaymentStatus = "unpaid" | "partial" | "paid";

/**
 * Map paid total → invoice status (PURE — no DB access), per Req 2.3–2.5:
 * - "paid"    when paidTotal >= invoiceAmount
 * - "partial" when 0 < paidTotal < invoiceAmount
 * - "unpaid"  when paidTotal === 0
 */
export function computeInvoiceStatus(
  paidTotal: number,
  invoiceAmount: number
): InvoicePaymentStatus {
  if (paidTotal >= invoiceAmount) return "paid";
  if (paidTotal > 0) return "partial";
  return "unpaid";
}

// ---------------------------------------------------------------------------
// Persistence wrapper — generateInvoiceSchedule (Req 1.1, 1.2, 1.6, 1.9, 1.14, 1.16)
// ---------------------------------------------------------------------------

/**
 * Generate an invoice number using the same pattern as `createInvoice` in finance.ts.
 * Format: INV-YYYYMMDD-XXXXXX (6 random hex uppercase chars).
 */
function generateInvoiceNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `INV-${dateStr}-${rand}`;
}

/**
 * Persist a computed invoice schedule to the `invoices` table (Req 1.14, 1.16).
 *
 * This is the persistence wrapper around `computeInvoiceSchedule`. It:
 * 1. Computes the full schedule (pure — throws on guard failure).
 * 2. Queries existing invoices for this booking to detect duplicates via
 *    stable schedule identity (scheduleKind + scheduleSequence).
 * 3. For each component, either inserts a new invoice or updates an existing
 *    unpaid invoice if the amount has changed (idempotent upsert).
 * 4. Paid/partial invoices are never modified — caller handles rejection logic.
 *
 * All operations use the passed `tx` for atomicity within the caller's transaction.
 *
 * @param tx       Active Drizzle transaction (or the global `db` instance).
 * @param booking  Booking data needed for schedule computation and invoice linking.
 * @param unit     Unit data (price) for schedule computation.
 * @param actorId  The user performing the operation (for audit/tracing; not used here but available).
 */
export async function generateInvoiceSchedule(
  tx: typeof db,
  booking: {
    id: string;
    bookingFee: number;
    dpAmount: number;
    paymentScheme: PaymentScheme;
    termin: number | null;
    bookingDate: Date;
    projectId: string;
    unitId: string;
    customerId: string;
  },
  unit: { price: number },
  actorId: string
): Promise<void> {
  // 1. Compute schedule (pure — throws on guard failure)
  const components = computeInvoiceSchedule(
    unit.price,
    booking.bookingFee,
    booking.dpAmount,
    booking.paymentScheme,
    booking.termin,
    booking.bookingDate
  );

  // 2. Query existing invoices for this booking by schedule identity
  const existing = await tx
    .select({
      id: invoices.id,
      scheduleKind: invoices.scheduleKind,
      scheduleSequence: invoices.scheduleSequence,
      status: invoices.status,
      amount: invoices.amount,
    })
    .from(invoices)
    .where(eq(invoices.bookingId, booking.id));

  // 3. For each component, upsert by schedule identity (kind + seq)
  for (const comp of components) {
    const match = existing.find(
      (e) => e.scheduleKind === comp.kind && e.scheduleSequence === comp.seq
    );

    if (!match) {
      // INSERT new invoice
      await tx.insert(invoices).values({
        id: crypto.randomUUID(),
        invoiceNumber: generateInvoiceNumber(),
        projectId: booking.projectId,
        unitId: booking.unitId,
        customerId: booking.customerId,
        bookingId: booking.id,
        type: comp.type,
        amount: comp.amount,
        dueDate: comp.dueDate,
        status: "unpaid",
        scheduleKind: comp.kind,
        scheduleSequence: comp.seq,
        scheduleLabel: comp.label,
      });
    } else if (match.status === "unpaid") {
      // UPDATE if amount changed (idempotent — only touch unpaid invoices)
      if (match.amount !== comp.amount) {
        await tx
          .update(invoices)
          .set({
            amount: comp.amount,
            dueDate: comp.dueDate,
            scheduleLabel: comp.label,
          })
          .where(eq(invoices.id, match.id));
      }
    }
    // paid/partial: skip (do not modify) — caller handles rejection logic
  }
}
