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

export const revalidate = 0;

export default async function KprPipelinePage() {
  const activeUser = await requireAuth();
  const sessionRoleInfo = await getSessionRole(activeUser.id);
  
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

  // SLA Warnings background checker — intentional fire-and-forget.
  // NOTE: This may not complete if the server response is sent before the async finishes.
  // For production reliability, consider moving this to the /api/cron/overdue-scanner endpoint.
  runKprSlaChecks(allKpr).catch(err => {
    console.error(JSON.stringify({ event: "bg_scan_error", type: "kpr_sla", error: err instanceof Error ? err.message : String(err) }));
  });


  return (
    <KprShell
      initialKpr={allKpr}
      bankPartners={bankPartners}
      submissions={allSubmissions}
      documents={allDocuments}
      accounts={activeAccounts}
      canVerifyDocs={canVerifyDocs}
      canApproveHandover={canApproveHandover}
    />
  );
}

async function runKprSlaChecks(allKpr: any[]) {
  const now = new Date();
  for (const k of allKpr) {
    if (k.status !== "akad" && k.slaDeadlineAt && new Date(k.slaDeadlineAt) < now) {
      try {
        const { notifications } = await import("@/db/schema/system");
        const { notifyUsersWithRoles } = await import("@/server/actions/notification");
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
            message: `Pengajuan KPR kavling ${k.unitCode} oleh konsumen ${k.customerName} telah melebihi SLA 5 hari.`,
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
