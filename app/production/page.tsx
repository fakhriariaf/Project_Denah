import { db } from "@/db";
import {
  projects as projectsTable,
  units as unitsTable,
  customers as customersTable,
  vendors as vendorsTable,
  projectUsers,
} from "@/db/schema/master";
import {
  workItems as workItemsTable,
  spks as spksTable,
  spmbs as spmbsTable,
  materialRequests as materialRequestsTable,
  complaints as complaintsTable,
} from "@/db/schema/production";
import { desc, eq, and, inArray } from "drizzle-orm";
import { vendorProfiles } from "@/db/schema/auth";
import { requireAuth, getSessionRole } from "@/server/permissions";
import { getSpkUnitEligibility } from "@/server/services/spk-unit-eligibility";
import ProductionShell from "./production-shell";

export const revalidate = 0;

export default async function ProductionPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { tab } = searchParams ? await searchParams : { tab: undefined };

  // 1. Authenticate user
  const activeUser = await requireAuth();
  const sessionRoleInfo = await getSessionRole(activeUser.id);

  // 1b. Resolve vendorId if vendor role
  let vendorId: string | null = null;
  if (sessionRoleInfo.isVendor) {
    const [profile] = await db
      .select({ vendorId: vendorProfiles.vendorId })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.userId, activeUser.id))
      .limit(1);
    vendorId = profile?.vendorId || "non-existent-vendor";
  }

  // 1c. Resolve projectIds if supervisor role (and not super admin)
  let projectIds: string[] = [];
  if (sessionRoleInfo.isPengawas && !sessionRoleInfo.isSuperAdmin) {
    const supervisorProjects = await db
      .select({ projectId: projectUsers.projectId })
      .from(projectUsers)
      .where(eq(projectUsers.userId, activeUser.id));
    projectIds = supervisorProjects.map(sp => sp.projectId);
    if (projectIds.length === 0) {
      projectIds = ["non-existent-project"];
    }
  }

  // 1d. Define Drizzle dynamic filters based on role
  const spkFilters = [];
  if (sessionRoleInfo.isVendor) {
    spkFilters.push(eq(spksTable.vendorId, vendorId || ""));
  } else if (sessionRoleInfo.isPengawas && !sessionRoleInfo.isSuperAdmin) {
    spkFilters.push(inArray(spksTable.projectId, projectIds));
  }

  const spmbFilters = [];
  if (sessionRoleInfo.isVendor) {
    spmbFilters.push(eq(spksTable.vendorId, vendorId || ""));
  } else if (sessionRoleInfo.isPengawas && !sessionRoleInfo.isSuperAdmin) {
    spmbFilters.push(inArray(spksTable.projectId, projectIds));
  }

  const mrFilters = [];
  if (sessionRoleInfo.isVendor) {
    mrFilters.push(eq(materialRequestsTable.vendorId, vendorId || ""));
  } else if (sessionRoleInfo.isPengawas && !sessionRoleInfo.isSuperAdmin) {
    mrFilters.push(inArray(materialRequestsTable.projectId, projectIds));
  }

  const complaintFilters = [];
  if (sessionRoleInfo.isPengawas && !sessionRoleInfo.isSuperAdmin) {
    complaintFilters.push(inArray(unitsTable.projectId, projectIds));
  }

  // 2. Fetch all required tables in parallel with dynamic filters
  const [
    projectsList,
    unitsList,
    customersList,
    vendorsList,
    workItemsList,
    spksList,
    spmbsList,
    materialRequestsList,
    complaintsListRaw,
  ] = await Promise.all([
    db.select().from(projectsTable).where(sessionRoleInfo.isPengawas && !sessionRoleInfo.isSuperAdmin ? inArray(projectsTable.id, projectIds) : undefined),
    db.select().from(unitsTable),
    db.select().from(customersTable),
    db.select().from(vendorsTable).where(eq(vendorsTable.status, "active")),
    db.select().from(workItemsTable).where(eq(workItemsTable.status, "active")),
    
    // SPKs with project, unit, and vendor details
    db
      .select({
        id: spksTable.id,
        spkNumber: spksTable.spkNumber,
        projectId: spksTable.projectId,
        unitId: spksTable.unitId,
        vendorId: spksTable.vendorId,
        title: spksTable.title,
        workDescription: spksTable.workDescription,
        specification: spksTable.specification,
        rabAmount: spksTable.rabAmount,
        startDate: spksTable.startDate,
        targetEndDate: spksTable.targetEndDate,
        actualEndDate: spksTable.actualEndDate,
        status: spksTable.status,
        progressPct: spksTable.progressPct,
        createdAt: spksTable.createdAt,
        projectName: projectsTable.name,
        unitCode: unitsTable.code,
        vendorName: vendorsTable.name,
      })
      .from(spksTable)
      .innerJoin(projectsTable, eq(spksTable.projectId, projectsTable.id))
      .innerJoin(unitsTable, eq(spksTable.unitId, unitsTable.id))
      .innerJoin(vendorsTable, eq(spksTable.vendorId, vendorsTable.id))
      .where(spkFilters.length > 0 ? and(...spkFilters) : undefined)
      .orderBy(desc(spksTable.createdAt)),

    // SPMBs with joined details
    db
      .select({
        id: spmbsTable.id,
        spmbNumber: spmbsTable.spmbNumber,
        spkId: spmbsTable.spkId,
        issueDate: spmbsTable.issueDate,
        startWorkDate: spmbsTable.startWorkDate,
        targetEndDate: spmbsTable.targetEndDate,
        status: spmbsTable.status,
        notes: spmbsTable.notes,
        createdAt: spmbsTable.createdAt,
        spkNumber: spksTable.spkNumber,
        spkTitle: spksTable.title,
        projectName: projectsTable.name,
        unitCode: unitsTable.code,
      })
      .from(spmbsTable)
      .innerJoin(spksTable, eq(spmbsTable.spkId, spksTable.id))
      .innerJoin(projectsTable, eq(spksTable.projectId, projectsTable.id))
      .innerJoin(unitsTable, eq(spksTable.unitId, unitsTable.id))
      .where(spmbFilters.length > 0 ? and(...spmbFilters) : undefined)
      .orderBy(desc(spmbsTable.createdAt)),

    // Material requests
    db
      .select({
        id: materialRequestsTable.id,
        requestNumber: materialRequestsTable.requestNumber,
        spkId: materialRequestsTable.spkId,
        projectId: materialRequestsTable.projectId,
        unitId: materialRequestsTable.unitId,
        vendorId: materialRequestsTable.vendorId,
        description: materialRequestsTable.description,
        estimatedAmount: materialRequestsTable.estimatedAmount,
        status: materialRequestsTable.status,
        transactionId: materialRequestsTable.transactionId,
        createdAt: materialRequestsTable.createdAt,
        spkNumber: spksTable.spkNumber,
        projectName: projectsTable.name,
        unitCode: unitsTable.code,
        vendorName: vendorsTable.name,
      })
      .from(materialRequestsTable)
      .innerJoin(spksTable, eq(materialRequestsTable.spkId, spksTable.id))
      .innerJoin(projectsTable, eq(materialRequestsTable.projectId, projectsTable.id))
      .innerJoin(unitsTable, eq(materialRequestsTable.unitId, unitsTable.id))
      .leftJoin(vendorsTable, eq(materialRequestsTable.vendorId, vendorsTable.id))
      .where(mrFilters.length > 0 ? and(...mrFilters) : undefined)
      .orderBy(desc(materialRequestsTable.createdAt)),

    // Complaints
    db
      .select({
        id: complaintsTable.id,
        complaintNumber: complaintsTable.complaintNumber,
        customerId: complaintsTable.customerId,
        unitId: complaintsTable.unitId,
        category: complaintsTable.category,
        description: complaintsTable.description,
        status: complaintsTable.status,
        resolvedAt: complaintsTable.resolvedAt,
        createdAt: complaintsTable.createdAt,
        customerName: customersTable.name,
        unitCode: unitsTable.code,
        projectName: projectsTable.name,
      })
      .from(complaintsTable)
      .innerJoin(customersTable, eq(complaintsTable.customerId, customersTable.id))
      .innerJoin(unitsTable, eq(complaintsTable.unitId, unitsTable.id))
      .innerJoin(projectsTable, eq(unitsTable.projectId, projectsTable.id))
      .where(complaintFilters.length > 0 ? and(...complaintFilters) : undefined)
      .orderBy(desc(complaintsTable.createdAt)),
  ]);

  // Filter vendor complaints in-memory
  let complaintsList = complaintsListRaw;
  if (sessionRoleInfo.isVendor) {
    const vendorUnitIds = new Set(spksList.map(s => s.unitId).filter(Boolean) as string[]);
    // Log if vendor has a valid ID but no SPKs — may indicate data integrity issue or wrong filter
    if (vendorId && vendorId !== "non-existent-vendor" && spksList.length === 0) {
      console.warn(`[production/page] Vendor ${vendorId} has no SPKs — SPMB/complaint filter may return empty results.`);
    }
    complaintsList = complaintsListRaw.filter(c => c.unitId && vendorUnitIds.has(c.unitId));
  }


  // Fetch paid DP invoices — used for DP Gate validation in SPK form
  const spkEligibility = await Promise.all(
    unitsList.map(async (unit) => ({
      unitId: unit.id,
      result: await getSpkUnitEligibility(db, {
        unitId: unit.id,
        projectId: unit.projectId ?? undefined,
      }),
    })),
  );
  const spkEligibleUnitIds = spkEligibility
    .filter(({ result }) => result.eligible)
    .map(({ unitId }) => unitId);

  return (
    <ProductionShell
      activeUser={activeUser}
      isSuperAdmin={sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor || sessionRoleInfo.isKeuangan}
      isPengawas={sessionRoleInfo.isPengawas}
      isVendor={sessionRoleInfo.isVendor}
      projects={projectsList}
      units={unitsList}
      customers={customersList}
      vendors={vendorsList}
      workItems={workItemsList}
      spks={spksList}
      spmbs={spmbsList}
      materialRequests={materialRequestsList}
      complaints={complaintsList}
      spkEligibleUnitIds={spkEligibleUnitIds}
      defaultTab={tab as any}
    />
  );
}
