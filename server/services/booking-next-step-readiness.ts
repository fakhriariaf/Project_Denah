import { db } from "@/db";
import { invoices } from "@/db/schema/finance";
import { bookings, customerDocuments } from "@/db/schema/marketing";
import { units } from "@/db/schema/master";
import { spks } from "@/db/schema/production";
import { and, eq } from "drizzle-orm";

export interface BookingGateCheck {
  key: string;
  label: string;
  passed: boolean;
}

export interface BookingNextStepReadiness {
  salesStatusLabel: string;
  physicalStatusLabel: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  checks: BookingGateCheck[];
}

const paid = (status?: string | null) => status === "paid";

/**
 * Read-only UX projection of the existing server-side gates. It does not
 * grant an action; every mutation must keep its own server validation.
 */
export async function getBookingNextStepReadiness(
  bookingId: string
): Promise<BookingNextStepReadiness> {
  const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking) throw new Error("Booking tidak ditemukan.");

  const unit = await db.select().from(units).where(eq(units.id, booking.unitId)).get();
  if (!unit) throw new Error("Unit booking tidak ditemukan.");

  const [bookingInvoices, documents] = await Promise.all([
    db.select({ type: invoices.type, status: invoices.status, scheduleKind: invoices.scheduleKind })
      .from(invoices)
      .where(eq(invoices.bookingId, bookingId)),
    db.select({ documentType: customerDocuments.documentType, status: customerDocuments.status })
      .from(customerDocuments)
      .where(eq(customerDocuments.bookingId, bookingId)),
  ]);

  const isReadyStock = Boolean(unit.isReadyStock) || unit.readyStockSource === "legacy_ready_stock" || unit.readyStockSource === "manual_ready_stock";

  // BAST Vendor→Developer readiness derived from real SPK state (mirrors the akad
  // gate). Ready-stock units are considered physically ready by definition.
  const progressComplete = (unit.constructionProgress ?? 0) >= 100;
  let bastVendorVerified = isReadyStock;
  if (!bastVendorVerified && unit.currentSpkId) {
    const spk = await db
      .select({ status: spks.status })
      .from(spks)
      .where(eq(spks.id, unit.currentSpkId))
      .get();
    // A SPK that reached "selesai_konstruksi" or "completed" means the vendor
    // handover (BAST Vendor) has been accepted by the developer.
    bastVendorVerified = Boolean(spk && (spk.status === "selesai_konstruksi" || spk.status === "completed"));
  }
  const physicalReady = isReadyStock || (progressComplete && bastVendorVerified);
  const physicalStatusLabel = unit.status === "handover_complete"
    ? "Serah Terima Selesai"
    : unit.status === "menunggu_serah_terima"
      ? "Siap Serah Terima"
      : isReadyStock
        ? "Tersedia Siap Huni"
        : unit.status === "construction" || unit.status === "overdue"
          ? `Pembangunan ${unit.constructionProgress ?? 0}%`
          : "Belum Dimulai";
  const salesStatusLabel = booking.status === "completed"
    ? "Menunggu Serah Terima"
    : booking.status === "akad"
      ? "Akad / PPJB"
      : booking.paymentScheme === "kpr"
        ? "Proses KPR"
        : "Booking & Pemberkasan";

  const bfPaid = paid(bookingInvoices.find((invoice) => invoice.type === "booking_fee")?.status);
  const dpInvoice = bookingInvoices.find((invoice) => invoice.type === "dp");
  const dpPaid = !dpInvoice || paid(dpInvoice.status);
  const ktpVerified = documents.some((document) => document.documentType === "ktp" && document.status === "verified");
  const kkVerified = documents.some((document) => document.documentType === "kk" && document.status === "verified");
  const ppjbVerified = documents.some((document) => document.documentType === "spjb" && document.status === "verified");
  const bastCustomerVerified = documents.some((document) => document.documentType === "bast" && document.status === "verified");

  if (booking.status === "cancelled") {
    return { salesStatusLabel: "Booking Dibatalkan", physicalStatusLabel, title: "Booking telah dibatalkan", description: "Tidak ada tindakan lanjutan yang dapat dilakukan pada booking ini.", actionLabel: "Kembali ke Daftar Booking", href: "/marketing/bookings", checks: [] };
  }
  if (unit.status === "handover_complete") {
    return { salesStatusLabel: "Serah Terima Selesai", physicalStatusLabel, title: "Serah terima telah selesai", description: "Unit telah diserahkan kepada konsumen dan riwayatnya tetap tersedia.", actionLabel: "Lihat Riwayat Booking", href: `/marketing/bookings/${bookingId}#riwayat-status`, checks: [] };
  }
  if (booking.paymentScheme === "kpr") {
    const npwpVerified = documents.some((document) => document.documentType === "npwp" && document.status === "verified");
    const slipGajiVerified = documents.some((document) => document.documentType === "slip_gaji" && document.status === "verified");
    return {
      salesStatusLabel,
      physicalStatusLabel,
      title: "Lanjutkan Pipeline KPR",
      description: "Tahap KPR, persetujuan bank, dan kesiapan fisik divalidasi dari Pipeline KPR.",
      actionLabel: "Buka Pipeline KPR",
      href: "/marketing/kpr",
      checks: [
        { key: "bf", label: "Booking Fee terverifikasi", passed: bfPaid },
        { key: "ktp", label: "KTP terverifikasi", passed: ktpVerified },
        { key: "kk", label: "Kartu Keluarga terverifikasi", passed: kkVerified },
        { key: "npwp", label: "NPWP terverifikasi", passed: npwpVerified },
        { key: "slip_gaji", label: "Slip Gaji terverifikasi", passed: slipGajiVerified },
      ],
    };
  }

  const baseChecks = [
    { key: "bf", label: "Booking Fee terverifikasi", passed: bfPaid },
    { key: "dp", label: "Uang Muka (DP) terverifikasi", passed: dpPaid },
    { key: "ktp", label: "KTP terverifikasi", passed: ktpVerified },
    { key: "kk", label: "Kartu Keluarga terverifikasi", passed: kkVerified },
  ];
  if (baseChecks.some((check) => !check.passed)) {
    const needsDocuments = !ktpVerified || !kkVerified;
    return {
      salesStatusLabel,
      physicalStatusLabel,
      title: needsDocuments ? "Lengkapi dan verifikasi dokumen Cash" : "Tindak lanjuti pembayaran awal",
      description: "Booking tetap berada pada tahap Booking & Pemberkasan sampai seluruh syarat di bawah telah diverifikasi.",
      actionLabel: needsDocuments ? "Kelola Dokumen Konsumen" : "Lihat Rincian Pembayaran",
      href: needsDocuments ? `/marketing/bookings/${bookingId}#dokumen-konsumen` : `/marketing/bookings/${bookingId}#rincian-pembayaran`,
      checks: baseChecks,
    };
  }

  const payableInvoices = bookingInvoices.filter((invoice) => invoice.status !== "cancelled");
  const allInvoicesPaid = payableInvoices.length > 0 && payableInvoices.every((invoice) => paid(invoice.status));
  // Kebijakan Cash Bertahap: BF, DP, KTP, dan KK membuka pembangunan; seluruh
  // termin tetap wajib lunas sebelum Akad / PPJB. Cash penuh tetap menunggu
  // pelunasan sebelum SPK dapat dimulai.
  if (booking.paymentScheme === "cash" && !allInvoicesPaid) {
    const settlementPaid = paid(bookingInvoices.find((invoice) => invoice.scheduleKind === "cash_settlement")?.status);
    return {
      salesStatusLabel,
      physicalStatusLabel,
      title: booking.paymentScheme === "cash" ? "Selesaikan Pelunasan Cash" : "Tindak lanjuti Termin Pembayaran",
      description: "Pembangunan dan Akad / PPJB belum dapat dilanjutkan sebelum tagihan yang diwajibkan oleh skema pembayaran telah terverifikasi.",
      actionLabel: booking.paymentScheme === "cash" && !settlementPaid ? "Unggah Bukti Pelunasan Cash" : "Lihat Rincian Pembayaran",
      href: `/marketing/bookings/${bookingId}#rincian-pembayaran`,
      checks: [...baseChecks, { key: "invoice", label: booking.paymentScheme === "cash" ? "Pelunasan Cash terverifikasi" : "Seluruh termin terverifikasi", passed: allInvoicesPaid }],
    };
  }

  if (!isReadyStock) {
    return {
      salesStatusLabel,
      physicalStatusLabel,
      title: progressComplete ? "Verifikasi BAST Vendor ke Developer" : "Selesaikan pembangunan fisik unit",
      description: progressComplete
        ? "Vendor harus menyatakan pekerjaan selesai, kemudian BAST Vendor diunggah dan diverifikasi Developer."
        : booking.paymentScheme === "installment"
          ? "Pembayaran awal dan dokumen telah terverifikasi. Lanjutkan pekerjaan melalui SPK; seluruh termin tetap wajib lunas sebelum Akad / PPJB."
          : "Pelunasan telah terverifikasi. Lanjutkan pekerjaan melalui SPK sampai progres fisik mencapai 100%.",
      actionLabel: "Buka SPK Konstruksi",
      href: "/production?tab=spk",
      checks: [
        ...baseChecks,
        { key: "invoice", label: booking.paymentScheme === "installment" ? "Termin pembayaran dipantau sebelum Akad / PPJB" : "Pelunasan Cash terverifikasi", passed: booking.paymentScheme === "installment" || allInvoicesPaid },
        { key: "progress", label: "Progres fisik 100%", passed: progressComplete },
        { key: "bast_vendor", label: "BAST Vendor ke Developer diverifikasi", passed: bastVendorVerified },
      ],
    };
  }

  if (!allInvoicesPaid) {
    return {
      salesStatusLabel,
      physicalStatusLabel,
      title: "Selesaikan termin sebelum Akad / PPJB",
      description: "Pembangunan fisik telah siap, tetapi seluruh termin Cash Bertahap harus terverifikasi sebelum proses Akad / PPJB dimulai.",
      actionLabel: "Lihat Rincian Pembayaran",
      href: `/marketing/bookings/${bookingId}#rincian-pembayaran`,
      checks: [...baseChecks, { key: "invoice", label: "Seluruh termin terverifikasi", passed: allInvoicesPaid }, { key: "physical", label: "Fisik unit siap", passed: physicalReady }],
    };
  }

  if (booking.status === "active") {
    return { salesStatusLabel, physicalStatusLabel, title: "Tandai proses Akad / PPJB", description: "Pembayaran, dokumen identitas, dan kesiapan fisik telah memenuhi syarat untuk memulai Akad / PPJB.", actionLabel: "Buka Tahap Akad / PPJB", href: `/marketing/bookings/${bookingId}#tahap-akad`, checks: [...baseChecks, { key: "invoice", label: "Seluruh tagihan terverifikasi", passed: allInvoicesPaid }, { key: "physical", label: "Fisik unit siap", passed: physicalReady }] };
  }
  if (booking.status === "akad") {
    return { salesStatusLabel, physicalStatusLabel, title: "Unggah dan verifikasi dokumen PPJB", description: "Akad / PPJB baru dapat diselesaikan setelah dokumen yang telah ditandatangani diunggah dan diverifikasi.", actionLabel: "Kelola Dokumen Akad / PPJB", href: `/marketing/bookings/${bookingId}#dokumen-konsumen`, checks: [...baseChecks, { key: "ppjb", label: "Dokumen Akad / PPJB terverifikasi", passed: ppjbVerified }] };
  }
  return { salesStatusLabel, physicalStatusLabel, title: "Lengkapi BAST Developer ke Konsumen", description: "Cetak, tandatangani, unggah, lalu verifikasi BAST Konsumen untuk menuntaskan serah terima.", actionLabel: "Buka BAST Konsumen", href: `/marketing/bookings/${bookingId}#bast-developer-konsumen`, checks: [{ key: "bast_customer", label: "BAST Developer ke Konsumen terverifikasi", passed: bastCustomerVerified }] };
}
