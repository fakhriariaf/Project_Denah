import { db } from "@/db";
import { bookings as bookingsTable } from "@/db/schema/marketing";
import { projects as projectsTable, units as unitsTable, customers as customersTable } from "@/db/schema/master";
import { user as userTable } from "@/db/schema/auth";
import { appSettings } from "@/db/schema/system";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatDate, formatRupiah } from "@/lib/format-utils";
import { PrintButton } from "@/components/ui/print-button";
import { FileText, MapPin, Phone, Mail, CheckCircle2, User, Calendar, ShieldCheck, Building } from "lucide-react";
import { requireAuth } from "@/server/permissions";
import { getI18n } from "@/lib/i18n-server";

export const revalidate = 0;

interface Props {
  params: Promise<{ id: string }>;
}

// Set <title> dari server → browser pakai ini sebagai nama file default saat Save PDF
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const row = await db
    .select({ bookingNumber: bookingsTable.bookingNumber, unitCode: unitsTable.code })
    .from(bookingsTable)
    .leftJoin(unitsTable, eq(bookingsTable.unitId, unitsTable.id))
    .where(eq(bookingsTable.id, id))
    .then(r => r[0]);

  const safeUnit = (row?.unitCode || "Unit").replace(/[^a-zA-Z0-9]/g, "");
  return { title: `BAST_KONSUMEN_${row?.bookingNumber || id}_${safeUnit}` };
}

export default async function PrintBastKonsumenPage({ params }: Props) {
  await requireAuth();
  const { id } = await params;
  const { t } = await getI18n();

  // Fetch booking and related data
  const booking = await db
    .select({
      id: bookingsTable.id,
      bookingNumber: bookingsTable.bookingNumber,
      bookingDate: bookingsTable.bookingDate,
      paymentScheme: bookingsTable.paymentScheme,
      status: bookingsTable.status,
      projectName: projectsTable.name,
      unitCode: unitsTable.code,
      unitStatus: unitsTable.status,
      landArea: unitsTable.landArea,
      buildingArea: unitsTable.buildingArea,
      price: unitsTable.price,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      marketingName: userTable.name,
    })
    .from(bookingsTable)
    .leftJoin(projectsTable, eq(bookingsTable.projectId, projectsTable.id))
    .leftJoin(unitsTable, eq(bookingsTable.unitId, unitsTable.id))
    .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
    .leftJoin(userTable, eq(bookingsTable.marketingId, userTable.id))
    .where(eq(bookingsTable.id, id))
    .then(r => r[0]);

  if (!booking) notFound();

  // Enforce BAST Developer to Consumer can only be printed if unit construction is finished/sold.
  // After completeConstruction(), unit status transitions to: sold, kpr_process, booking, or available
  // (never to construction_done which is an intermediate/legacy status).
  const statusStr = booking.unitStatus as string;
  const isValidStatus = [
    "construction_done",
    "sold",
    "menunggu_serah_terima",
    "handover_complete",
    "booking",
    "kpr_process",
    "available",
  ].includes(statusStr);
  if (!isValidStatus) {
    throw new Error("⚠️ Dokumen BAST Konsumen hanya dapat dicetak jika pembangunan unit fisik telah selesai 100% dari Vendor (Status unit minimal 'Selesai Bangun').");
  }

  // Company settings
  const settingsRows = await db.select().from(appSettings);
  const companyName = settingsRows.find(r => r.key === "company_name")?.value || "PT. Denah Property Indonesia";
  const companyAddress = settingsRows.find(r => r.key === "company_address")?.value || "Jl. Raya Cendana No. 12, Jakarta Selatan";
  const companyPhone = settingsRows.find(r => r.key === "company_phone")?.value || "+62 812-3456-7890";
  const companyEmail = settingsRows.find(r => r.key === "company_email")?.value || "info@denahproperty.com";

  return (
    <div className="min-h-screen bg-[#F7F8F3]/60 print:bg-white pb-12 font-sans text-[#243028]">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          aside, header, nav, .no-print, button,
          [data-slot="sidebar-provider"], [data-slot="sidebar-trigger"] {
            display: none !important;
          }
          body, main, html, .min-h-screen {
            background: white !important;
            color: black !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .flex-1 { padding: 0 !important; margin: 0 !important; }
          .print-area {
            border: none !important;
            box-shadow: none !important;
            padding: 20px !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          .print-text-dark { color: #000000 !important; }
          .print-border-dark { border-color: #000000 !important; }
        }
      `}} />

      {/* TOP HEADER CONTROLS */}
      <PrintButton label="Cetak BAST Konsumen" />

      {/* PRINT CONTAINER */}
      <div className="print-area max-w-4xl mx-auto mt-6 bg-white border border-[#D6DED2] rounded-3xl p-12 shadow-[0_8px_30px_rgb(143,175,154,0.06)] print:shadow-none print:border-none">
        
        {/* KOP SURAT DEVELOPER */}
        <div className="flex justify-between items-start border-b-2 border-[#4F6F52] pb-6 mb-8 print:border-black">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-black text-[#4F6F52] tracking-tight print:text-black">{companyName}</h2>
            <div className="text-xs text-[#66736A] space-y-0.5 font-medium print-text-dark">
              <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#8FAF9A]" /> {companyAddress}</p>
              <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-[#8FAF9A]" /> {companyPhone} &bull; <Mail className="h-3.5 w-3.5 text-[#8FAF9A]" /> {companyEmail}</p>
            </div>
          </div>
          <div className="text-right space-y-1">
            <span className="bg-[#DDE8D8] text-[#4F6F52] border border-[#8FAF9A]/30 uppercase font-black text-[10px] px-3 py-1 rounded-xl tracking-wider print:border-black print:text-black">
              BAST KONSUMEN
            </span>
            <p className="text-[10px] text-[#A8B0AA] font-mono pt-1">No. Booking: {booking.bookingNumber}</p>
          </div>
        </div>

        {/* JUDUL DOKUMEN */}
        <div className="text-center my-6 space-y-1">
          <h1 className="text-xl font-extrabold text-[#243028] uppercase tracking-wide print-text-dark">BERITA ACARA SERAH TERIMA UNIT</h1>
          <p className="text-sm text-[#66736A] print-text-dark">Nomor Referensi: BASTK/{booking.bookingNumber}</p>
        </div>

        <div className="space-y-6 text-sm text-[#243028] leading-relaxed print-text-dark">
          <p>
            Pada hari ini, <strong>{formatDate(new Date())}</strong>, bertempat di kantor pemasaran perumahan proyek <strong>{booking.projectName}</strong>, kami yang bertanda tangan di bawah ini:
          </p>

          {/* PIHAK PERTAMA & KEDUA */}
          <div className="space-y-4 pl-4 border-l-2 border-[#8FAF9A] print:border-black">
            <div>
              <p className="font-bold uppercase tracking-wider text-xs text-[#4F6F52] print:text-black">PIHAK PERTAMA (DEVELOPER)</p>
              <div className="grid grid-cols-3 gap-2 pl-4 pt-1">
                <span className="text-[#66736A]">Nama Perusahaan</span>
                <span className="col-span-2 font-semibold">: {companyName}</span>
                <span className="text-[#66736A]">Jabatan</span>
                <span className="col-span-2 font-semibold">: Direksi Pengembang / Pihak Pertama</span>
                <span className="text-[#66736A]">Alamat Kantor</span>
                <span className="col-span-2 font-semibold">: {companyAddress}</span>
              </div>
            </div>

            <div>
              <p className="font-bold uppercase tracking-wider text-xs text-[#4F6F52] print:text-black">PIHAK KEDUA (KONSUMEN / PEMBELI)</p>
              <div className="grid grid-cols-3 gap-2 pl-4 pt-1">
                <span className="text-[#66736A]">Nama Konsumen</span>
                <span className="col-span-2 font-semibold">: {booking.customerName || "—"}</span>
                <span className="text-[#66736A]">Nomor Kontak</span>
                <span className="col-span-2 font-semibold font-mono">: {booking.customerPhone || "—"}</span>
                <span className="text-[#66736A]">Nomor Booking</span>
                <span className="col-span-2 font-semibold font-mono">: {booking.bookingNumber}</span>
              </div>
            </div>
          </div>

          <p>
            Secara bersama-sama menerangkan bahwa PIHAK PERTAMA telah menyerahkan kepada PIHAK KEDUA, dan PIHAK KEDUA menyatakan telah menerima penyerahan fisik unit kavling properti dengan spesifikasi di bawah ini:
          </p>

          {/* DETAIL UNIT PROPERTI */}
          <div className="bg-[#F7F8F3]/50 border border-[#D6DED2] rounded-2xl p-5 print:border-black">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#4F6F52] mb-3 print:text-black flex items-center gap-1.5">
              <Building className="h-4 w-4 text-[#8FAF9A]" /> IDENTITAS DAN SPESIFIKASI UNIT HUNIAN
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between border-b border-dashed border-[#D6DED2] pb-1 print:border-black">
                  <span className="text-[#66736A]">Proyek Perumahan</span>
                  <span className="font-bold text-right">{booking.projectName}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-[#D6DED2] pb-1 print:border-black">
                  <span className="text-[#66736A]">Kode Kavling / Unit</span>
                  <span className="font-mono font-bold text-[#4F6F52] text-right print:text-black">{booking.unitCode}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between border-b border-dashed border-[#D6DED2] pb-1 print:border-black">
                  <span className="text-[#66736A]">Luas Tanah / Bangunan</span>
                  <span className="font-semibold text-right">{booking.landArea || 0} m² / {booking.buildingArea || 0} m²</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-[#D6DED2] pb-1 print:border-black">
                  <span className="text-[#66736A]">Nilai Investasi Unit</span>
                  <span className="font-mono font-bold text-[#4F6F52] text-right print:text-black">{formatRupiah(booking.price || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* PERNYATAAN LEGAL */}
          <div className="border border-[#D6DED2] rounded-2xl p-5 bg-[#F7F8F3]/20 text-xs text-[#66736A] space-y-3 print-text-dark">
            <h4 className="font-bold text-[#243028] text-xs uppercase tracking-wider mb-1 print-text-dark flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#8FAF9A]" /> PERSETUJUAN KLAUSUL SERAH TERIMA KUNCI
            </h4>
            <div className="pl-5 leading-relaxed text-sm text-justify space-y-2">
              <p>
                1. <strong>Penerimaan Unit Properti:</strong> PIHAK KEDUA menyatakan telah melakukan inspeksi fisik unit hunian secara teliti, serta menerima kunci fisik unit tersebut dari PIHAK PERTAMA dalam keadaan baik, rapi, dan sesuai dengan standar yang dijanjikan.
              </p>
              <p>
                2. <strong>Masa SLA Pemeliharaan Konsumen:</strong> Sejak dokumen BAST ini ditandatangani, berlaku masa jaminan pemeliharaan kerusakan non-struktural selama <strong>100 (seratus) hari kalender</strong>. Segala bentuk keluhan kualitas fisik wajib diajukan melalui sistem komplain resmi Developer.
              </p>
              <p>
                3. <strong>Peralihan Hak dan Kewajiban:</strong> Sejak serah terima kunci ini selesai, maka segala hak pemanfaatan hunian, biaya pemeliharaan harian (kebersihan, keamanan), dan kewajiban hukum unit properti resmi beralih sepenuhnya kepada PIHAK KEDUA.
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[#66736A] print-text-dark">
            Demikian Berita Acara Serah Terima (BAST) unit ini dibuat dalam rangkap 2 (dua) dengan kekuatan hukum yang sama bagi Pihak Pertama dan Pihak Kedua untuk dipergunakan secara sah.
          </p>

          {/* TANDA TANGAN */}
          <div className="grid grid-cols-2 gap-12 text-center text-sm mt-20">
            <div className="space-y-20">
              <div className="space-y-1">
                <span className="text-[#66736A] block">PIHAK KEDUA (KONSUMEN)</span>
                <span className="font-bold text-[#243028] print-text-dark block">{booking.customerName || "—"}</span>
              </div>
              <div className="space-y-1">
                <div className="w-48 border-b border-dashed border-[#66736A] mx-auto print-border-dark" />
                <span className="text-xs text-[#66736A] print-text-dark block">Konsumen Penerima</span>
              </div>
            </div>
            
            <div className="space-y-20">
              <div className="space-y-1">
                <span className="text-[#66736A] block">PIHAK PERTAMA (DEVELOPER)</span>
                <span className="font-bold text-[#243028] print-text-dark block">Direksi Pembangunan Proyek</span>
              </div>
              <div className="space-y-1">
                <div className="w-48 border-b border-dashed border-[#66736A] mx-auto print-border-dark" />
                <span className="text-xs text-[#66736A] print-text-dark block">Developer PT. Denah Property</span>
              </div>
            </div>
          </div>

          {/* ACKNOWLEDGED BY MARKETING PIC */}
          <div className="text-center text-sm mt-12 space-y-16">
            <div className="space-y-1">
              <span className="text-[#66736A] block">Mengetahui & Menyerahkan,</span>
              <span className="font-bold text-[#243028] print-text-dark block">{booking.marketingName || "Marketing Partner"}</span>
            </div>
            <div className="space-y-1">
              <div className="w-56 border-b border-dashed border-[#66736A] mx-auto print-border-dark" />
              <span className="text-xs text-[#66736A] print-text-dark block">Staff Marketing PIC</span>
            </div>
          </div>

        </div>

        {/* SYSTEM STAMP */}
        <div className="no-print mt-12 pt-6 border-t border-[#D6DED2]/40 flex justify-between items-center text-xs text-[#66736A] font-semibold">
          <span>Sistem Validasi BAST Konsumen &bull; Kode Booking: <span className="font-mono">{booking.bookingNumber}</span></span>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 uppercase font-bold text-[9px] px-2 py-0.5 rounded shadow-none">VERIFIED HANDOVER READY</span>
        </div>
      </div>
    </div>
  );
}
