import { db } from "@/db";
import { bookings as bookingsTable } from "@/db/schema/marketing";
import { projects as projectsTable, units as unitsTable, customers as customersTable } from "@/db/schema/master";
import { appSettings } from "@/db/schema/system";
import { user as userTable } from "@/db/schema/auth";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatDate, formatRupiah } from "@/lib/format-utils";
import { PrintButton } from "@/components/ui/print-button";
import { Badge } from "@/components/ui/badge";
import { FileText, MapPin, Phone, Mail, Award, CheckCircle2 } from "lucide-react";
import { getI18n } from "@/lib/i18n-server";

export const revalidate = 0;

interface PrintPageProps {
  params: Promise<{ id: string }>;
}

// Set <title> dari server → browser pakai ini sebagai nama file default saat Save PDF
export async function generateMetadata({ params }: PrintPageProps) {
  const { id } = await params;
  const row = await db
    .select({
      bookingNumber: bookingsTable.bookingNumber,
      customerName: customersTable.name,
    })
    .from(bookingsTable)
    .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
    .where(eq(bookingsTable.id, id))
    .then(r => r[0]);

  const safeCustomer = (row?.customerName || "Konsumen")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const filename = `Kuitansi-STTB_${row?.bookingNumber || id}_${safeCustomer}`;

  return { title: filename };
}

export default async function PrintBookingPage({ params }: PrintPageProps) {
  const { id } = await params;
  const { t } = await getI18n();

  // 1. Fetch booking information
  const booking = await db
    .select({
      id: bookingsTable.id,
      bookingNumber: bookingsTable.bookingNumber,
      bookingDate: bookingsTable.bookingDate,
      bookingFee: bookingsTable.bookingFee,
      dpAmount: bookingsTable.dpAmount,
      paymentScheme: bookingsTable.paymentScheme,
      status: bookingsTable.status,
      projectName: projectsTable.name,
      unitCode: unitsTable.code,
      unitPrice: unitsTable.price,
      landArea: unitsTable.landArea,
      buildingArea: unitsTable.buildingArea,
      cluster: unitsTable.cluster,
      typeName: unitsTable.typeName,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      customerAddress: customersTable.address,
      marketingName: userTable.name,
    })
    .from(bookingsTable)
    .leftJoin(projectsTable, eq(bookingsTable.projectId, projectsTable.id))
    .leftJoin(unitsTable, eq(bookingsTable.unitId, unitsTable.id))
    .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
    .leftJoin(userTable, eq(bookingsTable.marketingId, userTable.id))
    .where(eq(bookingsTable.id, id))
    .then((rows) => rows[0]);

  if (!booking) {
    notFound();
  }

  // 2. Fetch company settings for Kop Surat
  const settingsRows = await db.select().from(appSettings);
  const companyName = settingsRows.find((r) => r.key === "company_name")?.value || "PT. Denah Property Indonesia";
  const companyAddress = settingsRows.find((r) => r.key === "company_address")?.value || "Jl. Raya Cendana No. 12, Jakarta Selatan";
  const companyPhone = settingsRows.find((r) => r.key === "company_phone")?.value || "+62 812-3456-7890";
  const companyEmail = settingsRows.find((r) => r.key === "company_email")?.value || "info@denahproperty.com";

  const totalPaid = booking.bookingFee + booking.dpAmount;

  return (
    <div className="min-h-screen bg-[#F7F8F3]/60 print:bg-white pb-12 font-sans text-[#243028]">
      {/* Dynamic inline print styles to hide everything except print area */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide Next.js sidebar layout and header elements */
          aside, 
          header, 
          nav, 
          .no-print,
          button,
          [data-slot="sidebar-provider"],
          [data-slot="sidebar-trigger"] {
            display: none !important;
          }
          
          /* Full width and reset margins */
          body, main, html, .min-h-screen {
            background: white !important;
            color: black !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .flex-1 {
            padding: 0 !important;
            margin: 0 !important;
          }
          
          .print-area {
            border: none !important;
            box-shadow: none !important;
            padding: 20px !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          
          /* Keep text colors suitable for print */
          .print-text-dark {
            color: #000000 !important;
          }
        }
      `}} />

      {/* Standard print action header — title sudah di-set server via generateMetadata */}
      <PrintButton />

      {/* Invoice sheet view */}
      <div className="print-area max-w-4xl mx-auto mt-6 bg-white border border-[#D6DED2] rounded-3xl shadow-sage p-8 md:p-12 transition-all duration-300">
        
        {/* KOP SURAT (COMPANY HEADER) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b-2 border-[#4F6F52]/30 gap-6">
          <div className="space-y-1 md:flex-1">
            <h2 className="text-xl font-extrabold text-[#4F6F52] tracking-wide print-text-dark">
              {companyName}
            </h2>
            <div className="text-xs text-[#66736A] space-y-0.5 print-text-dark">
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#8FAF9A]" />
                {companyAddress}
              </p>
              <p className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-[#8FAF9A]" />
                WhatsApp: {companyPhone}
              </p>
              <p className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-[#8FAF9A]" />
                Email: {companyEmail}
              </p>
            </div>
          </div>
          
          <div className="bg-[#DDE8D8]/50 border border-[#8FAF9A]/30 rounded-2xl px-4 py-2 text-right shrink-0">
            <span className="text-[10px] font-bold text-[#4F6F52] uppercase tracking-wider block">{t("booking.print_doc_num")}</span>
            <span className="font-mono text-sm font-bold text-[#243028] print-text-dark">{booking.bookingNumber || "—"}</span>
          </div>
        </div>

        {/* INVOICE TITLE */}
        <div className="text-center my-8">
          <h1 className="text-2xl font-black text-[#243028] uppercase tracking-wider print-text-dark">
            {t("booking.print_sttb_title")}
          </h1>
          <p className="text-xs text-[#66736A] font-medium mt-1 print-text-dark">
            {t("booking.print_trans_date")}: <span className="font-mono">{formatDate(booking.bookingDate)}</span>
          </p>
        </div>

        {/* CORE INFORMATION GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          
          {/* DATA KONSUMEN */}
          <div className="border border-[#D6DED2] rounded-2xl p-5 bg-[#F7F8F3]/30">
            <h3 className="text-xs font-bold text-[#4F6F52] uppercase tracking-wider mb-3 border-b border-[#D6DED2]/60 pb-1.5 flex items-center gap-1.5 print-text-dark">
              <Award className="h-4 w-4" /> {t("booking.print_cust_detail")}
            </h3>
            <table className="w-full text-xs space-y-2">
              <tbody>
                <tr className="align-top">
                  <td className="w-24 font-semibold text-[#66736A] py-1">{t("booking.print_name")}</td>
                  <td className="w-3 text-[#A8B0AA] py-1">:</td>
                  <td className="font-bold text-[#243028] py-1 print-text-dark">{booking.customerName || "—"}</td>
                </tr>
                <tr className="align-top">
                  <td className="font-semibold text-[#66736A] py-1">{t("booking.print_phone")}</td>
                  <td className="text-[#A8B0AA] py-1">:</td>
                  <td className="font-mono py-1 print-text-dark">{booking.customerPhone || "—"}</td>
                </tr>
                <tr className="align-top">
                  <td className="font-semibold text-[#66736A] py-1">{t("booking.print_address")}</td>
                  <td className="text-[#A8B0AA] py-1">:</td>
                  <td className="text-[#66736A] py-1 leading-relaxed print-text-dark">{booking.customerAddress || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* DATA KAVLING */}
          <div className="border border-[#D6DED2] rounded-2xl p-5 bg-[#F7F8F3]/30">
            <h3 className="text-xs font-bold text-[#4F6F52] uppercase tracking-wider mb-3 border-b border-[#D6DED2]/60 pb-1.5 flex items-center gap-1.5 print-text-dark">
              <FileText className="h-4 w-4" /> {t("booking.print_unit_specs")}
            </h3>
            <table className="w-full text-xs space-y-2">
              <tbody>
                <tr className="align-top">
                  <td className="w-24 font-semibold text-[#66736A] py-1">{t("booking.print_housing")}</td>
                  <td className="w-3 text-[#A8B0AA] py-1">:</td>
                  <td className="font-bold text-[#243028] py-1 print-text-dark">{booking.projectName || "—"}</td>
                </tr>
                <tr className="align-top">
                  <td className="font-semibold text-[#66736A] py-1">{t("booking.print_lot_code")}</td>
                  <td className="text-[#A8B0AA] py-1">:</td>
                  <td className="py-1">
                    <span className="font-mono font-bold bg-[#DDE8D8]/60 text-[#4F6F52] border border-[#8FAF9A]/20 px-1.5 py-0.5 rounded text-[10px]">
                      {booking.unitCode || "—"}
                    </span>
                  </td>
                </tr>
                <tr className="align-top">
                  <td className="font-semibold text-[#66736A] py-1">{t("booking.print_cluster_type")}</td>
                  <td className="text-[#A8B0AA] py-1">:</td>
                  <td className="font-semibold text-[#66736A] py-1 print-text-dark">
                    {booking.cluster ? `${booking.cluster} / ` : ""} {booking.typeName || "—"}
                  </td>
                </tr>
                <tr className="align-top">
                  <td className="font-semibold text-[#66736A] py-1">{t("booking.print_lt_lb")}</td>
                  <td className="text-[#A8B0AA] py-1">:</td>
                  <td className="font-mono py-1 print-text-dark">{booking.landArea} m² / {booking.buildingArea} m²</td>
                </tr>
                <tr className="align-top">
                  <td className="font-semibold text-[#66736A] py-1">{t("booking.print_unit_price")}</td>
                  <td className="text-[#A8B0AA] py-1">:</td>
                  <td className="font-mono font-bold text-[#4F6F52] py-1 print-text-dark">{formatRupiah(booking.unitPrice)}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        {/* PAYMENT DETAILS SHEET */}
        <div className="border border-[#D6DED2] rounded-2xl overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
            <h3 className="text-xs font-bold text-[#4F6F52] uppercase tracking-wider print-text-dark">
              {t("booking.print_paid_detail")}
            </h3>
          </div>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-[#D6DED2] text-[#66736A] font-bold bg-[#F7F8F3]/20">
                <th className="py-2.5 px-5">{t("booking.print_comp")}</th>
                <th className="py-2.5 px-5 text-center">{t("booking.print_scheme")}</th>
                <th className="py-2.5 px-5 text-right">{t("booking.print_amount")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DED2]/60">
              <tr>
                <td className="py-3 px-5 font-semibold text-[#243028] print-text-dark">{t("booking.print_bf")}</td>
                <td className="py-3 px-5 text-center uppercase font-bold text-[#66736A]">{booking.paymentScheme || "—"}</td>
                <td className="py-3 px-5 text-right font-mono font-bold text-[#4F6F52] tabular-nums">{formatRupiah(booking.bookingFee)}</td>
              </tr>
              <tr>
                <td className="py-3 px-5 font-semibold text-[#243028] print-text-dark">{t("booking.print_dp")}</td>
                <td className="py-3 px-5 text-center uppercase font-bold text-[#66736A]">{booking.paymentScheme || "—"}</td>
                <td className="py-3 px-5 text-right font-mono font-bold text-[#4F6F52] tabular-nums">{formatRupiah(booking.dpAmount)}</td>
              </tr>
              <tr className="bg-[#DDE8D8]/20 font-bold text-sm">
                <td colSpan={2} className="py-3.5 px-5 text-[#4F6F52] print-text-dark">{t("booking.print_total_collected")}</td>
                <td className="py-3.5 px-5 text-right font-mono text-[#4F6F52] tabular-nums text-base">{formatRupiah(totalPaid)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* POLICY / TERMS AND CONDITIONS */}
        <div className="border border-[#D6DED2] rounded-2xl p-5 bg-[#F7F8F3]/20 text-[10px] text-[#66736A] space-y-2 mb-12 print-text-dark">
          <h4 className="font-bold text-[#243028] text-xs uppercase tracking-wider mb-1 print-text-dark">{t("booking.print_terms_title")}</h4>
          <ol className="list-decimal pl-4 space-y-1">
            <li>{t("booking.print_term_1", { company: companyName })}</li>
            <li>{t("booking.print_term_2")}</li>
            <li>{t("booking.print_term_3")}</li>
            <li>{t("booking.print_term_4", { scheme: booking.paymentScheme })}</li>
          </ol>
        </div>

        {/* SIGNATURES SECTION */}
        <div className="grid grid-cols-2 gap-12 text-center text-xs mt-16">
          <div className="space-y-16">
            <div className="space-y-1">
              <span className="text-[#66736A] block">{t("booking.print_sign_buyer")}</span>
              <span className="text-[10px] text-[#A8B0AA] italic">{t("booking.print_sign_note")}</span>
            </div>
            <div className="space-y-1">
              <div className="w-48 border-b border-dashed border-[#66736A] mx-auto" />
              <span className="font-bold text-[#243028] block print-text-dark">{booking.customerName || "—"}</span>
            </div>
          </div>

          <div className="space-y-16">
            <div className="space-y-1">
              <span className="text-[#66736A] block">{t("booking.print_sign_receiver")}</span>
              <span className="text-[10px] text-[#A8B0AA] italic">{t("booking.print_sign_note")}</span>
            </div>
            <div className="space-y-1">
              <div className="w-48 border-b border-dashed border-[#66736A] mx-auto" />
              <span className="font-bold text-[#243028] block print-text-dark">{booking.marketingName || "—"}</span>
            </div>
          </div>
        </div>

        {/* COMPLETED SUCCESS ICON IN SCREEN VIEW */}
        <div className="no-print mt-12 pt-6 border-t border-[#D6DED2]/40 flex items-center justify-center gap-2 text-xs text-[#4F6F52] font-semibold">
          <CheckCircle2 className="h-4 w-4 text-[#8FAF9A]" />
          <span>{t("booking.print_status_label")} <Badge variant="outline" className="bg-[#DDE8D8] text-[#4F6F52] border-[#8FAF9A]/30 uppercase font-bold text-[9px] rounded ml-1">{booking.status === "completed" ? t("booking.print_status_akad") : t("booking.print_status_active")}</Badge></span>
        </div>

      </div>
    </div>
  );
}
