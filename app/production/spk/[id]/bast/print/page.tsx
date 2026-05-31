import { db } from "@/db";
import { spks, spkWorkItemWeights } from "@/db/schema/production";
import { projects as projectsTable, units as unitsTable, vendors as vendorsTable, projectUsers } from "@/db/schema/master";
import { appSettings } from "@/db/schema/system";
import { user as userTable } from "@/db/schema/auth";
import { workItems } from "@/db/schema/production";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatDate, formatRupiah } from "@/lib/format-utils";
import { PrintButton } from "@/components/ui/print-button";
import { FileText, MapPin, Phone, Mail, CheckCircle2, Building, User, Calendar, ShieldCheck } from "lucide-react";
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
    .select({ spkNumber: spks.spkNumber, unitCode: unitsTable.code })
    .from(spks)
    .leftJoin(unitsTable, eq(spks.unitId, unitsTable.id))
    .where(eq(spks.id, id))
    .then(r => r[0]);

  const safeUnit = (row?.unitCode || "Unit").replace(/[^a-zA-Z0-9]/g, "");
  return { title: `BAST_${row?.spkNumber || id}_${safeUnit}` };
}

export default async function PrintBastPage({ params }: Props) {
  await requireAuth();
  const { id } = await params;
  const { t } = await getI18n();

  // Fetch SPK and related details
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
      projectId: spks.projectId,
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

  // Fetch Project Supervisor (Pengawas Lapangan)
  const supervisor = await db
    .select({
      name: userTable.name,
    })
    .from(projectUsers)
    .innerJoin(userTable, eq(projectUsers.userId, userTable.id))
    .where(
      and(
        eq(projectUsers.projectId, spk.projectId),
        eq(userTable.roleId, "role_pengawas")
      )
    )
    .then(r => r[0]);

  const supervisorName = supervisor?.name || spk.createdByName || "Pengawas Lapangan";
  
  // Enforce BAST can only be issued for completed SPKs (100% progress)
  if (spk.status !== "completed") {
    throw new Error("⚠️ Dokumen BAST (Berita Acara Serah Terima) hanya dapat diterbitkan untuk pembangunan yang sudah selesai 100% (Status: Completed).");
  }

  // Get completed work items
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

  // Generate legal day and date text in Indonesian
  const daysMap: Record<number, string> = {
    0: "Minggu", 1: "Senin", 2: "Selasa", 3: "Rabu", 4: "Kamis", 5: "Jumat", 6: "Sabtu"
  };
  const monthsMap: Record<number, string> = {
    0: "Januari", 1: "Februari", 2: "Maret", 3: "April", 4: "Mei", 5: "Juni",
    6: "Juli", 7: "Agustus", 8: "September", 9: "Oktober", 10: "November", 11: "Desember"
  };

  const actualDate = spk.actualEndDate ? new Date(spk.actualEndDate) : new Date();
  const dayName = daysMap[actualDate.getDay()];
  const dateNum = actualDate.getDate();
  const monthName = monthsMap[actualDate.getMonth()];
  const yearNum = actualDate.getFullYear();

  const formattedBastNumber = `BAST/PROD/${actualDate.toISOString().slice(0,10).replace(/-/g, "")}/${spk.spkNumber.split("-").pop()}`;

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

      <PrintButton label="Cetak Dokumen BAST" />

      <div className="print-area max-w-4xl mx-auto mt-6 bg-white border border-[#D6DED2] rounded-3xl shadow-sage p-8 md:p-12">
        <div className="space-y-8 bg-transparent">
          
          {/* KOP SURAT */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b-2 border-[#4F6F52]/30 print-border-dark gap-6">
            <div className="space-y-1 md:flex-1">
              <h1 className="text-xl font-extrabold text-[#4F6F52] tracking-wide print-text-dark">{companyName}</h1>
              <div className="text-xs text-[#66736A] space-y-0.5 print-text-dark">
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#8FAF9A]" />
                  {companyAddress}
                </p>
                <p className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-[#8FAF9A]" />
                  Telp: {companyPhone}
                </p>
                <p className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-[#8FAF9A]" />
                  Email: {companyEmail}
                </p>
              </div>
            </div>
            
            <div className="bg-[#DDE8D8]/50 border border-[#8FAF9A]/30 rounded-2xl px-4 py-2 text-right shrink-0">
              <span className="text-[10px] font-bold text-[#4F6F52] uppercase tracking-wider block">BERITA ACARA SERAH TERIMA</span>
              <span className="font-mono text-sm font-bold text-[#243028] print-text-dark">{formattedBastNumber}</span>
            </div>
          </div>

          {/* JUDUL DOKUMEN */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black text-[#243028] uppercase tracking-wider print-text-dark">
              BERITA ACARA SERAH TERIMA PEMBANGUNAN UNIT (BAST)
            </h2>
            <p className="text-sm text-[#66736A] font-semibold print-text-dark">
              Nomor BAST: <span className="font-mono font-bold text-[#243028]">{formattedBastNumber}</span>
            </p>
          </div>

          {/* HARI & TANGGAL LEGAL */}
          <div className="text-sm leading-relaxed text-[#243028] print-text-dark text-justify space-y-3">
            <p>
              Pada hari ini <strong className="text-primary font-bold">{dayName}</strong> tanggal <strong className="text-primary font-bold">{dateNum}</strong> bulan <strong className="text-primary font-bold">{monthName}</strong> tahun <strong className="text-primary font-bold">{yearNum}</strong> ({actualDate.toLocaleDateString("id-ID")}), bertempat di kantor pusat developer, kami yang bertandatangan di bawah ini:
            </p>
            
            <div className="pl-4 space-y-2 border-l-2 border-[#8FAF9A]/40 print-border-dark">
              <p className="flex items-start gap-2">
                <span className="font-bold min-w-[70px]">1. Nama:</span>
                <span><strong>{supervisorName}</strong>, mewakili <strong className="text-[#4F6F52]">{companyName}</strong> yang beralamat di {companyAddress}, selanjutnya disebut sebagai <strong>PIHAK PERTAMA (PENGAWAS)</strong>.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-bold min-w-[70px]">2. Vendor:</span>
                <span><strong>{spk.vendorName || "—"}</strong>, selanjutnya disebut sebagai <strong>PIHAK KEDUA (KONTRAKTOR)</strong>.</span>
              </p>
            </div>
            
            <p>
              Kedua belah pihak secara bersama-sama sepakat dan menyatakan telah melakukan serah terima pekerjaan pembangunan fisik atas unit properti/kavling yang telah diselesaikan <strong>100% (Selesai Penuh)</strong> dengan rincian teknis sebagai berikut:
            </p>
          </div>

          {/* UNIT DETAILS TABLE */}
          <div className="border border-[#D6DED2] print-border-dark rounded-2xl overflow-hidden bg-[#F7F8F3]/30">
            <table className="w-full text-sm text-left border-collapse">
              <tbody className="divide-y divide-[#D6DED2]/60">
                <tr>
                  <td className="w-[35%] bg-[#F7F8F3]/70 font-bold p-3 text-[#66736A] print-text-dark border-r border-[#D6DED2]/60 print-border-dark">Referensi SPK</td>
                  <td className="p-3 text-[#243028] print-text-dark font-mono font-bold tabular-nums">{spk.spkNumber}</td>
                </tr>
                <tr>
                  <td className="bg-[#F7F8F3]/70 font-bold p-3 text-[#66736A] print-text-dark border-r border-[#D6DED2]/60 print-border-dark">Nama Paket Pekerjaan</td>
                  <td className="p-3 text-[#243028] print-text-dark font-semibold">{spk.title}</td>
                </tr>
                <tr>
                  <td className="bg-[#F7F8F3]/70 font-bold p-3 text-[#66736A] print-text-dark border-r border-[#D6DED2]/60 print-border-dark">Proyek & Kode Kavling</td>
                  <td className="p-3 text-[#243028] print-text-dark font-bold">
                    {spk.projectName || "—"} &mdash; Blok {spk.unitCode || "—"}
                  </td>
                </tr>
                <tr>
                  <td className="bg-[#F7F8F3]/70 font-bold p-3 text-[#66736A] print-text-dark border-r border-[#D6DED2]/60 print-border-dark">Cluster / Tipe Unit</td>
                  <td className="p-3 text-[#243028] print-text-dark">
                    Cluster {spk.unitCluster || "—"} / Tipe {spk.unitType || "—"}
                  </td>
                </tr>
                <tr>
                  <td className="bg-[#F7F8F3]/70 font-bold p-3 text-[#66736A] print-text-dark border-r border-[#D6DED2]/60 print-border-dark">Nilai Kontrak (RAB)</td>
                  <td className="p-3 text-[#4F6F52] print-text-dark font-mono font-bold tabular-nums">
                    {formatRupiah(spk.rabAmount ?? 0)}
                  </td>
                </tr>
                <tr>
                  <td className="bg-[#F7F8F3]/70 font-bold p-3 text-[#66736A] print-text-dark border-r border-[#D6DED2]/60 print-border-dark">Periode Kerja SPK</td>
                  <td className="p-3 text-[#243028] print-text-dark font-mono">
                    {formatDate(spk.startDate)} s/d {formatDate(spk.targetEndDate)}
                  </td>
                </tr>
                <tr>
                  <td className="bg-[#DDE8D8]/50 font-bold p-3 text-[#4F6F52] print-text-dark border-r border-[#D6DED2]/60 print-border-dark">Tanggal Selesai Riil</td>
                  <td className="p-3 text-[#4F6F52] print-text-dark font-mono font-bold">
                    {spk.actualEndDate ? formatDate(spk.actualEndDate) : formatDate(new Date())}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* BOBOT ITEM PEKERJAAN 100% */}
          {weights.length > 0 && (
            <div className="border border-[#D6DED2] print-border-dark rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
                <h3 className="text-xs font-bold text-[#4F6F52] uppercase tracking-wider">Komponen Pekerjaan Diselesaikan (100% Selesai)</h3>
              </div>
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D6DED2] text-[#66736A] font-bold bg-[#F7F8F3]/30">
                    <th className="py-2 px-5">Kode Komponen</th>
                    <th className="py-2 px-5">Item Komponen Pekerjaan</th>
                    <th className="py-2 px-5 text-center">Bobot Progres</th>
                    <th className="py-2 px-5 text-right">Status Fisik</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D6DED2]/60">
                  {weights.map((w, i) => (
                    <tr key={i} className="hover:bg-[#8FAF9A]/5">
                      <td className="py-2 px-5 font-mono font-bold text-[#4F6F52]">{w.workItemCode}</td>
                      <td className="py-2 px-5 text-[#243028] font-medium">{w.workItemName}</td>
                      <td className="py-2 px-5 text-center font-mono font-bold text-[#243028]">{w.weightPct}%</td>
                      <td className="py-2 px-5 text-right font-bold text-emerald-600">100% Selesai</td>
                    </tr>
                  ))}
                  <tr className="bg-[#DDE8D8]/20 font-bold">
                    <td colSpan={2} className="py-2.5 px-5 text-[#4F6F52] uppercase text-[10px]">Total Progres SLA Fisik Lapangan</td>
                    <td className="py-2.5 px-5 text-center font-mono text-[#4F6F52]">100%</td>
                    <td className="py-2.5 px-5 text-right text-emerald-700">DIVERIFIKASI</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* PERNYATAAN KESEPAKATAN LEGAL */}
          <div className="border border-[#D6DED2] rounded-2xl p-5 bg-[#F7F8F3]/20 text-xs text-[#66736A] space-y-3 print-text-dark">
            <h4 className="font-bold text-[#243028] text-xs uppercase tracking-wider mb-1 print-text-dark flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#8FAF9A]" /> KLAUSUL SERAH TERIMA & JAMINAN PEMELIHARAAN (SLA)
            </h4>
            <div className="pl-5 leading-relaxed text-sm text-justify space-y-2">
              <p>
                1. <strong>Penerimaan Pekerjaan:</strong> PIHAK PERTAMA menyatakan menerima hasil pembangunan fisik unit dari PIHAK KEDUA dalam kondisi baik, rapi, dan sesuai dengan standar teknis spesifikasi yang telah disepakati bersama.
              </p>
              <p>
                2. <strong>Jaminan Pemeliharaan (SLA):</strong> Masa garansi retensi dan pemeliharaan konstruksi fisik unit berlaku selama <strong>100 (seratus) hari kalender</strong> terhitung sejak tanggal penandatanganan dokumen BAST ini. PIHAK KEDUA wajib memperbaiki kerusakan struktural maupun estetika jika terdapat komplain kualitas dari pengawas developer selama masa SLA pemeliharaan berlangsung.
              </p>
              <p>
                3. <strong>Peralihan Tanggung Jawab:</strong> Sejak ditandatanganinya Berita Acara Serah Terima ini, maka kepemilikan dan tanggung jawab pemeliharaan rutin unit properti resmi dialihkan dari Kontraktor (PIHAK KEDUA) kepada Developer (PIHAK PERTAMA).
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[#66736A] print-text-dark">
            Demikian Berita Acara Serah Terima ini dibuat dalam rangkap 2 (dua) bermaterai cukup dan mempunyai kekuatan hukum yang sama bagi kedua belah pihak untuk dipergunakan sebagaimana mestinya.
          </p>

          {/* TANDA TANGAN (SIGNATURE BLOCKS) */}
          <div className="grid grid-cols-2 gap-12 text-center text-sm mt-20">
            <div className="space-y-20">
              <div className="space-y-1">
                <span className="text-[#66736A] block">PIHAK KEDUA (KONTRAKTOR)</span>
                <span className="font-bold text-[#243028] print-text-dark block">{spk.vendorName || "—"}</span>
              </div>
              <div className="space-y-1">
                <div className="w-48 border-b border-dashed border-[#66736A] mx-auto print-border-dark" />
                <span className="text-xs text-[#66736A] print-text-dark block">Kontraktor Pelaksana (PIC)</span>
              </div>
            </div>
            
            <div className="space-y-20">
              <div className="space-y-1">
                <span className="text-[#66736A] block">PIHAK PERTAMA (PENGAWAS)</span>
                <span className="font-bold text-[#243028] print-text-dark block">{supervisorName}</span>
              </div>
              <div className="space-y-1">
                <div className="w-48 border-b border-dashed border-[#66736A] mx-auto print-border-dark" />
                <span className="text-xs text-[#66736A] print-text-dark block">Pengawas Lapangan</span>
              </div>
            </div>
          </div>

          {/* ACKNOWLEDGED BY DIREKTUR */}
          <div className="text-center text-sm mt-12 space-y-16">
            <div className="space-y-1">
              <span className="text-[#66736A] block">Mengetahui & Menyetujui,</span>
              <span className="font-bold text-[#243028] print-text-dark block">Direktur Utama Proyek</span>
            </div>
            <div className="space-y-1">
              <div className="w-56 border-b border-dashed border-[#66736A] mx-auto print-border-dark" />
              <span className="text-xs text-[#66736A] print-text-dark block">Direksi Pembangunan Proyek</span>
            </div>
          </div>

        </div>

        {/* SYSTEM STAMP */}
        <div className="no-print mt-12 pt-6 border-t border-[#D6DED2]/40 flex justify-between items-center text-xs text-[#66736A] font-semibold">
          <span>Sistem Validasi BAST Terintegrasi &bull; No. SPK: <span className="font-mono">{spk.spkNumber}</span></span>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 uppercase font-bold text-[9px] px-2 py-0.5 rounded shadow-none">VERIFIED 100% DONE</span>
        </div>
      </div>
    </div>
  );
}
