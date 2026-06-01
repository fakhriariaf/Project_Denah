"use server";

import { db } from "@/db";
import { projects, units, customers, vendors, projectUsers } from "@/db/schema/master";
import { bookings, kprProcesses } from "@/db/schema/marketing";
import { transactions, payments } from "@/db/schema/finance";
import { spks, spkProgressLogs, workItems, complaints, spmbs } from "@/db/schema/production";
import { auditLogs, attachments } from "@/db/schema/system";
import { user as userTable, vendorProfiles } from "@/db/schema/auth";
import { requireAuth, getSessionRole } from "../permissions";
import { eq, and, or, desc, sql, count, sum, gte, lte, inArray, ne } from "drizzle-orm";

/**
 * Fetch consolidated statistics for the executive dashboard
 */
export async function getExecutiveOverviewData() {
  await requireAuth();

  const now = new Date();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // 1. Project & Unit counts via SQL COUNT aggregation — no full-table fetch
  const [{ totalProjects }] = await db
    .select({ totalProjects: count() })
    .from(projects);

  const [{ totalUnits }] = await db
    .select({ totalUnits: count() })
    .from(units);

  // 1b. Unit status distribution via GROUP BY — single query, no JS loop
  const unitStatusRows = await db
    .select({
      status: units.status,
      isReadyStock: units.isReadyStock,
      cnt: count(),
    })
    .from(units)
    .groupBy(units.status, units.isReadyStock);

  const unitStatusDistribution: Record<string, number> = {
    belum_siap: 0,
    available: 0,
    available_ready: 0,
    booking: 0,
    kpr_process: 0,
    payment_pending: 0,
    sold: 0,
    construction: 0,
    construction_ready: 0,
    construction_done: 0,
    overdue: 0,
    cancelled: 0,
  };
  for (const row of unitStatusRows) {
    let key = row.status as string;
    if (row.status === "available" && row.isReadyStock) {
      key = "available_ready";
    } else if (row.status === "construction" && row.isReadyStock) {
      key = "construction_ready";
    }
    if (key in unitStatusDistribution) {
      unitStatusDistribution[key] = row.cnt;
    }
  }

  // 2. Financial totals via SQL SUM — no full-table fetch
  const [incomeRow] = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(and(eq(transactions.type, "income"), eq(transactions.approvalStatus, "not_required")));

  const [expenseRow] = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(and(eq(transactions.type, "expense"), eq(transactions.approvalStatus, "approved")));

  const totalIncome = Number(incomeRow?.total ?? 0);
  const totalExpense = Number(expenseRow?.total ?? 0);
  const cashBalance = totalIncome - totalExpense;

  // 3. SPK status counts via GROUP BY — single query
  const spkStatusRows = await db
    .select({ status: spks.status, cnt: count() })
    .from(spks)
    .groupBy(spks.status);

  const spkMap: Record<string, number> = {};
  for (const row of spkStatusRows) spkMap[row.status] = row.cnt;
  const totalSpks = Object.values(spkMap).reduce((a, b) => a + b, 0);
  const activeSpks = (spkMap["active"] ?? 0) + (spkMap["proses_konstruksi"] ?? 0);
  const overdueSpks = spkMap["overdue"] ?? 0;
  const completedSpks = (spkMap["completed"] ?? 0) + (spkMap["selesai_konstruksi"] ?? 0);

  // 4. Pending approvals via SQL COUNT — no full-table fetch
  const [pendingTrxRow] = await db
    .select({ cnt: count() })
    .from(transactions)
    .where(and(eq(transactions.type, "expense"), eq(transactions.approvalStatus, "pending")));

  const [pendingPayRow] = await db
    .select({ cnt: count() })
    .from(payments)
    .where(eq(payments.status, "pending"));

  const pendingApprovalsCount = (pendingTrxRow?.cnt ?? 0) + (pendingPayRow?.cnt ?? 0);

  // 5a. Monthly Cash Flow — aggregate per month via SQL (last 6 months range)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const sixMonthsAgoMs = sixMonthsAgo.getTime();

  const monthlyIncomeRows = await db
    .select({
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, "income"),
        eq(transactions.approvalStatus, "not_required"),
        gte(transactions.transactionDate, sixMonthsAgo)
      )
    );

  const monthlyExpenseRows = await db
    .select({
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, "expense"),
        eq(transactions.approvalStatus, "approved"),
        gte(transactions.transactionDate, sixMonthsAgo)
      )
    );

  const monthlyCashFlow: Array<{ name: string; Inflow: number; Outflow: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthIdx = d.getMonth();
    const year = d.getFullYear();
    const label = `${monthNames[monthIdx]} ${year.toString().slice(-2)}`;

    const inflow = monthlyIncomeRows
      .filter((t) => t.transactionDate.getMonth() === monthIdx && t.transactionDate.getFullYear() === year)
      .reduce((s, t) => s + t.amount, 0);

    const outflow = monthlyExpenseRows
      .filter((t) => t.transactionDate.getMonth() === monthIdx && t.transactionDate.getFullYear() === year)
      .reduce((s, t) => s + t.amount, 0);

    monthlyCashFlow.push({ name: label, Inflow: inflow, Outflow: outflow });
  }

  // 5b. Unit Status Distribution dataset for charts
  const statusLabels: Record<string, string> = {
    belum_siap: "Belum Siap",
    available: "Tersedia",
    available_ready: "Tersedia - Ready Stock",
    booking: "Booking",
    kpr_process: "Proses KPR",
    payment_pending: "Pending Bayar",
    sold: "Terjual",
    construction: "Proses Bangun",
    construction_ready: "Proses Bangun - Ready Stock",
    construction_done: "Selesai Bangun",
    overdue: "Overdue",
    cancelled: "Batal",
  };
  const statusDataset = Object.entries(unitStatusDistribution).map(([key, cnt]) => ({
    name: statusLabels[key] || key,
    Jumlah: cnt,
  }));

  // 6. Recent Audit Logs (limit 5)
  const recentLogs = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      module: auditLogs.module,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      userName: userTable.name,
    })
    .from(auditLogs)
    .leftJoin(userTable, eq(auditLogs.userId, userTable.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(5);

  // Fetch active complaints (open / in_progress) joined with units, projects, customers
  const activeComplaints = await db
    .select({
      id: complaints.id,
      complaintNumber: complaints.complaintNumber,
      category: complaints.category,
      description: complaints.description,
      status: complaints.status,
      createdAt: complaints.createdAt,
      unitCode: units.code,
      projectName: projects.name,
      projectId: projects.id,
      customerName: customers.name,
    })
    .from(complaints)
    .innerJoin(units, eq(complaints.unitId, units.id))
    .innerJoin(projects, eq(units.projectId, projects.id))
    .innerJoin(customers, eq(complaints.customerId, customers.id))
    .where(inArray(complaints.status, ["open", "in_progress"]))
    .orderBy(desc(complaints.createdAt));

  return {
    totalProjects,
    totalUnits,
    unitStatusDistribution,
    totalIncome,
    totalExpense,
    cashBalance,
    totalSpks,
    activeSpks,
    overdueSpks,
    completedSpks,
    pendingApprovalsCount,
    monthlyCashFlow,
    statusDataset,
    recentLogs: recentLogs.map((log) => ({
      id: log.id,
      action: log.action,
      module: log.module,
      details: log.details || {},
      createdAt: log.createdAt,
      userName: log.userName || "System",
    })),
    activeComplaints: activeComplaints.map((ac) => ({
      id: ac.id,
      complaintNumber: ac.complaintNumber,
      category: ac.category,
      description: ac.description,
      status: ac.status,
      createdAt: ac.createdAt,
      unitCode: ac.unitCode,
      projectName: ac.projectName,
      projectId: ac.projectId,
      customerName: ac.customerName,
    })),
  };
}

/**
 * Fetch detailed sales metrics reports
 */
export async function getSalesReportsData(projectId?: string, status?: string) {
  await requireAuth();

  // Build SQL WHERE conditions — filter in DB, not in JS
  const conditions = [];
  if (projectId && projectId !== "all") {
    conditions.push(eq(bookings.projectId, projectId));
  }
  if (status) {
    conditions.push(eq(bookings.status, status as "active" | "completed" | "cancelled"));
  }

  const query = db
    .select({
      booking: bookings,
      project: projects,
      unit: units,
      customer: customers,
    })
    .from(bookings)
    .innerJoin(projects, eq(bookings.projectId, projects.id))
    .innerJoin(units, eq(bookings.unitId, units.id))
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .orderBy(desc(bookings.createdAt));

  const results = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

  return results.map((r) => ({
    id: r.booking.id,
    bookingNumber: r.booking.bookingNumber,
    projectName: r.project.name,
    unitCode: r.unit.code,
    customerName: r.customer.name,
    customerPhone: r.customer.phone || "-",
    bookingDate: r.booking.bookingDate.toLocaleDateString("id-ID"),
    bookingFee: r.booking.bookingFee,
    dpAmount: r.booking.dpAmount,
    paymentScheme: r.booking.paymentScheme === "kpr" ? "KPR Bank" : r.booking.paymentScheme === "installment" ? "Cash Bertahap" : "Cash Keras",
    status: r.booking.status === "active" ? "Aktif" : r.booking.status === "completed" ? "Selesai" : "Batal",
  }));
}

/**
 * Fetch detailed general ledger statement report
 */
export async function getFinanceReportsData(projectId?: string, type?: "income" | "expense") {
  await requireAuth();

  // Build SQL WHERE conditions — filter in DB, not in JS
  const conditions = [];
  if (projectId && projectId !== "all") {
    conditions.push(eq(transactions.projectId, projectId));
  }
  if (type) {
    conditions.push(eq(transactions.type, type));
  }

  const query = db
    .select({
      transaction: transactions,
      project: projects,
    })
    .from(transactions)
    .innerJoin(projects, eq(transactions.projectId, projects.id))
    .orderBy(desc(transactions.createdAt));

  const results = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

  return results.map((r) => ({
    id: r.transaction.id,
    transactionNumber: r.transaction.transactionNumber,
    projectName: r.project.name,
    type: r.transaction.type === "income" ? "Masuk" : "Keluar",
    description: r.transaction.description,
    amount: r.transaction.amount,
    transactionDate: r.transaction.transactionDate.toLocaleDateString("id-ID"),
    paymentMethod: r.transaction.paymentMethod,
    approvalStatus: r.transaction.approvalStatus === "approved" ? "Disetujui" : r.transaction.approvalStatus === "pending" ? "Pending" : r.transaction.approvalStatus === "rejected" ? "Ditolak" : "Tanpa Otorisasi",
  }));
}

/**
 * Fetch detailed construction performance and SPK reports
 */
export async function getProductionReportsData(projectId?: string, status?: string) {
  await requireAuth();

  // Build SQL WHERE conditions — filter in DB, not in JS
  const conditions = [];
  if (projectId && projectId !== "all") {
    conditions.push(eq(spks.projectId, projectId));
  }
  if (status) {
    conditions.push(eq(spks.status, status as any));
  }

  const query = db
    .select({
      spk: spks,
      project: projects,
      unit: units,
      vendor: vendors,
    })
    .from(spks)
    .innerJoin(projects, eq(spks.projectId, projects.id))
    .innerJoin(units, eq(spks.unitId, units.id))
    .innerJoin(vendors, eq(spks.vendorId, vendors.id))
    .orderBy(desc(spks.createdAt));

  const results = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

  return results.map((r) => ({
    id: r.spk.id,
    spkNumber: r.spk.spkNumber,
    projectName: r.project.name,
    unitCode: r.unit.code,
    vendorName: r.vendor.name,
    title: r.spk.title,
    rabAmount: r.spk.rabAmount,
    progressPct: r.spk.progressPct,
    startDate: r.spk.startDate.toLocaleDateString("id-ID"),
    targetEndDate: r.spk.targetEndDate.toLocaleDateString("id-ID"),
    status: r.spk.status === "draft" ? "Draft" : r.spk.status === "active" ? "Aktif" : r.spk.status === "proses_konstruksi" ? "Proses Konstruksi" : r.spk.status === "selesai_konstruksi" || r.spk.status === "completed" ? "Selesai Konstruksi" : r.spk.status === "overdue" ? "Overdue / Terlambat" : "Batal",
  }));
}

/**
 * Fetch detailed unit and siteplan status reports
 */
export async function getUnitReportsData(projectId?: string, status?: string) {
  await requireAuth();

  // Build SQL WHERE conditions — filter in DB, not in JS
  const conditions = [];
  if (projectId && projectId !== "all") {
    conditions.push(eq(units.projectId, projectId));
  }
  if (status) {
    conditions.push(eq(units.status, status as "available" | "booking" | "kpr_process" | "payment_pending" | "sold" | "construction" | "construction_done" | "overdue" | "cancelled"));
  }

  const query = db
    .select({
      unit: units,
      project: projects,
    })
    .from(units)
    .innerJoin(projects, eq(units.projectId, projects.id))
    .orderBy(desc(units.createdAt));

  const results = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

  const statusLabels: Record<string, string> = {
    available: "Tersedia",
    booking: "Booking",
    kpr_process: "Proses KPR",
    payment_pending: "Pending Bayar",
    sold: "Terjual",
    construction: "Proses Bangun",
    construction_done: "Selesai Bangun",
    overdue: "Overdue",
    cancelled: "Batal",
  };

  return results.map((r) => ({
    id: r.unit.id,
    code: r.unit.code,
    block: r.unit.code.includes("-") ? r.unit.code.split("-")[0] : (r.unit.code.match(/^[A-Za-z]+/) ? r.unit.code.match(/^[A-Za-z]+/)?.[0] : "-") || "-",
    cluster: r.unit.cluster || "-",
    price: r.unit.price,
    status: statusLabels[r.unit.status] || r.unit.status,
    projectName: r.project.name,
  }));
}

/**
 * Fetch dashboard data for Vendor / Contractor Portal
 */
export async function getVendorDashboardData() {
  const activeUser = await requireAuth();
  const userId = activeUser.id;

  // 1. Get vendor profile mapping
  const [vendorProfile] = await db
    .select()
    .from(vendorProfiles)
    .where(eq(vendorProfiles.userId, userId))
    .limit(1);

  if (!vendorProfile || !vendorProfile.vendorId) {
    return {
      vendorProfile: vendorProfile || null,
      metrics: { activeSpks: 0, unitsBuilding: 0, needUpdate: 0, overdueSpks: 0, readyBast: 0 },
      spks: [],
      recentLogs: [],
      complaints: [],
      basts: [],
    };
  }

  const vendorId = vendorProfile.vendorId;
  const now = new Date();

  // 2. Fetch all SPKs for this vendor
  const vendorSpks = await db
    .select({
      spk: spks,
      project: projects,
      unit: units,
    })
    .from(spks)
    .innerJoin(projects, eq(spks.projectId, projects.id))
    .innerJoin(units, eq(spks.unitId, units.id))
    .where(eq(spks.vendorId, vendorId))
    .orderBy(desc(spks.createdAt));

  const spkIds = vendorSpks.map(vs => vs.spk.id);

  // 3. Fetch progress logs
  let recentLogs: any[] = [];
  if (spkIds.length > 0) {
    recentLogs = await db
      .select({
        log: spkProgressLogs,
        spk: spks,
        workItemName: workItems.name,
        creatorName: userTable.name,
      })
      .from(spkProgressLogs)
      .innerJoin(spks, eq(spkProgressLogs.spkId, spks.id))
      .leftJoin(workItems, eq(spkProgressLogs.workItemId, workItems.id))
      .leftJoin(userTable, eq(spkProgressLogs.createdBy, userTable.id))
      .where(inArray(spkProgressLogs.spkId, spkIds))
      .orderBy(desc(spkProgressLogs.progressDate))
      .limit(10);
  }

  // 4. Calculate latest log date per SPK for update tracking
  const latestLogPerSpk: Record<string, Date> = {};
  for (const log of recentLogs) {
    if (!latestLogPerSpk[log.log.spkId]) {
      latestLogPerSpk[log.log.spkId] = new Date(log.log.progressDate);
    }
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Metrics counts
  let activeSpksCount = 0;
  let unitsBuildingCount = 0;
  let needUpdateCount = 0;
  let overdueSpksCount = 0;

  for (const vs of vendorSpks) {
    const isOverdue = vs.spk.status === "overdue" || (vs.spk.status === "active" && new Date(vs.spk.targetEndDate) < now);
    
    if (vs.spk.status === "active") {
      activeSpksCount++;
    }
    
    if (vs.unit.status === "construction" && (vs.spk.status === "active" || vs.spk.status === "overdue")) {
      unitsBuildingCount++;
    }
    
    if (isOverdue) {
      overdueSpksCount++;
    }

    if (vs.spk.status === "active" && vs.spk.progressPct < 100) {
      const lastDate = latestLogPerSpk[vs.spk.id];
      if (!lastDate || lastDate < sevenDaysAgo) {
        needUpdateCount++;
      }
    }
  }

  // 5. Fetch BAST attachments & calculate status
  let bastAttachments: any[] = [];
  if (spkIds.length > 0) {
    bastAttachments = await db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.entityType, "bast_vendor_to_developer"),
          inArray(attachments.entityId, spkIds)
        )
      );
  }
  
  const bastMap: Record<string, any> = {};
  for (const att of bastAttachments) {
    bastMap[att.entityId] = att;
  }

  const basts = vendorSpks
    .filter(vs => vs.spk.progressPct === 100)
    .map(vs => {
      const attachment = bastMap[vs.spk.id];
      let statusText = "Belum Diajukan";
      let statusCode = "not_submitted";
      
      if (attachment) {
        if (vs.unit.status === "available" || vs.spk.status === "completed" || vs.unit.isReadyStock) {
          statusText = vs.unit.currentCustomerId ? "Approved" : "Approved (Ready Stock)";
          statusCode = "approved";
        } else {
          statusText = "Menunggu Approval";
          statusCode = "pending";
        }
      }
      
      return {
        spkId: vs.spk.id,
        spkNumber: vs.spk.spkNumber,
        unitCode: vs.unit.code,
        projectName: vs.project.name,
        statusText,
        statusCode,
        attachmentId: attachment?.id || null,
        attachmentUrl: attachment?.fileUrl || null,
        attachmentName: attachment?.fileName || null,
        uploadedAt: attachment?.createdAt || null,
      };
    });

  const readyBastCount = basts.filter(b => b.statusCode !== "approved").length;

  // 6. Fetch complaints on units assigned to this vendor
  const activeComplaints = await db
    .select({
      complaint: complaints,
      unit: units,
      customer: customers,
      project: projects,
    })
    .from(complaints)
    .leftJoin(units, eq(complaints.unitId, units.id))
    .leftJoin(projects, eq(complaints.projectId, projects.id))
    .leftJoin(customers, eq(complaints.customerId, customers.id))
    .where(
      and(
        eq(complaints.vendorId, vendorId),
        eq(complaints.complaintType, "vendor_to_supervisor"),
        inArray(complaints.status, ["open", "in_progress", "in_review", "need_revision", "approved_extension"])
      )
    )
    .orderBy(desc(complaints.createdAt));

  return {
    vendorProfile,
    metrics: {
      activeSpks: activeSpksCount,
      unitsBuilding: unitsBuildingCount,
      needUpdate: needUpdateCount,
      overdueSpks: overdueSpksCount,
      readyBast: readyBastCount,
    },
    spks: vendorSpks.map(vs => ({
      id: vs.spk.id,
      spkNumber: vs.spk.spkNumber,
      title: vs.spk.title,
      projectName: vs.project.name,
      unitId: vs.unit.id,
      unitCode: vs.unit.code,
      currentCustomerId: vs.unit.currentCustomerId,
      progressPct: vs.spk.progressPct,
      startDate: vs.spk.startDate,
      targetEndDate: vs.spk.targetEndDate,
      status: vs.spk.status,
    })),
    recentLogs: recentLogs.map(rl => ({
      id: rl.log.id,
      spkNumber: rl.spk.spkNumber,
      workItemName: rl.workItemName || "Pekerjaan Umum",
      percentageAdded: rl.log.percentageAdded,
      currentTotalPct: rl.log.currentTotalPct,
      progressDate: rl.log.progressDate,
      notes: rl.log.notes,
      creatorName: rl.creatorName || "Staff",
    })),
    complaints: activeComplaints.map(ac => ({
      id: ac.complaint.id,
      complaintNumber: ac.complaint.complaintNumber,
      customerName: ac.customer?.name || "-",
      unitCode: ac.unit?.code || "-",
      projectName: ac.project?.name || "-",
      category: ac.complaint.category,
      description: ac.complaint.description,
      status: ac.complaint.status,
      createdAt: ac.complaint.createdAt,
    })),
    basts,
  };
}

/**
 * Fetch dashboard data for Field Supervisor / Pengawas Lapangan Portal
 */
export async function getFieldSupervisorDashboardData() {
  const activeUser = await requireAuth();
  const userId = activeUser.id;
  const roleInfo = await getSessionRole(userId);

  const now = new Date();

  // 1. Resolve project IDs assigned to this supervisor
  let projectIds: string[] = [];
  if (roleInfo.isSuperAdmin || roleInfo.isAdminKantor) {
    const allProjs = await db.select({ id: projects.id }).from(projects);
    projectIds = allProjs.map(p => p.id);
  } else {
    const supervisorProjects = await db
      .select({ projectId: projectUsers.projectId })
      .from(projectUsers)
      .where(eq(projectUsers.userId, userId));
    projectIds = supervisorProjects.map(sp => sp.projectId);
  }

  if (projectIds.length === 0) {
    return {
      metrics: { activeSpks: 0, unitsBuilding: 0, recentProgress: 0, overdueSpks: 0, pendingBast: 0 },
      spks: [],
      recentLogs: [],
      vendorComplaints: [],
      customerComplaints: [],
      basts: [],
      projects: [],
    };
  }

  // 2. Fetch all SPKs in supervisor projects
  const supervisorSpks = await db
    .select({
      spk: spks,
      project: projects,
      unit: units,
      vendor: vendors,
    })
    .from(spks)
    .innerJoin(projects, eq(spks.projectId, projects.id))
    .innerJoin(units, eq(spks.unitId, units.id))
    .innerJoin(vendors, eq(spks.vendorId, vendors.id))
    .where(inArray(spks.projectId, projectIds))
    .orderBy(desc(spks.createdAt));

  const spkIds = supervisorSpks.map(vs => vs.spk.id);

  // 3. Fetch progress logs
  let recentLogs: any[] = [];
  if (spkIds.length > 0) {
    recentLogs = await db
      .select({
        log: spkProgressLogs,
        spk: spks,
        unitCode: units.code,
        projectName: projects.name,
        workItemName: workItems.name,
        creatorName: userTable.name,
        vendorName: vendors.name,
      })
      .from(spkProgressLogs)
      .innerJoin(spks, eq(spkProgressLogs.spkId, spks.id))
      .innerJoin(units, eq(spks.unitId, units.id))
      .innerJoin(projects, eq(spks.projectId, projects.id))
      .leftJoin(vendors, eq(spks.vendorId, vendors.id))
      .leftJoin(workItems, eq(spkProgressLogs.workItemId, workItems.id))
      .leftJoin(userTable, eq(spkProgressLogs.createdBy, userTable.id))
      .where(inArray(spkProgressLogs.spkId, spkIds))
      .orderBy(desc(spkProgressLogs.progressDate))
      .limit(10);
  }

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const recentProgressCount = recentLogs.filter(l => new Date(l.log.progressDate) >= threeDaysAgo).length;

  // 4. Calculate metrics
  let activeSpksCount = 0;
  let unitsBuildingCount = 0;
  let overdueSpksCount = 0;

  for (const vs of supervisorSpks) {
    const isOverdue = vs.spk.status === "overdue" || (vs.spk.status === "active" && new Date(vs.spk.targetEndDate) < now);
    
    if (vs.spk.status === "active" || vs.spk.status === "overdue") {
      activeSpksCount++;
    }
    
    if ((vs.unit.status === "construction" || vs.unit.status === "overdue") && (vs.spk.status === "active" || vs.spk.status === "overdue")) {
      unitsBuildingCount++;
    }
    
    if (isOverdue) {
      overdueSpksCount++;
    }
  }

  // 5. Fetch BAST attachments & status
  let bastAttachments: any[] = [];
  if (spkIds.length > 0) {
    bastAttachments = await db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.entityType, "bast_vendor_to_developer"),
          inArray(attachments.entityId, spkIds)
        )
      );
  }
  
  const bastMap: Record<string, any> = {};
  for (const att of bastAttachments) {
    bastMap[att.entityId] = att;
  }

  const basts = supervisorSpks
    .filter(vs => vs.spk.progressPct === 100)
    .map(vs => {
      const attachment = bastMap[vs.spk.id];
      let statusText = "Belum Diajukan";
      let statusCode = "not_submitted";
      
      if (attachment) {
        if (vs.unit.status === "available" || vs.spk.status === "completed" || vs.unit.isReadyStock) {
          statusText = vs.unit.currentCustomerId ? "Approved" : "Approved (Ready Stock)";
          statusCode = "approved";
        } else {
          statusText = "Menunggu Approval";
          statusCode = "pending";
        }
      }
      
      return {
        spkId: vs.spk.id,
        spkNumber: vs.spk.spkNumber,
        unitId: vs.unit.id,
        unitCode: vs.unit.code,
        projectName: vs.project.name,
        vendorName: vs.vendor.name,
        statusText,
        statusCode,
        attachmentId: attachment?.id || null,
        attachmentUrl: attachment?.fileUrl || null,
        attachmentName: attachment?.fileName || null,
        uploadedAt: attachment?.createdAt || null,
        currentCustomerId: vs.unit.currentCustomerId,
      };
    });

  const pendingBastCount = basts.filter(b => b.statusCode === "pending").length;

  // 6. Fetch active complaints in supervisor projects (split by type)
  let vendorComplaints: any[] = [];
  let customerComplaints: any[] = [];
  if (projectIds.length > 0) {
    vendorComplaints = await db
      .select({
        complaint: complaints,
        unit: units,
        customer: customers,
        project: projects,
        spk: spks,
      })
      .from(complaints)
      .leftJoin(units, eq(complaints.unitId, units.id))
      .leftJoin(projects, eq(sql`coalesce(${complaints.projectId}, ${units.projectId})`, projects.id))
      .leftJoin(customers, eq(complaints.customerId, customers.id))
      .leftJoin(spks, eq(complaints.spkId, spks.id))
      .where(
        and(
          eq(complaints.complaintType, "vendor_to_supervisor"),
          inArray(sql`coalesce(${complaints.projectId}, ${units.projectId})`, projectIds),
          inArray(complaints.status, ["open", "in_progress", "in_review", "need_revision", "approved_extension"])
        )
      )
      .orderBy(desc(complaints.createdAt));

    customerComplaints = await db
      .select({
        complaint: complaints,
        unit: units,
        customer: customers,
        project: projects,
      })
      .from(complaints)
      .leftJoin(units, eq(complaints.unitId, units.id))
      .leftJoin(projects, eq(sql`coalesce(${complaints.projectId}, ${units.projectId})`, projects.id))
      .leftJoin(customers, eq(complaints.customerId, customers.id))
      .where(
        and(
          eq(complaints.complaintType, "customer_to_developer"),
          inArray(sql`coalesce(${complaints.projectId}, ${units.projectId})`, projectIds),
          inArray(complaints.status, ["open", "in_progress", "follow_up_required", "waiting_customer_confirmation"])
        )
      )
      .orderBy(desc(complaints.createdAt));
  }

  // 7. Get projects assigned
  const projectsList = await db
    .select()
    .from(projects)
    .where(inArray(projects.id, projectIds));

  return {
    metrics: {
      activeSpks: activeSpksCount,
      unitsBuilding: unitsBuildingCount,
      recentProgress: recentProgressCount,
      overdueSpks: overdueSpksCount,
      pendingBast: pendingBastCount,
    },
    spks: supervisorSpks.map(vs => ({
      id: vs.spk.id,
      spkNumber: vs.spk.spkNumber,
      title: vs.spk.title,
      projectName: vs.project.name,
      unitId: vs.unit.id,
      unitCode: vs.unit.code,
      currentCustomerId: vs.unit.currentCustomerId,
      vendorName: vs.vendor.name,
      progressPct: vs.spk.progressPct,
      startDate: vs.spk.startDate,
      targetEndDate: vs.spk.targetEndDate,
      status: vs.spk.status,
    })),
    recentLogs: recentLogs.map(rl => ({
      id: rl.log.id,
      spkNumber: rl.spk.spkNumber,
      unitCode: rl.unitCode,
      projectName: rl.projectName,
      workItemName: rl.workItemName || "Pekerjaan Umum",
      percentageAdded: rl.log.percentageAdded,
      currentTotalPct: rl.log.currentTotalPct,
      progressDate: rl.log.progressDate,
      notes: rl.log.notes,
      creatorName: rl.creatorName || "Staff",
      vendorName: rl.vendorName || "Kontraktor",
    })),
    vendorComplaints: vendorComplaints.map(ac => ({
      id: ac.complaint.id,
      complaintNumber: ac.complaint.complaintNumber,
      customerName: ac.customer?.name || "-",
      unitCode: ac.unit?.code || "-",
      projectName: ac.project?.name || "-",
      category: ac.complaint.category,
      description: ac.complaint.description,
      status: ac.complaint.status,
      createdAt: ac.complaint.createdAt,
      spkId: ac.complaint.spkId,
      spkNumber: ac.spk?.spkNumber || "-",
      spkTitle: ac.spk?.title || "-",
      spkTargetEndDate: ac.spk?.targetEndDate || null,
    })),
    customerComplaints: customerComplaints.map(ac => ({
      id: ac.complaint.id,
      complaintNumber: ac.complaint.complaintNumber,
      customerName: ac.customer?.name || "-",
      unitCode: ac.unit?.code || "-",
      projectName: ac.project?.name || "-",
      category: ac.complaint.category,
      description: ac.complaint.description,
      status: ac.complaint.status,
      createdAt: ac.complaint.createdAt,
    })),
    basts,
    projects: projectsList,
  };
}

