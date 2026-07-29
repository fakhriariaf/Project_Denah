import { db } from "@/db";
import { 
  kprProcesses as kprTable, 
  bookings as bookingsTable, 
  bankPartners as bankPartnersTable,
  bankSubmissions as submissionsTable,
  customerDocuments as documentsTable
} from "@/db/schema/marketing";
import { projects as projectsTable, units as unitsTable, customers as customersTable, financeAccounts as accountsTable } from "@/db/schema/master";
import { user as userTable } from "@/db/schema/auth";
import { attachments } from "@/db/schema/system";
import { eq, desc } from "drizzle-orm";
import { KprShell } from "./kpr-shell";
import { requireAuth, getSessionRole } from "@/server/permissions";
import { redirect } from "next/navigation";
import { safeFetchSlaData, mapKprSlaDisplay, type KprSlaDisplayResult } from "@/server/services/kpr-sla/dual-read";
import { getActiveVisitsByKprIds } from "@/server/services/kpr-sla/queries";
import {
  resolveCutoverState,
  KPR_SLA_CUTOVER_UNAVAILABLE_READ_MESSAGE,
} from "@/server/services/kpr-sla/config";
import { isSlaTerminalStage } from "@/server/services/kpr-sla/resolver";

export const revalidate = 0;

export default async function KprPipelinePage() {
  const activeUser = await requireAuth();
  const sessionRoleInfo = await getSessionRole(activeUser.id);

  // Pipeline KPR memuat data konsumen, dokumen, dan keputusan bank. Batasi
  // pembacaannya ke peran yang memang memiliki akses modul pemasaran/KPR.
  const canAccessKprPipeline =
    sessionRoleInfo.isSuperAdmin ||
    sessionRoleInfo.isAdminKantor ||
    sessionRoleInfo.isMarketing ||
    sessionRoleInfo.isMarketingManager ||
    sessionRoleInfo.isKeuangan ||
    sessionRoleInfo.isDireksi;
  if (!canAccessKprPipeline) {
    redirect("/unauthorized");
  }
  
  // Super Admin, Admin Kantor, Keuangan, Direksi can verify docs
  const canVerifyDocs = 
    sessionRoleInfo.isSuperAdmin || 
    sessionRoleInfo.isAdminKantor || 
    sessionRoleInfo.isKeuangan || 
    sessionRoleInfo.isDireksi;

  // Super Admin, Admin Kantor, Direksi can approve serah terima (approveBastKonsumen)
  const canApproveHandover =
    sessionRoleInfo.isSuperAdmin ||
    sessionRoleInfo.isAdminKantor ||
    sessionRoleInfo.isDireksi;

  // 1. Fetch bank partners & submissions
  const bankPartners = await db.select().from(bankPartnersTable);
  const activeAccounts = await db.select().from(accountsTable).where(eq(accountsTable.status, "active"));
  
  // 2. Fetch KPR processes with detailed relations
  const allKpr = await db.select({
    id: kprTable.id,
    status: kprTable.status,
    biCheckStatus: kprTable.biCheckStatus,
    documentStatus: kprTable.documentStatus,
    slaStartAt: kprTable.slaStartAt,
    slaDeadlineAt: kprTable.slaDeadlineAt,
    bankNotes: kprTable.bankNotes,
    akadDate: kprTable.akadDate,
    bookingId: kprTable.bookingId,
    bookingNumber: bookingsTable.bookingNumber,
    customerId: bookingsTable.customerId,
    customerName: customersTable.name,
    customerPhone: customersTable.phone,
    projectName: projectsTable.name,
    unitId: bookingsTable.unitId,
    unitCode: unitsTable.code,
    price: unitsTable.price,
    isReadyStock: unitsTable.isReadyStock,
    readyStockSource: unitsTable.readyStockSource,
    constructionProgress: unitsTable.constructionProgress,
    unitStatus: unitsTable.status,
    marketingName: userTable.name,
  })
  .from(kprTable)
  .innerJoin(bookingsTable, eq(kprTable.bookingId, bookingsTable.id))
  .innerJoin(projectsTable, eq(bookingsTable.projectId, projectsTable.id))
  .innerJoin(unitsTable, eq(bookingsTable.unitId, unitsTable.id))
  .innerJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
  .leftJoin(userTable, eq(bookingsTable.marketingId, userTable.id))
  .orderBy(desc(kprTable.createdAt));

  // 3. Fetch submissions and docs per client
  const allSubmissions = await db.select().from(submissionsTable);
  
  const allDocuments = await db.select({
    id: documentsTable.id,
    customerId: documentsTable.customerId,
    bookingId: documentsTable.bookingId,
    documentType: documentsTable.documentType,
    status: documentsTable.status,
    notes: documentsTable.notes,
    attachmentId: documentsTable.attachmentId,
    fileName: attachments.fileName,
    fileUrl: attachments.fileUrl,
  })
  .from(documentsTable)
  .innerJoin(attachments, eq(documentsTable.attachmentId, attachments.id));

  // ── SLA Batch Fetch (Task 5.1) ──
  // Fetch active visits in one batch query (no N+1) and compute SLA display
  // results server-side. Serialize to plain Record since Map is not serializable.
  const kprIds = allKpr.map(k => k.id);
  const slaResult = await safeFetchSlaData(() => getActiveVisitsByKprIds(kprIds));

  // Cutover state: post-cutover disables legacy fallback for non-terminal KPR.
  // `unavailable` (gagal baca app_settings) TIDAK boleh diperlakukan sebagai
  // pre-cutover — itu akan menghidupkan legacy fallback secara diam-diam.
  // Sebagai gantinya, indikator SLA ditampilkan sebagai error non-destruktif
  // sementara seluruh data KPR (kolom Kanban, kartu, drag-drop, aksi detail)
  // tetap tersedia. Halaman TIDAK boleh 500 hanya karena indikator SLA gagal.
  const cutoverState = await resolveCutoverState();
  const cutoverUnavailable = cutoverState.status === "unavailable";
  const cutoverActive = cutoverState.active === true;
  const slaError = cutoverUnavailable
    ? KPR_SLA_CUTOVER_UNAVAILABLE_READ_MESSAGE
    : slaResult.error;

  // Pre-compute display results for each KPR card on the server to avoid
  // shipping server-only modules (working-days, resolver) to the client.
  const now = new Date();
  let slaDisplayMap: Record<string, KprSlaDisplayResult> = {};
  if (cutoverUnavailable) {
    // Sengaja kosong: tanpa status cutover yang pasti, badge SLA apa pun
    // berpotensi menyesatkan. Shell menampilkan banner error SLA saja.
    slaDisplayMap = {};
  } else if (slaResult.data) {
    for (const kpr of allKpr) {
      const activeVisit = slaResult.data.get(kpr.id) ?? null;
      const displayResult = mapKprSlaDisplay({
        activeVisit,
        legacySlaStartAt: kpr.slaStartAt,
        legacySlaDeadlineAt: kpr.slaDeadlineAt,
        kprStatus: kpr.status,
        now,
        cutoverActive,
      });
      slaDisplayMap[kpr.id] = displayResult;
    }
  } else {
    // If SLA fetch failed, still compute display from legacy fields only
    for (const kpr of allKpr) {
      const displayResult = mapKprSlaDisplay({
        activeVisit: null,
        legacySlaStartAt: kpr.slaStartAt,
        legacySlaDeadlineAt: kpr.slaDeadlineAt,
        kprStatus: kpr.status,
        now,
        cutoverActive,
      });
      slaDisplayMap[kpr.id] = displayResult;
    }
  }

  // SLA overdue notifications now run reliably via the cron endpoint
  // (`app/api/cron/overdue-scanner` → `runKprSlaOverdueScan`) instead of a
  // page-level fire-and-forget task that may not complete before the response
  // is flushed. `runKprSlaChecks` below is retained for regression tests.


  return (
    <KprShell
      initialKpr={allKpr}
      bankPartners={bankPartners}
      submissions={allSubmissions}
      documents={allDocuments}
      accounts={activeAccounts}
      canVerifyDocs={canVerifyDocs}
      canApproveHandover={canApproveHandover}
      slaDisplayMap={slaDisplayMap}
      slaError={slaError}
    />
  );
}

/**
 * Predikat murni: apakah KPR ini harus dianggap melewati SLA legacy dan
 * layak dipindai untuk notifikasi `kpr_sla`?
 *
 * - Tahap terminal SLA dikecualikan memakai `isSlaTerminalStage` dari
 *   `server/services/kpr-sla/resolver.ts` (sumber kanonik daftar tahap; lihat
 *   design.md "Stage Domain — Source of Truth"). SLA berhenti diukur begitu
 *   KPR memasuki salah satu tahap terminal.
 * - `approved` TIDAK dikecualikan — tahap ini tetap terukur dan wajib tetap
 *   dapat dipindai ketika `slaDeadlineAt` legacy sudah lewat.
 *
 * Diekspor agar dapat diuji sebagai regression test tanpa database.
 */
export function shouldFlagLegacyKprSlaOverdue(
  status: string,
  slaDeadlineAt: Date | string | null | undefined,
  now: Date,
): boolean {
  if (isSlaTerminalStage(status)) {
    return false;
  }
  if (!slaDeadlineAt) return false;
  return new Date(slaDeadlineAt) < now;
}

export async function runKprSlaChecks(allKpr: any[]) {
  const now = new Date();
  for (const k of allKpr) {
    if (shouldFlagLegacyKprSlaOverdue(k.status, k.slaDeadlineAt, now)) {
      try {
        const { notifications } = await import("@/db/schema/system");
        const { notifyUsersWithRoles } = await import("@/server/services/notification.service");
        const { and, eq } = await import("drizzle-orm");

        const existing = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.entityId, k.id),
              eq(notifications.type, "kpr_sla")
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await notifyUsersWithRoles({
            roleNames: ["Marketing", "Super Admin", "Admin Kantor"],
            type: "kpr_sla",
            title: "Pemberkasan KPR Melebihi SLA",
            // Wording ini SENGAJA tidak menyebut angka hari tetap (misalnya
            // "SLA 5 hari"). `slaDeadlineAt` saat ini masih dihitung dari
            // fallback legacy lima hari kerja (lihat createBooking/updateBooking),
            // tetapi begitu resolver SLA (Task 1.2/2.2) aktif, tenggat dapat
            // berasal dari target yang dikonfigurasi berbeda per tahap/perumahan.
            // Klaim angka hari yang tetap di sini akan menyesatkan setelah itu.
            message: `Pengajuan KPR kavling ${k.unitCode} oleh konsumen ${k.customerName} telah melewati tenggat SLA yang ditetapkan.`,
            entityId: k.id,
            entityType: "kpr_process",
          });
        }
      } catch (err) {
        console.warn("Failed to trigger KPR SLA warning for KPR ID:", k.id, err);
      }
    }
  }
}
