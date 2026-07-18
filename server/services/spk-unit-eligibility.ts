import { eq } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { invoices } from "@/db/schema/finance";
import { bookings, customerDocuments, kprProcesses } from "@/db/schema/marketing";
import { units } from "@/db/schema/master";
import { spks } from "@/db/schema/production";
import { getCashConstructionReadiness } from "@/server/services/booking-construction-readiness";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbExecutor = typeof db | PgTransaction<any, any, any>;

export interface SpkUnitEligibility {
  eligible: boolean;
  reason: string;
}

/**
 * Canonical gate for issuing a new construction SPK. The Production dropdown
 * and the create action both use this rule so UI filtering cannot drift from
 * server-side validation.
 */
export async function getSpkUnitEligibility(
  executor: DbExecutor,
  input: { unitId: string; projectId?: string },
): Promise<SpkUnitEligibility> {
  const unit = await executor
    .select({
      id: units.id,
      projectId: units.projectId,
      status: units.status,
      currentBookingId: units.currentBookingId,
      isReadyStock: units.isReadyStock,
      constructionProgress: units.constructionProgress,
    })
    .from(units)
    .where(eq(units.id, input.unitId))
    .get();

  if (!unit) return { eligible: false, reason: "Unit tidak ditemukan." };
  if (input.projectId && unit.projectId !== input.projectId) {
    return { eligible: false, reason: "Unit yang dipilih tidak berada pada proyek SPK." };
  }
  if (unit.isReadyStock) {
    return { eligible: false, reason: "Unit sudah Tersedia Siap Huni dan tidak dapat diterbitkan SPK pembangunan baru." };
  }

  const existingSpks = await executor
    .select({ status: spks.status })
    .from(spks)
    .where(eq(spks.unitId, unit.id))
    .all();
  if (existingSpks.some((spk) => !["completed", "cancelled"].includes(spk.status))) {
    return { eligible: false, reason: "Unit masih memiliki SPK yang belum selesai atau dibatalkan." };
  }

  // Developer builds a ready-stock unit before it is marketed or booked.
  if (unit.status === "belum_siap" && !unit.currentBookingId) {
    return { eligible: true, reason: "Unit internal siap dibangun untuk stok." };
  }

  if (!unit.currentBookingId) {
    return { eligible: false, reason: "Unit belum memiliki booking aktif. Gunakan status Belum Siap untuk pembangunan ready stock internal." };
  }
  if (!["booking", "kpr_process", "construction"].includes(unit.status)) {
    return { eligible: false, reason: "Status unit belum memenuhi syarat penerbitan SPK." };
  }
  if (unit.status === "construction" && (unit.constructionProgress ?? 0) > 0) {
    return { eligible: false, reason: "Progress fisik unit sudah berjalan. SPK baru tidak dapat diterbitkan untuk menghindari duplikasi pekerjaan." };
  }

  const booking = await executor
    .select({ id: bookings.id, status: bookings.status, paymentScheme: bookings.paymentScheme })
    .from(bookings)
    .where(eq(bookings.id, unit.currentBookingId))
    .get();
  if (!booking || booking.status !== "active") {
    return { eligible: false, reason: "Booking aktif untuk unit ini tidak ditemukan." };
  }

  if (booking.paymentScheme !== "kpr") {
    return getCashConstructionReadiness(executor, booking.id);
  }

  const [bookingInvoices, documents, kpr] = await Promise.all([
    executor.select({ type: invoices.type, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.bookingId, booking.id))
      .all(),
    executor.select({ documentType: customerDocuments.documentType, status: customerDocuments.status })
      .from(customerDocuments)
      .where(eq(customerDocuments.bookingId, booking.id))
      .all(),
    executor.select({ status: kprProcesses.status })
      .from(kprProcesses)
      .where(eq(kprProcesses.bookingId, booking.id))
      .get(),
  ]);

  const bookingFee = bookingInvoices.find((invoice) => invoice.type === "booking_fee");
  if (!bookingFee || bookingFee.status !== "paid") {
    return { eligible: false, reason: "Booking Fee harus lunas dan terverifikasi sebelum SPK unit KPR diterbitkan." };
  }
  const downPayment = bookingInvoices.find((invoice) => invoice.type === "dp");
  if (downPayment && downPayment.status !== "paid") {
    return { eligible: false, reason: "Uang Muka (DP) harus lunas dan terverifikasi sebelum SPK unit KPR diterbitkan." };
  }
  const missingDocuments = ["ktp", "kk", "npwp", "slip_gaji"].filter(
    (documentType) => !documents.some((document) => document.documentType === documentType && document.status === "verified"),
  );
  if (missingDocuments.length > 0) {
    return { eligible: false, reason: "Berkas KPR belum lengkap dan terverifikasi. KTP, Kartu Keluarga, NPWP, dan Slip Gaji wajib diverifikasi." };
  }
  if (!kpr || !["approved", "akad"].includes(kpr.status)) {
    return { eligible: false, reason: "SPK unit KPR hanya dapat diterbitkan setelah KPR disetujui bank (SP3K)." };
  }

  return { eligible: true, reason: "Booking Fee/DP, berkas KPR, dan persetujuan bank telah terpenuhi." };
}
