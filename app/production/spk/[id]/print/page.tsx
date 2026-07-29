import { db } from "@/db";
import { spks, spkWorkItemWeights, spmbs } from "@/db/schema/production";
import { projects as projectsTable, units as unitsTable, vendors as vendorsTable } from "@/db/schema/master";
import { appSettings } from "@/db/schema/system";
import { user as userTable } from "@/db/schema/auth";
import { workItems } from "@/db/schema/production";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatDate, formatRupiah } from "@/lib/format-utils";
import { PrintButton } from "@/components/ui/print-button";
import { FileText, MapPin, Phone, Mail, CheckCircle2, Building, User, Wrench, Calendar, Hash } from "lucide-react";
import { requireAuth } from "@/server/permissions";
import { getI18n } from "@/lib/i18n-server";
import { getSpkStatusLabel } from "@/lib/label-helpers";

export const revalidate = 0;

interface Props {
  params: Promise<{ id: string }>;
}

// Set <title> dari server → browser pakai ini sebagai nama file default saat Save PDF
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const row = await db
    .select({ spkNumber: spks.spkNumber, unitCode: unitsTable.code })
    .from(spks)
    .leftJoin(unitsTable, eq(spks.unitId, unitsTable.id))
    .where(eq(spks.id, id))
    .then(r => r[0]);

  const safeUnit = (row?.unitCode || "Unit").replace(/[^a-zA-Z0-9]/g, "");
  return { title: `SPK_${row?.spkNumber || id}_${safeUnit}` };
}

export default async function PrintSpkPage({ params }: Props) {
  await requireAuth();
  const { id } = await params;
  const { t } = await getI18n();

  const spk = await db
    .select({
      id: spks.id,
      spkNumber: spks.spkNumber,
      title: spks.title,
      workDescription: spks.workDescription,
      rabAmount: spks.rabAmount,
      status: spks.status,
      startDate: spks.startDate,
      targetEndDate: spks.targetEndDate,
      actualEndDate: spks.actualEndDate,
      createdAt: spks.createdAt,
      projectName: projectsTable.name,
      unitCode: unitsTable.code,
      unitCluster: unitsTable.cluster,
      unitType: unitsTable.typeName,
      vendorName: vendorsTable.name,
      vendorPhone: vendorsTable.phone,
      createdByName: userTable.name,
    })
    .from(spks)
    .leftJoin(projectsTable, eq(spks.projectId, projectsTable.id))
    .leftJoin(unitsTable, eq(spks.unitId, unitsTable.id))
    .leftJoin(vendorsTable, eq(spks.vendorId, vendorsTable.id))
    .leftJoin(userTable, eq(spks.createdBy, userTable.id))
    .where(eq(spks.id, id))
    .then(r => r[0]);

  if (!spk) notFound();

  // Get work item weights
  const weights = await db
    .select({
      weightPct: spkWorkItemWeights.weightPct,
      workItemName: workItems.name,
      workItemCode: workItems.code,
    })
    .from(spkWorkItemWeights)
    .leftJoin(workItems, eq(spkWorkItemWeights.workItemId, workItems.id))
    .where(eq(spkWorkItemWeights.spkId, id))
    .orderBy(workItems.code);

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
        }
      `}} />

      <PrintButton label="Cetak Dokumen SPK" />

      <div className="print-area max-w-4xl mx-auto mt-6 bg-card border border-border rounded-3xl shadow-sage p-8 md:p-12">

        {/* KOP SURAT */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b-2 border-[#4F6F52]/30 gap-6">
          <div className="space-y-1 md:flex-1">
            <h2 className="text-xl font-extrabold text-primary tracking-wide">{companyName}</h2>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary/70" />{companyAddress}</p>
              <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-primary/70" />WhatsApp: {companyPhone}</p>
              <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-primary/70" />Email: {companyEmail}</p>
            </div>
          </div>
          <div className="bg-secondary/50 border border-primary/30 rounded-2xl px-4 py-2 text-right shrink-0">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">{t("production.print_spk_num")}</span>
            <span className="font-mono text-sm font-bold text-foreground">{spk.spkNumber}</span>
          </div>
        </div>

        {/* TITLE */}
        <div className="text-center my-8">
          <h1 className="text-2xl font-black text-foreground uppercase tracking-wider">
            {t("production.print_spk_title")}
          </h1>
          <p className="text-sm font-semibold text-primary mt-1">{spk.title}</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {t("production.print_issued")} {formatDate(spk.createdAt)} &nbsp;|&nbsp; {t("production.print_status")} <strong>{getSpkStatusLabel(spk.status)}</strong>
          </p>
        </div>

        {/* DETAIL GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

          {/* INFO UNIT */}
          <div className="border border-border rounded-2xl p-5 bg-muted/30/30">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 border-b border-border/60 pb-1.5 flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> {t("production.print_job_loc")}
            </h3>
            <table className="w-full text-xs">
              <tbody>
                {[
                  [t("production.print_project"), spk.projectName || "—"],
                  [t("production.print_unit_code"), spk.unitCode || "—"],
                  [t("production.print_cluster"), `${spk.unitCluster || ""} / ${spk.unitType || "—"}`],
                ].map(([k, v]) => (
                  <tr key={k} className="align-top">
                    <td className="w-24 font-semibold text-muted-foreground py-1">{k}</td>
                    <td className="w-3 text-muted-foreground/70 py-1">:</td>
                    <td className="font-bold text-foreground py-1">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* INFO VENDOR */}
          <div className="border border-border rounded-2xl p-5 bg-muted/30/30">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 border-b border-border/60 pb-1.5 flex items-center gap-1.5">
              <Building className="h-4 w-4" /> {t("production.print_contractor")}
            </h3>
            <table className="w-full text-xs">
              <tbody>
                {[
                  [t("production.print_company"), spk.vendorName || "—"],
                  [t("production.print_phone"), spk.vendorPhone || "—"],
                ].map(([k, v]) => (
                  <tr key={k} className="align-top">
                    <td className="w-24 font-semibold text-muted-foreground py-1">{k}</td>
                    <td className="w-3 text-muted-foreground/70 py-1">:</td>
                    <td className="font-mono text-foreground py-1">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TIMELINE */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="border border-border rounded-xl p-4 flex items-center gap-3">
            <Calendar className="h-4 w-4 text-primary/70 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">{t("production.print_start_date")}</p>
              <p className="font-mono font-bold text-foreground text-sm">{spk.startDate ? formatDate(spk.startDate) : "—"}</p>
            </div>
          </div>
          <div className="border border-border rounded-xl p-4 flex items-center gap-3">
            <Calendar className="h-4 w-4 text-rose-400 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">{t("production.print_end_date")}</p>
              <p className="font-mono font-bold text-foreground text-sm">{spk.targetEndDate ? formatDate(spk.targetEndDate) : "—"}</p>
            </div>
          </div>
        </div>

        {/* URAIAN PEKERJAAN */}
        <div className="border border-border rounded-2xl p-5 mb-8">
          <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Wrench className="h-4 w-4" /> {t("production.print_job_desc")}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{spk.workDescription}</p>
        </div>

        {/* BOBOT ITEM PEKERJAAN */}
        {weights.length > 0 && (
          <div className="border border-border rounded-2xl overflow-hidden mb-8">
            <div className="px-5 py-3 border-b border-border bg-muted/30/70">
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider">{t("production.print_weight_title")}</h3>
            </div>
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-bold bg-muted/30/30">
                  <th className="py-2.5 px-5">{t("production.print_code")}</th>
                  <th className="py-2.5 px-5">{t("production.print_item")}</th>
                  <th className="py-2.5 px-5 text-right">{t("production.print_weight")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DED2]/60">
                {weights.map((w, i) => (
                  <tr key={i}>
                    <td className="py-2.5 px-5 font-mono font-bold text-primary">{w.workItemCode}</td>
                    <td className="py-2.5 px-5 text-foreground">{w.workItemName}</td>
                    <td className="py-2.5 px-5 text-right font-mono font-bold text-foreground">{w.weightPct}%</td>
                  </tr>
                ))}
                <tr className="bg-secondary/20 font-bold">
                  <td colSpan={2} className="py-3 px-5 text-primary uppercase text-xs">{t("production.print_total_weight")}</td>
                  <td className="py-3 px-5 text-right font-mono text-primary">{weights.reduce((s, w) => s + w.weightPct, 0)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* RAB */}
        <div className="border border-border rounded-2xl overflow-hidden mb-12">
          <div className="px-5 py-3 border-b border-border bg-muted/30/70">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">{t("production.print_rab_title")}</h3>
          </div>
          <div className="px-5 py-4 flex items-center justify-between">
            <span className="font-semibold text-muted-foreground">{t("production.print_total_budget")}</span>
            <span className="font-mono font-black text-xl text-primary">{formatRupiah(spk.rabAmount ?? 0)}</span>
          </div>
        </div>

        {/* SIGNATURES */}
        <div className="grid grid-cols-3 gap-8 text-center text-xs mt-16">
          {[t("production.print_sign_assignor"), t("production.print_sign_approved"), t("production.print_sign_executor")].map((title, i) => (
            <div key={i} className="space-y-16">
              <div className="space-y-1">
                <span className="text-muted-foreground block">{title}</span>
                <span className="text-[10px] text-muted-foreground/70 italic">{t("production.print_sign_note")}</span>
              </div>
              <div className="space-y-1">
                <div className="w-full border-b border-dashed border-[#66736A] mx-auto" />
                <span className="font-bold text-foreground block">
                  {i === 0 ? spk.createdByName || "—" : i === 2 ? spk.vendorName || "—" : t("production.print_leader")}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="no-print mt-12 pt-6 border-t border-border/40 flex items-center justify-center gap-2 text-xs text-primary font-semibold">
          <CheckCircle2 className="h-4 w-4 text-primary/70" />
          <span>SPK {spk.spkNumber} — {t("production.print_status")} <strong>{getSpkStatusLabel(spk.status)}</strong></span>
        </div>
      </div>
    </div>
  );
}
