import { db } from "@/db";
import { bookings, customerDocuments, kprProcesses } from "@/db/schema/marketing";
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
export async function getBookingAkadReadiness(
  bookingId: string,
  expectedBookingStatus: "active" | "akad" = "active"
): Promise<BookingAkadReadiness> {
  const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking) {
    return { eligible: false, reason: "Booking tidak ditemukan." };
  }

  if (booking.status !== expectedBookingStatus) {
    return {
      eligible: false,
      reason: expectedBookingStatus === "active"
        ? "Hanya booking aktif yang bisa diproses ke Akad / PPJB."
        : "Hanya booking yang sedang berstatus Akad / PPJB yang dapat diselesaikan ke tahap serah terima.",
    };
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

  // Cash dan Cash Bertahap tidak membutuhkan dokumen bank. KTP serta KK harus
  // sudah diverifikasi pada booking yang sama sebelum Akad / PPJB dilanjutkan.
  const identityDocuments = await db
    .select({ documentType: customerDocuments.documentType, status: customerDocuments.status })
    .from(customerDocuments)
    .where(eq(customerDocuments.bookingId, bookingId))
    .all();
  const missingIdentityDocuments = ["ktp", "kk"].filter(
    (documentType) => !identityDocuments.some(
      (document) => document.documentType === documentType && document.status === "verified"
    )
  );
  if (missingIdentityDocuments.length > 0) {
    const labels: Record<string, string> = { ktp: "KTP", kk: "Kartu Keluarga" };
    return {
      eligible: false,
      reason: `Dokumen identitas belum terverifikasi: ${missingIdentityDocuments.map((type) => labels[type]).join(", ")}.`,
    };
  }

  // Menyelesaikan Akad / PPJB berarti dokumen PPJB yang telah ditandatangani
  // sudah tersedia dan lolos verifikasi. Gate ini tidak berlaku saat baru
  // memulai proses akad, karena dokumen baru dapat diunggah setelah akad
  // ditandatangani.
  if (expectedBookingStatus === "akad") {
    const ppjbDocument = identityDocuments.find(
      (document) => document.documentType === "spjb"
    );
    if (!ppjbDocument || ppjbDocument.status !== "verified") {
      return {
        eligible: false,
        reason: "Dokumen Akad / PPJB yang telah ditandatangani belum diunggah dan diverifikasi.",
      };
    }
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

  // Progress 100% adalah pernyataan vendor/lapangan, bukan persetujuan
  // serah-terima fisik. completeConstruction() baru menetapkan isReadyStock
  // setelah BAST Vendor ke Developer tersedia dan diverifikasi.
  if (!unit.isReadyStock) {
    return {
      eligible: false,
      reason: "BAST Vendor ke Developer belum diverifikasi. Selesaikan verifikasi fisik unit terlebih dahulu.",
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
