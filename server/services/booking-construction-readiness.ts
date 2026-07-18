import { db } from "@/db";
import { invoices } from "@/db/schema/finance";
import { bookings, customerDocuments } from "@/db/schema/marketing";
import { eq } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { requiresFullSettlementBeforeConstruction } from "@/lib/booking-payment-gates";

// The construction gate is called from both Marketing and Production actions.
// It accepts either the database connection or an existing transaction so the
// caller can keep its own state mutation atomic.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbExecutor = typeof db | PgTransaction<any, any, any>;

export interface CashConstructionReadiness {
  eligible: boolean;
  reason: string;
}

export interface CashPemberkasanReadiness {
  eligible: boolean;
  reason: string;
}

/**
 * Gate before a Cash booking may move from "Booking & Pemberkasan" to
 * "Pelunasan Cash". It deliberately does not require the settlement invoice
 * to be paid: that payment is the next step, not a prerequisite for itself.
 */
export async function getCashPemberkasanReadiness(
  executor: DbExecutor,
  bookingId: string
): Promise<CashPemberkasanReadiness> {
  const booking = await executor
    .select({ paymentScheme: bookings.paymentScheme })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .get();

  if (!booking) {
    return { eligible: false, reason: "Booking tidak ditemukan." };
  }

  if (booking.paymentScheme === "kpr") {
    return { eligible: true, reason: "Skema KPR memiliki gate dokumen dan persetujuan tersendiri." };
  }

  const bookingInvoices = await executor
    .select({ type: invoices.type, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.bookingId, bookingId))
    .all();

  const bookingFee = bookingInvoices.find((invoice) => invoice.type === "booking_fee");
  if (!bookingFee || bookingFee.status !== "paid") {
    return {
      eligible: false,
      reason: "Booking Fee harus lunas dan terverifikasi sebelum pembayaran lanjutan dapat diproses.",
    };
  }

  const downPayment = bookingInvoices.find((invoice) => invoice.type === "dp");
  if (downPayment && downPayment.status !== "paid") {
    return {
      eligible: false,
      reason: "Uang Muka (DP) harus lunas dan terverifikasi sebelum pembayaran lanjutan dapat diproses.",
    };
  }

  const documents = await executor
    .select({ documentType: customerDocuments.documentType, status: customerDocuments.status })
    .from(customerDocuments)
    .where(eq(customerDocuments.bookingId, bookingId))
    .all();

  const missingDocuments = ["ktp", "kk"].filter(
    (documentType) => !documents.some(
      (document) => document.documentType === documentType && document.status === "verified"
    )
  );

  if (missingDocuments.length > 0) {
    const labels: Record<string, string> = { ktp: "KTP", kk: "Kartu Keluarga" };
    return {
      eligible: false,
      reason: `Pemberkasan pembelian non-KPR belum lengkap. Dokumen berikut harus diunggah dan diverifikasi: ${missingDocuments.map((type) => labels[type]).join(", ")}.`,
    };
  }

  return {
    eligible: true,
    reason: "Booking Fee, DP, serta dokumen wajib pembelian non-KPR telah terverifikasi.",
  };
}

/**
 * Cash full-payment units may enter construction only after all invoices are
 * paid. Cash Bertahap may enter after BF, DP, and required identity documents;
 * its remaining termins are enforced before Akad / PPJB. KPR keeps its own
 * existing approval gate.
 */
export async function getCashConstructionReadiness(
  executor: DbExecutor,
  bookingId: string
): Promise<CashConstructionReadiness> {
  const pemberkasanReadiness = await getCashPemberkasanReadiness(executor, bookingId);
  if (!pemberkasanReadiness.eligible) return pemberkasanReadiness;

  const booking = await executor
    .select({ paymentScheme: bookings.paymentScheme })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .get();

  // KPR and Cash Bertahap retain their own later-stage rules. Only full-Cash
  // requires Pelunasan Cash before a consumer construction SPK can begin.
  if (!booking || !requiresFullSettlementBeforeConstruction(booking.paymentScheme)) {
    return pemberkasanReadiness;
  }

  const bookingInvoices = await executor
    .select({ status: invoices.status })
    .from(invoices)
    .where(eq(invoices.bookingId, bookingId))
    .all();

  const payableInvoices = bookingInvoices.filter((invoice) => invoice.status !== "cancelled");
  if (payableInvoices.length === 0 || payableInvoices.some((invoice) => invoice.status !== "paid")) {
    return {
      eligible: false,
      reason: "Seluruh invoice Cash, termasuk Pelunasan Cash, harus lunas dan terverifikasi sebelum pembangunan dimulai.",
    };
  }

  return {
    eligible: true,
    reason: "Pembayaran Cash dan pemberkasan konsumen telah lengkap.",
  };
}
