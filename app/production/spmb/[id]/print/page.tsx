import { db } from "@/db";
import { spks, spmbs } from "@/db/schema/production";
import { projects as projectsTable, units as unitsTable, vendors as vendorsTable } from "@/db/schema/master";
import { appSettings } from "@/db/schema/system";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format-utils";
import { PrintButton } from "@/components/ui/print-button";
import { Badge } from "@/components/ui/badge";
import { FileText, MapPin, Phone, Mail, CheckCircle2 } from "lucide-react";
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
    .select({ spmbNumber: spmbs.spmbNumber, unitCode: unitsTable.code })
    .from(spmbs)
    .innerJoin(spks, eq(spmbs.spkId, spks.id))
    .leftJoin(unitsTable, eq(spks.unitId, unitsTable.id))
    .where(eq(spmbs.id, id))
    .then(r => r[0]);

  const safeUnit = (row?.unitCode || "Unit").replace(/[^a-zA-Z0-9]/g, "");
  return { title: `SPMB_${row?.spmbNumber || id}_${safeUnit}` };
}

export default async function PrintSpmbPage({ params }: Props) {
  await requireAuth();
  const { id } = await params;
  const { t } = await getI18n();

  // Fetch SPMB and related data
  const spmbData = await db
    .select({
      id: spmbs.id,
      spmbNumber: spmbs.spmbNumber,
      spkId: spmbs.spkId,
      issueDate: spmbs.issueDate,
      startWorkDate: spmbs.startWorkDate,
      targetEndDate: spmbs.targetEndDate,
      status: spmbs.status,
      notes: spmbs.notes,
      createdAt: spmbs.createdAt,
      spkNumber: spks.spkNumber,
      spkTitle: spks.title,
      rabAmount: spks.rabAmount,
      projectName: projectsTable.name,
      unitCode: unitsTable.code,
      vendorName: vendorsTable.name,
    })
    .from(spmbs)
    .innerJoin(spks, eq(spmbs.spkId, spks.id))
    .leftJoin(projectsTable, eq(spks.projectId, projectsTable.id))
    .leftJoin(unitsTable, eq(spks.unitId, unitsTable.id))
    .leftJoin(vendorsTable, eq(spks.vendorId, vendorsTable.id))
    .where(eq(spmbs.id, id))
    .then(r => r[0]);

  if (!spmbData) notFound();

  // Company settings
  const settingsRows = await db.select().from(appSettings);
  const companyName = settingsRows.find(r => r.key === "company_name")?.value || "PT. Denah Property Indonesia";
  const companyAddress = settingsRows.find(r => r.key === "company_address")?.value || "Jl. Raya Cendana No. 12, Jakarta Selatan";
  const companyPhone = settingsRows.find(r => r.key === "company_phone")?.value || "+62 812-3456-7890";
  const companyEmail = settingsRows.find(r => r.key === "company_email")?.value || "info@denahproperty.com";

  return (
    <div className="min-h-screen bg-muted/30/60 print:bg-card pb-12 font-sans text-foreground">
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

      <PrintButton label="Cetak Dokumen SPMB" />

      <div className="print-area max-w-5xl mx-auto mt-6 bg-card border border-border rounded-3xl shadow-sage p-8 md:p-12">
        <div className="space-y-8 bg-transparent">
          
          {/* KOP SURAT */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b-2 border-[#4F6F52]/30 print-border-dark gap-6">
            <div className="space-y-1 md:flex-1">
              <h1 className="text-xl font-extrabold text-primary tracking-wide print-text-dark">{companyName}</h1>
              <div className="text-xs text-muted-foreground space-y-0.5 print-text-dark">
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary/70" />
                  {companyAddress}
                </p>
                <p className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary/70" />
                  Telp: {companyPhone}
                </p>
                <p className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-primary/70" />
                  Email: {companyEmail}
                </p>
              </div>
            </div>
            
            <div className="bg-secondary/50 border border-primary/30 rounded-2xl px-4 py-2 text-right shrink-0">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">{t("production.print_doc_sys")}</span>
              <span className="font-mono text-sm font-bold text-foreground print-text-dark">SPMB-SLA</span>
            </div>
          </div>

          {/* JUDUL DOKUMEN */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black text-foreground uppercase tracking-wider print-text-dark">
              {t("production.print_spmb_title")}
            </h2>
            <p className="text-sm text-muted-foreground font-medium print-text-dark">
              {t("production.print_spmb_num")} <span className="font-mono font-bold text-foreground">{spmbData.spmbNumber}</span>
            </p>
          </div>

          {/* DESKRIPSI PEMBUKA */}
          <p className="text-sm leading-relaxed text-muted-foreground print-text-dark text-justify">
            {t("production.print_spmb_opening")} <strong className="text-foreground">{companyName}</strong>, {t("production.print_spmb_opening2")}
          </p>

          {/* DETAIL TABLE */}
          <div className="border border-border print-border-dark rounded-2xl overflow-hidden bg-muted/30/30">
            <table className="w-full text-sm text-left border-collapse">
              <tbody className="divide-y divide-[#D6DED2]/60">
                <tr>
                  <td className="w-[40%] bg-muted/30/70 font-bold p-3 text-muted-foreground print-text-dark border-r border-border/60 print-border-dark">{t("production.print_ref_spk")}</td>
                  <td className="p-3 text-foreground print-text-dark font-mono font-bold tabular-nums">{spmbData.spkNumber}</td>
                </tr>
                <tr>
                  <td className="bg-muted/30/70 font-bold p-3 text-muted-foreground print-text-dark border-r border-border/60 print-border-dark">{t("production.print_spk_job_title")}</td>
                  <td className="p-3 text-foreground print-text-dark">{spmbData.spkTitle}</td>
                </tr>
                <tr>
                  <td className="bg-muted/30/70 font-bold p-3 text-muted-foreground print-text-dark border-r border-border/60 print-border-dark">{t("production.print_proj_kav")}</td>
                  <td className="p-3 text-foreground print-text-dark font-bold">
                    {spmbData.projectName || "—"} &mdash; Blok {spmbData.unitCode || "—"}
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30/70 font-bold p-3 text-muted-foreground print-text-dark border-r border-border/60 print-border-dark">{t("production.print_contractor")}</td>
                  <td className="p-3 text-foreground print-text-dark font-bold">{spmbData.vendorName || "—"}</td>
                </tr>
                <tr>
                  <td className="bg-muted/30/70 font-bold p-3 text-muted-foreground print-text-dark border-r border-border/60 print-border-dark">{t("production.print_contract_val")}</td>
                  <td className="p-3 text-primary print-text-dark font-mono font-bold tabular-nums">
                    Rp {spmbData.rabAmount ? spmbData.rabAmount.toLocaleString("id-ID") : "-"}
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30/70 font-bold p-3 text-muted-foreground print-text-dark border-r border-border/60 print-border-dark">{t("production.print_issue_date")}</td>
                  <td className="p-3 text-foreground print-text-dark font-mono">{formatDate(spmbData.issueDate)}</td>
                </tr>
                <tr>
                  <td className="bg-muted/30/70 font-bold p-3 text-muted-foreground print-text-dark border-r border-border/60 print-border-dark">{t("production.print_start_work")}</td>
                  <td className="p-3 text-foreground print-text-dark font-mono font-bold">{formatDate(spmbData.startWorkDate)}</td>
                </tr>
                <tr>
                  <td className="bg-secondary/50 font-bold p-3 text-primary print-text-dark border-r border-border/60 print-border-dark">{t("production.print_deadline")}</td>
                  <td className="p-3 text-destructive print-text-dark font-mono font-bold">{formatDate(spmbData.targetEndDate)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* INSTRUKSI TAMBAHAN */}
          <div className="border border-border rounded-2xl p-5 bg-muted/30/20 text-xs text-muted-foreground space-y-2 print-text-dark">
            <h4 className="font-bold text-foreground text-xs uppercase tracking-wider mb-1 print-text-dark flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary/70" /> {t("production.print_instructions")}
            </h4>
            <div className="whitespace-pre-line pl-5 leading-relaxed text-sm">
              {spmbData.notes || "1. Pelaksana wajib melaporkan progres fisik mingguan minimal sebesar 10% bobot.\n2. Wajib menggunakan material standard SNI sesuai dokumen spesifikasi teknis SPK.\n3. Menjaga kebersihan dan ketertiban area kavling konstruksi selama masa pembangunan."}
            </div>
          </div>

          {/* PENUTUP */}
          <p className="text-sm leading-relaxed text-muted-foreground print-text-dark">
            {t("production.print_closing")}
          </p>

          {/* TANDA TANGAN (SIGNATURE BLOCKS) */}
          <div className="grid grid-cols-2 gap-12 text-center text-sm mt-16">
            <div className="space-y-16">
              <div className="space-y-1">
                <span className="text-muted-foreground block">{t("production.print_assignor")}</span>
                <span className="font-bold text-foreground print-text-dark block">{companyName}</span>
              </div>
              <div className="space-y-1">
                <div className="w-48 border-b border-dashed border-[#66736A] mx-auto print-border-dark" />
                <span className="text-xs text-muted-foreground print-text-dark block">{t("production.print_dir_ops")}</span>
              </div>
            </div>
            <div className="space-y-16">
              <div className="space-y-1">
                <span className="text-muted-foreground block">{t("production.print_executor")}</span>
                <span className="font-bold text-foreground print-text-dark block">{spmbData.vendorName || "—"}</span>
              </div>
              <div className="space-y-1">
                <div className="w-48 border-b border-dashed border-[#66736A] mx-auto print-border-dark" />
                <span className="text-xs text-muted-foreground print-text-dark block">{t("production.print_pic")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SYSTEM STAMP */}
        <div className="no-print mt-12 pt-6 border-t border-border/40 flex justify-between items-center text-xs text-muted-foreground font-semibold">
          <span>{t("production.print_sys_valid")} <span className="font-mono">{new Date().toISOString()}</span></span>
          <Badge variant="outline" className="bg-secondary text-primary border-primary/30 uppercase font-bold text-[9px] rounded">{t("production.print_verified")}</Badge>
        </div>
      </div>
    </div>
  );
}
