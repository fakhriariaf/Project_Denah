import { db } from "@/db";
import { bookings, kprProcesses } from "@/db/schema/marketing";
import { invoices } from "@/db/schema/finance";
import { units } from "@/db/schema/master";
import { spks } from "@/db/schema/production";
import { eq } from "drizzle-orm";

export interface BookingAkadReadiness {
  eligible: boolean;
  reason: string;
}

const SPK_NOT_DONE_STATUSES = ["active", "proses_konstruksi", "overdue"];

/**
 * Central readiness check for the "Tandai Proses Akad" action on booking detail.
 *
 * This action is for non-KPR Akad/PPJB. KPR has its own akad gate in the KPR
 * pipeline because it depends on SP3K/bank approval.
 */
export async function getBookingAkadReadiness(bookingId: string): Promise<BookingAkadReadiness> {
  const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking) {
    return { eligible: false, reason: "Booking tidak ditemukan." };
  }

  if (booking.status !== "active") {
    return { eligible: false, reason: "Hanya booking aktif yang bisa diproses ke Akad / PPJB." };
  }

  if (booking.paymentScheme === "kpr") {
    const kpr = await db
      .select({ status: kprProcesses.status })
      .from(kprProcesses)
      .where(eq(kprProcesses.bookingId, bookingId))
      .get();

    return {
      eligible: false,
      reason: kpr
        ? "Akad KPR diproses dari Pipeline KPR setelah SP3K disetujui dan fisik unit siap."
        : "Booking KPR belum memiliki proses KPR. Gunakan Pipeline KPR untuk melanjutkan akad.",
    };
  }

  const bookingInvoices = await db
    .select({
      id: invoices.id,
      type: invoices.type,
      status: invoices.status,
    })
    .from(invoices)
    .where(eq(invoices.bookingId, bookingId))
    .all();

  if (bookingInvoices.length === 0) {
    return { eligible: false, reason: "Booking belum memiliki invoice yang bisa divalidasi." };
  }

  const bfInvoice = bookingInvoices.find((invoice) => invoice.type === "booking_fee");
  if (!bfInvoice || bfInvoice.status !== "paid") {
    return { eligible: false, reason: "Booking Fee belum lunas/diverifikasi oleh Keuangan." };
  }

  const dpInvoice = bookingInvoices.find((invoice) => invoice.type === "dp");
  if (dpInvoice && dpInvoice.status !== "paid") {
    return { eligible: false, reason: "Uang Muka (DP) belum lunas/diverifikasi oleh Keuangan." };
  }

  const allInvoicesPaid = bookingInvoices.every((invoice) => invoice.status === "paid");
  if (!allInvoicesPaid) {
    return { eligible: false, reason: "Seluruh invoice/tagihan booking harus lunas sebelum Akad / PPJB." };
  }

  const unit = await db.select().from(units).where(eq(units.id, booking.unitId)).get();
  if (!unit) {
    return { eligible: false, reason: "Unit booking tidak ditemukan." };
  }

  const isReadyStock =
    unit.isReadyStock ||
    unit.readyStockSource === "legacy_ready_stock" ||
    unit.readyStockSource === "manual_ready_stock";

  if (isReadyStock) {
    return { eligible: true, reason: "Siap diproses Akad / PPJB." };
  }

  if ((unit.constructionProgress ?? 0) < 100) {
    return {
      eligible: false,
      reason: "Pembangunan fisik unit belum 100%. Selesaikan progress produksi terlebih dahulu.",
    };
  }

  if (unit.currentSpkId) {
    const spk = await db
      .select({ status: spks.status })
      .from(spks)
      .where(eq(spks.id, unit.currentSpkId))
      .get();

    if (spk && SPK_NOT_DONE_STATUSES.includes(spk.status)) {
      return {
        eligible: false,
        reason: "SPK/vendor handover belum selesai. Selesaikan BAST Vendor terlebih dahulu.",
      };
    }
  }

  return { eligible: true, reason: "Siap diproses Akad / PPJB." };
}
