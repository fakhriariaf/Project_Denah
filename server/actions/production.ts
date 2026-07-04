"use server";

import { db } from "@/db";
import {
  workItems,
  spks,
  spmbs,
  spkWorkItemWeights,
  spkProgressLogs,
  materialRequests,
  handoverEstimations,
  complaints,
} from "@/db/schema/production";
import { units, projects, customers, vendors, unitStatusHistories, financeAccounts, financeCategories } from "@/db/schema/master";
import { invoices as invoicesTable } from "@/db/schema/finance";
import { bookings as bookingsTable, customerDocuments } from "@/db/schema/marketing";
import { transactions } from "@/db/schema/finance";
import { user as userTable, vendorProfiles } from "@/db/schema/auth";
import { attachments } from "@/db/schema/system";
import { getCurrentUser, requireAuth, requireAnyRole, getSessionRole } from "@/server/permissions";
import { eq, ne, and, desc, sql, sum, lt, isNotNull, or, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { writeAuditLog, safeWriteBlockedTransitionLog } from "./audit";
import { createNotification, notifyUsersWithRoles } from "./notification";
import { applyRateLimit } from "@/server/middleware/apply-rate-limit";
import {
  spkSchema,
  spmbSchema,
  progressInputSchema,
  materialRequestSchema,
  handoverEstimationSchema,
  complaintSchema,
  vendorComplaintSchema,
  reviewVendorComplaintSchema,
  customerComplaintSchema,
  resolveCustomerComplaintSchema,
  spkUpdateSchema,
} from "../validators/production";

// ==========================================
// 1. SURAT PERINTAH KERJA (SPK) & SPMB
// ==========================================

// Get progress photos (with attachment URLs) for all units in a project
// Used by the siteplan viewer to show real construction photos in the gallery
export async function getProgressPhotosForProject(projectId: string) {
  await requireAuth();

  // BUG 8 FIX: The OR join condition caused duplicate rows when a log had both
  // photoAttachmentId AND a matching entityId/entityType attachment record.
  // Fix: use only the direct photoAttachmentId join for the main gallery query.
  // The entityId/entityType path is only used for getSpkDetails detail view.
  const rows = await db
    .select({
      unitId: spks.unitId,
      workItemName: workItems.name,
      progressDate: spkProgressLogs.progressDate,
      notes: spkProgressLogs.notes,
      fileUrl: attachments.fileUrl,
      fileName: attachments.fileName,
    })
    .from(spkProgressLogs)
    .innerJoin(spks, eq(spkProgressLogs.spkId, spks.id))
    .innerJoin(workItems, eq(spkProgressLogs.workItemId, workItems.id))
    .innerJoin(
      attachments,
      eq(spkProgressLogs.photoAttachmentId, attachments.id)
    )
    .where(eq(spks.projectId, projectId))
    .orderBy(desc(spkProgressLogs.progressDate));

  // Group by unitId
  const grouped: Record<string, Array<{
    workItemName: string;
    progressDate: Date;
    notes: string | null;
    fileUrl: string;
    fileName: string;
  }>> = {};

  for (const row of rows) {
    if (!grouped[row.unitId]) grouped[row.unitId] = [];
    grouped[row.unitId].push({
      workItemName: row.workItemName,
      progressDate: row.progressDate,
      notes: row.notes,
      fileUrl: row.fileUrl,
      fileName: row.fileName,
    });
  }

  return grouped;
}

export async function getSpks(projectId?: string) {

  await requireAuth();

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

  if (projectId) {
    return query.where(eq(spks.projectId, projectId));
  }

  return query;
}

export async function getSpkDetails(spkId: string) {
  await requireAuth();

  const results = await db
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
    .where(eq(spks.id, spkId))
    .limit(1);

  if (results.length === 0) return null;

  // Get work items weights
  const weights = await db
    .select({
      weight: spkWorkItemWeights,
      workItem: workItems,
    })
    .from(spkWorkItemWeights)
    .innerJoin(workItems, eq(spkWorkItemWeights.workItemId, workItems.id))
    .where(eq(spkWorkItemWeights.spkId, spkId));

  // Get progress logs
  const logsRaw = await db
    .select({
      log: spkProgressLogs,
      workItem: workItems,
    })
    .from(spkProgressLogs)
    .innerJoin(workItems, eq(spkProgressLogs.workItemId, workItems.id))
    .where(eq(spkProgressLogs.spkId, spkId))
    .orderBy(desc(spkProgressLogs.progressDate));

  // Get all attachments associated with this SPK or these logs
  const logIds = logsRaw.map(l => l.log.id);
  let allAttachments: any[] = [];
  if (logIds.length > 0) {
    allAttachments = await db
      .select()
      .from(attachments)
      .where(
        or(
          and(eq(attachments.entityId, spkId), eq(attachments.entityType, "spk_progress")),
          and(inArray(attachments.entityId, logIds), eq(attachments.entityType, "progress_log"))
        )
      );
  } else {
    allAttachments = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.entityId, spkId), eq(attachments.entityType, "spk_progress")));
  }

  // Map attachments to logs (can be multiple)
  const logs = logsRaw.map(row => {
    const rowAttachments = allAttachments.filter(att =>
      att.id === row.log.photoAttachmentId ||
      (att.entityId === row.log.id && att.entityType === "progress_log")
    );

    return {
      log: row.log,
      workItem: row.workItem,
      attachments: rowAttachments,
      attachment: rowAttachments[0] || null, // backwards compatibility
    };
  });

  return {
    ...results[0],
    weights,
    logs,
  };
}

export async function createSpk(data: unknown) {
  const activeUser = await requireAuth();
  applyRateLimit(activeUser.id);
  const parsed = spkSchema.parse(data);

  // ── FASE 6: DP GATE CHECK ──────────────────────────────────────────────
  // Sebelum SPK diterbitkan, wajib ada invoice DP (Uang Muka) yang sudah
  // lunas (status='paid') untuk unit ini. Ini memastikan pembayaran DP
  // sudah dikonfirmasi Admin Keuangan sebelum konstruksi dimulai.
  const targetUnit = await db
    .select({ status: units.status, currentBookingId: units.currentBookingId, isReadyStock: units.isReadyStock })
    .from(units)
    .where(eq(units.id, parsed.unitId))
    .get();

  if (targetUnit) {
    const needsDpGate = [
      "kpr_process",
      "booking",
      "construction", // edge case: re-issuance
    ].includes(targetUnit.status);

    if (targetUnit.isReadyStock) {
      // Bypass DP Gate for Ready Stock - SPK can be generated internally anytime
    } else if (needsDpGate) {
      const paidDpInvoice = await db
        .select({ id: invoicesTable.id })
        .from(invoicesTable)
        .where(
          and(
            eq(invoicesTable.unitId, parsed.unitId),
            eq(invoicesTable.type, "dp"),
            eq(invoicesTable.status, "paid")
          )
        )
        .get();

      if (!paidDpInvoice) {
        throw new Error(
          "⚠️ DP Gate: Invoice Uang Muka (DP) untuk unit ini belum berstatus LUNAS. " +
          "Admin Keuangan wajib menerbitkan dan memverifikasi invoice DP terlebih dahulu sebelum SPK dapat diterbitkan."
        );
      }
    }
  }
  // ── END DP GATE ────────────────────────────────────────────────────────

  const spkId = crypto.randomUUID();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const spkNumber = `SPK-${dateStr}-${rand}`;

  await db.transaction(async (tx) => {
    // 1. Insert SPK
    await tx.insert(spks).values({
      id: spkId,
      spkNumber,
      projectId: parsed.projectId,
      unitId: parsed.unitId,
      vendorId: parsed.vendorId,
      title: parsed.title,
      workDescription: parsed.workDescription,
      specification: parsed.specification || null,
      rabAmount: parsed.rabAmount,
      startDate: parsed.startDate,
      targetEndDate: parsed.targetEndDate,
      status: "active",
      progressPct: 0,
      createdBy: activeUser.id,
    }).run();

    // 2. Insert SPK work item weights
    if (parsed.customWeights && parsed.customWeights.length > 0) {
      for (const item of parsed.customWeights) {
        await tx.insert(spkWorkItemWeights).values({
          id: crypto.randomUUID(),
          spkId,
          workItemId: item.workItemId,
          weightPct: item.weightPct,
        }).run();
      }
    } else {
      // Fetch default active work items and assign default weights
      const defaults = await tx.select().from(workItems).where(eq(workItems.status, "active")).all();
      if (defaults.length === 0) {
        throw new Error("Pekerjaan standar (active work items) belum dikonfigurasi di Master. Silakan buat pekerjaan standar terlebih dahulu.");
      }
      for (const item of defaults) {
        await tx.insert(spkWorkItemWeights).values({
          id: crypto.randomUUID(),
          spkId,
          workItemId: item.id,
          weightPct: item.defaultWeightPct,
        }).run();
      }
    }

    // 3. Update currentSpkId in units table (keep status unchanged until construction is officially started)
    await tx.update(units).set({
      currentSpkId: spkId,
      updatedAt: new Date(),
    }).where(eq(units.id, parsed.unitId)).run();
  });

  // 5. Audit Log outside transaction
  await writeAuditLog({
    action: "create",
    module: "production",
    entityId: spkId,
    entityType: "spk",
    details: { spkNumber, title: parsed.title, rabAmount: parsed.rabAmount },
  });

  // Notify Pengawas Lapangan and Vendor
  await notifyNewSpkCreated(spkId, false);

  revalidatePath("/production/spk");
  revalidatePath("/master/units");
  revalidatePath("/siteplan");
  return { success: true, spkId };
}

export async function deleteSpk(spkId: string) {
  // Super Admin, Admin Kantor, and Admin Keuangan can delete SPKs
  const activeUser = await requireAnyRole(["Super Admin", "Admin Kantor", "Admin Keuangan"]);
  applyRateLimit(activeUser.id);

  const [spk] = await db.select().from(spks).where(eq(spks.id, spkId)).limit(1);
  if (!spk) throw new Error("SPK tidak ditemukan.");

  await db.transaction(async (tx) => {
    // 1. Reset unit associated with this SPK
    const unitResults = await tx.select().from(units).where(eq(units.id, spk.unitId)).limit(1).all();
    if (unitResults.length > 0) {
      const unit = unitResults[0];

      // BUG 7 FIX: Correctly restore unit status when SPK deleted
      // - Ready Stock: keep current status unchanged
      // - Has booking with KPR scheme: restore to "kpr_process"
      // - Has booking (non-KPR): restore to "booking"
      // - No booking: restore to "belum_siap"
      let restoredStatus: "available" | "belum_siap" | "booking" | "kpr_process" | "payment_pending" | "sold" | "construction" | "construction_done" | "overdue" | "cancelled" = "belum_siap";
      if (unit.isReadyStock) {
        restoredStatus = unit.status as any;
      } else if (unit.currentBookingId) {
        // Check if the associated booking uses KPR scheme to restore correct status
        const bookingRow = await tx
          .select({ paymentScheme: bookingsTable.paymentScheme })
          .from(bookingsTable)
          .where(eq(bookingsTable.id, unit.currentBookingId))
          .limit(1)
          .then((res) => res[0]);
        restoredStatus = bookingRow?.paymentScheme === "kpr" ? "kpr_process" : "booking";
      }

      await tx.update(units).set({
        status: restoredStatus,
        currentSpkId: null,
        constructionProgress: 0,
        updatedAt: new Date(),
      }).where(eq(units.id, spk.unitId)).run();
    }

    // 2. Delete the SPK record (cascade deletes spkWorkItemWeights, spkProgressLogs, handoverEstimations)
    await tx.delete(spks).where(eq(spks.id, spkId)).run();
  });

  await writeAuditLog({
    action: "delete",
    module: "production",
    entityId: spkId,
    entityType: "spk",
    details: { spkNumber: spk.spkNumber, title: spk.title },
  });

  revalidatePath("/production/spk");
  revalidatePath("/master/units");
  revalidatePath("/siteplan");
  return { success: true };
}

// BUG 13 FIX: Use spkUpdateSchema instead of `data: any` — validates and sanitizes input
export async function updateSpk(spkId: string, data: unknown) {
  // Super Admin, Admin Kantor, and Admin Keuangan can edit SPKs
  const activeUser = await requireAnyRole(["Super Admin", "Admin Kantor", "Admin Keuangan"]);
  applyRateLimit(activeUser.id);

  const parsed = spkUpdateSchema.parse(data);

  const [existingSpk] = await db.select().from(spks).where(eq(spks.id, spkId)).limit(1);
  if (!existingSpk) throw new Error("SPK tidak ditemukan.");

  await db.transaction(async (tx) => {
    // 1. Update SPK
    await tx.update(spks).set({
      title: parsed.title,
      workDescription: parsed.workDescription,
      specification: parsed.specification || null,
      rabAmount: parsed.rabAmount,
      startDate: parsed.startDate,
      targetEndDate: parsed.targetEndDate,
      vendorId: parsed.vendorId,
      updatedAt: new Date(),
    }).where(eq(spks.id, spkId)).run();

    // 2. Update custom weights if provided
    if (parsed.customWeights && parsed.customWeights.length > 0) {
      // Delete old weights
      await tx.delete(spkWorkItemWeights).where(eq(spkWorkItemWeights.spkId, spkId)).run();
      // Insert new weights
      for (const item of parsed.customWeights) {
        await tx.insert(spkWorkItemWeights).values({
          id: crypto.randomUUID(),
          spkId,
          workItemId: item.workItemId,
          weightPct: item.weightPct,
        }).run();
      }
    }
  });

  await writeAuditLog({
    action: "update",
    module: "production",
    entityId: spkId,
    entityType: "spk",
    details: { spkNumber: existingSpk.spkNumber, title: parsed.title },
  });

  // check if RAB is verified (was 0, now > 0)
  const isRabVerified = existingSpk.rabAmount === 0 && Number(parsed.rabAmount) > 0;
  if (isRabVerified) {
    try {
      const spkDetails = await db
        .select({
          spk: spks,
          unit: units,
          project: projects,
        })
        .from(spks)
        .innerJoin(units, eq(spks.unitId, units.id))
        .innerJoin(projects, eq(spks.projectId, projects.id))
        .where(eq(spks.id, spkId))
        .get();

      if (spkDetails) {
        // 1. Notify Pengawas Lapangan
        await notifyUsersWithRoles({
          roleNames: ["Pengawas Lapangan"],
          type: "info",
          title: "Verifikasi Nilai RAB SPK",
          message: `Nilai RAB Sudah Diverifikasi oleh ${activeUser.name} silahkan lanjutkan untuk kontruksi (Kav. ${spkDetails.unit.code} - ${spkDetails.spk.spkNumber})`,
          entityId: spkId,
          entityType: "spk",
        });

        // 2. Notify Vendor if they have a user account
        if (spkDetails.spk.vendorId) {
          const matchedVendorUser = await db
            .select({ userId: vendorProfiles.userId })
            .from(vendorProfiles)
            .where(eq(vendorProfiles.vendorId, spkDetails.spk.vendorId))
            .limit(1)
            .all();

          if (matchedVendorUser.length > 0) {
            await createNotification({
              userId: matchedVendorUser[0].userId,
              type: "info",
              title: "Verifikasi Nilai RAB SPK",
              message: `Nilai RAB Sudah Diverifikasi oleh ${activeUser.name} silahkan lanjutkan untuk kontruksi (Kav. ${spkDetails.unit.code} - ${spkDetails.spk.spkNumber})`,
              entityId: spkId,
              entityType: "spk",
            });
          }
        }
      }
    } catch (err) {
      console.error("[Notification] Failed to notify on RAB verification:", err);
    }
  }

  revalidatePath("/production/spk");
  revalidatePath("/master/units");
  revalidatePath("/siteplan");
  return { success: true };
}

export async function activateSpk(spkId: string) {
  const activeUser = await requireAuth();

  let spkNumberResult = "";
  let spmbNumberResult = "";

  await db.transaction(async (tx) => {
    const results = await tx.select().from(spks).where(eq(spks.id, spkId)).limit(1).all();
    if (results.length === 0) throw new Error("SPK tidak ditemukan");
    const spk = results[0];
    spkNumberResult = spk.spkNumber;

    if (spk.status !== "active") throw new Error("Hanya SPK berstatus Aktif yang dapat memulai konstruksi");
    if (spk.rabAmount === 0) throw new Error("Nilai RAB tidak boleh 0 untuk memulai konstruksi. Harap edit dan verifikasi nilai RAB terlebih dahulu.");

    // Update status to proses_konstruksi
    await tx.update(spks).set({
      status: "proses_konstruksi",
      updatedAt: new Date(),
    }).where(eq(spks.id, spkId)).run();

    // Update unit status to construction
    const unitResults = await tx.select().from(units).where(eq(units.id, spk.unitId)).limit(1).all();
    if (unitResults.length > 0) {
      const unit = unitResults[0];
      const oldStatus = unit.status;
      const isReadyStock = unit.isReadyStock || false;
      const newStatus = isReadyStock ? oldStatus : "construction";

      await tx.update(units).set({
        status: newStatus,
        updatedAt: new Date(),
      }).where(eq(units.id, spk.unitId)).run();

      if (newStatus !== oldStatus) {
        await tx.insert(unitStatusHistories).values({
          id: crypto.randomUUID(),
          unitId: spk.unitId,
          previousStatus: oldStatus,
          newStatus: newStatus,
          reason: `Konstruksi fisik dimulai, SPK: ${spk.spkNumber}`,
          changedBy: activeUser.id,
          changedAt: new Date(),
        }).run();
      }
    }

    // Generate matching SPMB command automatically
    const spmbId = crypto.randomUUID();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    const spmbNumber = `SPMB-${dateStr}-${rand}`;
    spmbNumberResult = spmbNumber;

    await tx.insert(spmbs).values({
      id: spmbId,
      spmbNumber,
      spkId,
      issueDate: new Date(),
      startWorkDate: spk.startDate,
      targetEndDate: spk.targetEndDate,
      status: "active",
      notes: `Terbit otomatis dari mulai konstruksi SPK ${spk.spkNumber}`,
      createdBy: activeUser.id,
    }).run();
  });

  // Write Audit Log outside transaction
  await writeAuditLog({
    action: "update",
    module: "production",
    entityId: spkId,
    entityType: "spk",
    details: { spkNumber: spkNumberResult, status: "proses_konstruksi", spmbNumber: spmbNumberResult },
  });

  // Notify vendor if they have a user account
  try {
    const spkDetails = await getSpkDetails(spkId);
    if (spkDetails && spkDetails.vendor) {
      const matchedVendorUser = await db
        .select({ userId: vendorProfiles.userId })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.vendorId, spkDetails.spk.vendorId))
        .limit(1);

      if (matchedVendorUser.length > 0) {
        await createNotification({
          userId: matchedVendorUser[0].userId,
          type: "info",
          title: "Mulai Konstruksi SPK",
          message: `Surat Perintah Kerja ${spkDetails.spk.spkNumber} untuk "${spkDetails.spk.title}" telah memasuki proses konstruksi. Silakan mulai pengerjaan fisik.`,
          entityId: spkId,
          entityType: "spk",
        });
      }
    }
  } catch (err) {
    console.warn("Failed to notify vendor of SPK construction start:", err);
  }

  revalidatePath("/production/spk");
  revalidatePath("/production/progress");
  revalidatePath("/master/units");
  revalidatePath("/siteplan");
  return { success: true };
}

export async function getSpmbs(spkId?: string) {
  await requireAuth();

  const query = db
    .select({
      spmb: spmbs,
      spk: spks,
      project: projects,
      unit: units,
    })
    .from(spmbs)
    .innerJoin(spks, eq(spmbs.spkId, spks.id))
    .innerJoin(projects, eq(spks.projectId, projects.id))
    .innerJoin(units, eq(spks.unitId, units.id))
    .orderBy(desc(spmbs.createdAt));

  if (spkId) {
    return query.where(eq(spmbs.spkId, spkId));
  }

  return query;
}

// ==========================================
// 2. PROGRESS LOGGING & CALCULATIONS
// ==========================================

export async function inputProgress(data: unknown) {
  const activeUser = await requireAuth();
  applyRateLimit(activeUser.id);
  const parsed = progressInputSchema.parse(data);

  let progressLogIdResult = "";
  let spkNumberResult = "";
  let finalOverallPctResult = 0;

  await db.transaction(async (tx) => {
    // 1. Get SPK details
    const spkResults = await tx.select().from(spks).where(eq(spks.id, parsed.spkId)).limit(1).all();
    if (spkResults.length === 0) throw new Error("SPK tidak ditemukan");
    const spk = spkResults[0];
    spkNumberResult = spk.spkNumber;

    // 2. Fetch specific work item weight for this SPK
    const weightResults = await tx.select()
      .from(spkWorkItemWeights)
      .where(and(eq(spkWorkItemWeights.spkId, parsed.spkId), eq(spkWorkItemWeights.workItemId, parsed.workItemId)))
      .limit(1)
      .all();
    if (weightResults.length === 0) throw new Error("Bobot pekerjaan tidak ditemukan untuk SPK ini");

    // 3. Fetch cumulative progress logs for this work item to calculate current total percentage
    const existingLogsResult = await tx.select().from(spkProgressLogs)
      .where(and(eq(spkProgressLogs.spkId, parsed.spkId), eq(spkProgressLogs.workItemId, parsed.workItemId)))
      .all();
    const previousTotal = existingLogsResult.reduce((sum, item) => sum + item.percentageAdded, 0);

    const currentTotalPct = previousTotal + parsed.percentageAdded;
    if (currentTotalPct > 100) {
      throw new Error(`Total progress pekerjaan ini melebihi 100%. Progress saat ini: ${previousTotal}%, ditambah: ${parsed.percentageAdded}%`);
    }

    // 4. Insert Progress Log
    const progressLogId = crypto.randomUUID();
    progressLogIdResult = progressLogId;
    await tx.insert(spkProgressLogs).values({
      id: progressLogId,
      spkId: parsed.spkId,
      workItemId: parsed.workItemId,
      percentageAdded: parsed.percentageAdded,
      currentTotalPct,
      progressDate: parsed.progressDate,
      photoAttachmentId: parsed.photoAttachmentId || null,
      notes: parsed.notes || null,
      createdBy: activeUser.id,
    }).run();

    // 4b. Update uploaded attachments to point to the progressLogId
    if (parsed.photoAttachmentIds && parsed.photoAttachmentIds.length > 0) {
      await tx
        .update(attachments)
        .set({
          entityId: progressLogId,
          entityType: "progress_log"
        })
        .where(inArray(attachments.id, parsed.photoAttachmentIds)).run();
    }

    // 5. Recalculate overall weighted progress percentage of the SPK
    const allWeights = await tx.select().from(spkWorkItemWeights).where(eq(spkWorkItemWeights.spkId, parsed.spkId)).all();

    // Fetch all logs for this SPK in a single database roundtrip
    const allLogs = await tx.select().from(spkProgressLogs).where(eq(spkProgressLogs.spkId, parsed.spkId)).all();

    let overallProgress = 0;
    for (const w of allWeights) {
      // Sum progress for this specific work item from the pre-fetched list
      const itemTotal = allLogs
        .filter((log) => log.workItemId === w.workItemId)
        .reduce((sum, item) => sum + item.percentageAdded, 0);

      overallProgress += (itemTotal * w.weightPct) / 100;
    }

    const finalOverallPct = Math.min(100, Math.floor(overallProgress));
    finalOverallPctResult = finalOverallPct;

    // Update progress in units table
    await tx.update(units).set({
      constructionProgress: finalOverallPct,
      updatedAt: new Date(),
    }).where(eq(units.id, spk.unitId)).run();

    // 6. Update SPK overall progress percentage
    await tx.update(spks).set({
      progressPct: finalOverallPct,
      updatedAt: new Date(),
    }).where(eq(spks.id, parsed.spkId)).run();
  });

  // 8. Audit Log outside transaction
  await writeAuditLog({
    action: "create",
    module: "production",
    entityId: progressLogIdResult,
    entityType: "progress_log",
    details: { spkNumber: spkNumberResult, percentageAdded: parsed.percentageAdded, overallProgress: finalOverallPctResult },
  });

  // Notify when overall progress reaches 100%
  try {
    const spkDetails = await getSpkDetails(parsed.spkId);
    if (spkDetails && spkDetails.spk.progressPct >= 100) {
      await notifyUsersWithRoles({
        roleNames: ["Super Admin", "Direksi / Manager", "Pengawas Lapangan"],
        type: "progress_done",
        title: "Pembangunan Unit Selesai",
        message: `Pembangunan unit kavling ${spkDetails.unit.code} untuk SPK ${spkDetails.spk.spkNumber} telah selesai 100%.`,
        entityId: spkDetails.spk.unitId,
        entityType: "unit",
      });
    }
  } catch (err) {
    console.warn("Failed to trigger construction completed notification:", err);
  }

  revalidatePath("/production/progress");
  revalidatePath("/production/spk");
  revalidatePath("/master/units");
  revalidatePath("/siteplan");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteProgressLog(logId: string) {
  const activeUser = await requireAuth();
  const roleInfo = await getSessionRole(activeUser.id);

  if (!roleInfo.isSuperAdmin && !roleInfo.isAdminKantor && !roleInfo.isPengawas) {
    throw new Error("Anda tidak memiliki wewenang untuk menghapus log progres pembangunan.");
  }

  let spkIdResult = "";
  let finalOverallPctResult = 0;

  await db.transaction(async (tx) => {
    // 1. Get the progress log details
    const [log] = await tx.select().from(spkProgressLogs).where(eq(spkProgressLogs.id, logId)).limit(1).all();
    if (!log) throw new Error("Log progres tidak ditemukan");
    spkIdResult = log.spkId;

    // 2. Get SPK details
    const [spk] = await tx.select().from(spks).where(eq(spks.id, log.spkId)).limit(1).all();
    if (!spk) throw new Error("SPK tidak ditemukan");

    // 3. Block if SPK is already officially completed
    if (spk.status === "completed" || spk.status === "selesai_konstruksi") {
      throw new Error("Log progres tidak dapat dihapus karena pembangunan sudah diselesaikan secara resmi.");
    }

    // 4. Delete associated photo attachment if exists
    if (log.photoAttachmentId) {
      await tx.delete(attachments).where(eq(attachments.id, log.photoAttachmentId)).run();
    }

    // 5. Delete the progress log
    await tx.delete(spkProgressLogs).where(eq(spkProgressLogs.id, logId)).run();

    // 6. Recalculate progress
    const allWeights = await tx.select().from(spkWorkItemWeights).where(eq(spkWorkItemWeights.spkId, log.spkId)).all();
    const allLogs = await tx.select().from(spkProgressLogs).where(eq(spkProgressLogs.spkId, log.spkId)).all();

    let overallProgress = 0;
    for (const w of allWeights) {
      const itemTotal = allLogs
        .filter((l) => l.workItemId === w.workItemId)
        .reduce((sum, item) => sum + item.percentageAdded, 0);

      overallProgress += (itemTotal * w.weightPct) / 100;
    }

    const finalOverallPct = Math.min(100, Math.floor(overallProgress));
    finalOverallPctResult = finalOverallPct;

    // 7. Update progress in units table
    await tx.update(units).set({
      constructionProgress: finalOverallPct,
      updatedAt: new Date(),
    }).where(eq(units.id, spk.unitId)).run();

    // 8. Update SPK overall progress percentage
    await tx.update(spks).set({
      progressPct: finalOverallPct,
      updatedAt: new Date(),
    }).where(eq(spks.id, log.spkId)).run();
  });

  // 9. Audit Log
  await writeAuditLog({
    action: "delete",
    module: "production",
    entityId: logId,
    entityType: "progress_log",
    details: { spkId: spkIdResult, overallProgress: finalOverallPctResult, deletedBy: activeUser.id },
  });

  revalidatePath("/production/progress");
  revalidatePath("/production/spk");
  revalidatePath("/master/units");
  revalidatePath("/siteplan");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function uploadProgressPhotoAttachment(
  spkId: string,
  data: { fileName: string; fileUrl: string; mimeType?: string; fileSize?: number }
) {
  const user = await requireAuth();

  const attachmentId = crypto.randomUUID();
  await db.insert(attachments).values({
    id: attachmentId,
    entityId: spkId,
    entityType: "spk_progress",
    fileName: data.fileName,
    fileUrl: data.fileUrl,
    mimeType: data.mimeType || "application/octet-stream",
    fileSize: data.fileSize || 0,
    uploadedBy: user.id,
    createdAt: new Date(),
  });

  await writeAuditLog({
    action: "create",
    module: "production",
    entityId: attachmentId,
    entityType: "progress_photo",
    details: { spkId, fileName: data.fileName },
  });

  return { success: true, attachmentId };
}


// ==========================================
// 3. AUTOMATED OVERDUE JOB ENGINE
// ==========================================

export async function checkOverdueSpks() {
  // Use getCurrentUser (non-redirecting) so this function works in both:
  // - Admin manual trigger (has session → logs real user)
  // - Cron job context (no session → logs as "system-cron")
  const currentUser = await getCurrentUser();
  const actorId = currentUser?.id ?? "system-cron";

  const now = new Date();
  const results = await db
    .select({
      spk: spks,
      unit: units,
    })
    .from(spks)
    .innerJoin(units, eq(spks.unitId, units.id))
    .where(
      and(
        or(eq(spks.status, "active"), eq(spks.status, "proses_konstruksi")),
        isNotNull(spks.targetEndDate),
        lt(spks.targetEndDate, now),
        lt(spks.progressPct, 100)
      )
    );

  let updatedCount = 0;

  for (const item of results) {
    await db.transaction(async (tx) => {
      // Update SPK status to overdue
      await tx.update(spks).set({
        status: "overdue",
        updatedAt: now,
      }).where(eq(spks.id, item.spk.id)).run();

      const oldStatus = item.unit.status;
      const isReadyStock = item.unit.isReadyStock || false;
      const newStatus = isReadyStock ? oldStatus : "overdue";

      // Update unit status to overdue (if not Ready Stock)
      await tx.update(units).set({
        status: newStatus,
        updatedAt: now,
      }).where(eq(units.id, item.unit.id)).run();

      // Log unit history
      if (newStatus !== oldStatus) {
        await tx.insert(unitStatusHistories).values({
          id: crypto.randomUUID(),
          unitId: item.unit.id,
          previousStatus: oldStatus,
          newStatus: newStatus,
          reason: `Target penyelesaian SPK ${item.spk.spkNumber} terlewati (${new Date(item.spk.targetEndDate).toLocaleDateString()}) dengan progress ${item.spk.progressPct}%`,
          changedBy: actorId,
          changedAt: now,
        }).run();
      }
    });

    // Write Audit Log outside transaction
    await writeAuditLog({
      action: "update",
      module: "production",
      entityId: item.spk.id,
      entityType: "spk",
      details: { spkNumber: item.spk.spkNumber, status: "overdue" },
    });

    // Notify about overdue SPK
    try {
      await notifyUsersWithRoles({
        roleNames: ["Super Admin", "Direksi / Manager", "Pengawas Lapangan"],
        type: "spk_overdue",
        title: "Konstruksi Unit Overdue",
        message: `Pekerjaan SPK ${item.spk.spkNumber} untuk unit kavling ${item.unit.code} mengalami keterlambatan (target: ${new Date(item.spk.targetEndDate).toLocaleDateString("id-ID")}).`,
        entityId: item.spk.id,
        entityType: "spk",
      });
    } catch (err) {
      console.warn("Failed to trigger overdue notification for SPK:", item.spk.spkNumber, err);
    }

    updatedCount++;
  }

  revalidatePath("/production/spk");
  revalidatePath("/master/units");
  revalidatePath("/siteplan");
  return { success: true, updatedCount };
}

// ==========================================
// 4. MATERIAL REQUEST & FINANCE LINKAGE
// ==========================================

export async function getMaterialRequests(projectId?: string) {
  await requireAuth();

  const query = db
    .select({
      request: materialRequests,
      spk: spks,
      project: projects,
      unit: units,
      vendor: vendors,
    })
    .from(materialRequests)
    .innerJoin(spks, eq(materialRequests.spkId, spks.id))
    .innerJoin(projects, eq(materialRequests.projectId, projects.id))
    .innerJoin(units, eq(materialRequests.unitId, units.id))
    .leftJoin(vendors, eq(materialRequests.vendorId, vendors.id))
    .orderBy(desc(materialRequests.createdAt));

  if (projectId) {
    return query.where(eq(materialRequests.projectId, projectId));
  }

  return query;
}

export async function createMaterialRequest(data: unknown) {
  const activeUser = await requireAuth();
  const parsed = materialRequestSchema.parse(data);

  const requestId = crypto.randomUUID();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const requestNumber = `MTR-${dateStr}-${rand}`;

  await db.insert(materialRequests).values({
    id: requestId,
    requestNumber,
    spkId: parsed.spkId,
    projectId: parsed.projectId,
    unitId: parsed.unitId,
    vendorId: parsed.vendorId || null,
    description: parsed.description,
    estimatedAmount: parsed.estimatedAmount,
    status: "draft",
    requestedBy: activeUser.id,
  });

  await writeAuditLog({
    action: "create",
    module: "production",
    entityId: requestId,
    entityType: "material_request",
    details: { requestNumber, estimatedAmount: parsed.estimatedAmount },
  });

  revalidatePath("/production/materials");
  return { success: true, requestId };
}

export async function submitMaterialRequest(requestId: string) {
  const activeUser = await requireAuth();

  let requestNumberResult = "";
  let transactionNumberResult = "";

  await db.transaction(async (tx) => {
    // 1. Get Material Request details
    const results = await tx.select().from(materialRequests).where(eq(materialRequests.id, requestId)).limit(1).all();
    if (results.length === 0) throw new Error("Request material tidak ditemukan");
    const request = results[0];
    requestNumberResult = request.requestNumber;

    if (request.status !== "draft") throw new Error("Hanya request material berstatus draft yang dapat disubmit");

    // 2. Query target finance account & category for material
    const accountResults = await tx.select().from(financeAccounts).where(eq(financeAccounts.status, "active")).limit(1).all();
    const categoryResults = await tx.select().from(financeCategories).where(and(
      eq(financeCategories.type, "expense"),
      sql`lower(${financeCategories.name}) LIKE '%produksi%' OR lower(${financeCategories.name}) LIKE '%lapangan%'`
    )).limit(1).all();

    // Fallback if production category doesn't exist
    let categoryId = "";
    if (categoryResults.length > 0) {
      categoryId = categoryResults[0].id;
    } else {
      const anyExpense = await tx.select().from(financeCategories).where(eq(financeCategories.type, "expense")).limit(1).all();
      if (anyExpense.length === 0) {
        throw new Error("Kategori keuangan pengeluaran lapangan belum diatur. Harap buat kategori pengeluaran di menu Master.");
      }
      categoryId = anyExpense[0].id;
    }

    if (accountResults.length === 0) {
      throw new Error("Akun penampung keuangan aktif belum tersedia.");
    }
    const account = accountResults[0];

    // 3. Create a pending expense ledger request in Transactions table
    const trxId = crypto.randomUUID();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const transactionNumber = `TRX-OUT-${dateStr}-${rand}`;
    transactionNumberResult = transactionNumber;

    // Compute real current balance from settled transactions
    const incBalData = await tx.select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(and(eq(transactions.accountId, account.id), eq(transactions.type, "income"), eq(transactions.approvalStatus, "not_required")))
      .all();
    const expBalData = await tx.select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(and(eq(transactions.accountId, account.id), eq(transactions.type, "expense"), eq(transactions.approvalStatus, "approved")))
      .all();
    const realBalance = account.openingBalance + Number(incBalData[0]?.total ?? 0) - Number(expBalData[0]?.total ?? 0);

    const isSufficient = realBalance >= request.estimatedAmount;
    const approvalStatus = isSufficient ? "pending" : "insufficient_balance";

    await tx.insert(transactions).values({
      id: trxId,
      transactionNumber,
      projectId: request.projectId,
      unitId: request.unitId,
      materialRequestId: request.id,
      accountId: account.id,
      categoryId,
      type: "expense",
      description: `Beli Material SPK: ${request.description}`,
      amount: request.estimatedAmount,
      transactionDate: new Date(),
      paymentMethod: "transfer",
      approvalStatus,
      createdBy: activeUser.id,
    }).run();

    // 4. Update material requests status
    await tx.update(materialRequests).set({
      status: "finance_pending",
      transactionId: trxId,
    }).where(eq(materialRequests.id, requestId)).run();
  });

  // 5. Audit Log outside transaction
  await writeAuditLog({
    action: "update",
    module: "production",
    entityId: requestId,
    entityType: "material_request",
    details: { requestNumber: requestNumberResult, status: "finance_pending", transactionNumber: transactionNumberResult },
  });

  // Notify about material request pending approval
  try {
    const requestResults = await db.select().from(materialRequests).where(eq(materialRequests.id, requestId)).limit(1);
    if (requestResults.length > 0) {
      const request = requestResults[0];
      await notifyUsersWithRoles({
        roleNames: ["Direksi / Manager", "Super Admin"],
        type: "approval_pending",
        title: "Pengajuan Material SPK",
        message: `Pengajuan material SPK senilai Rp ${request.estimatedAmount.toLocaleString()} untuk "${request.description}" memerlukan persetujuan keuangan.`,
        entityId: request.id,
        entityType: "material_request",
      });
    }
  } catch (err) {
    console.warn("Failed to trigger material request notification:", err);
  }

  revalidatePath("/production/materials");
  revalidatePath("/finance/approvals");
  revalidatePath("/finance/transactions");
  return { success: true };
}

// ==========================================
// 5. HANDOVER ESTIMATION & COMPLAINTS
// ==========================================

export async function getHandoverEstimations(unitId: string) {
  await requireAuth();

  return db
    .select({
      estimation: handoverEstimations,
      unit: units,
      spk: spks,
    })
    .from(handoverEstimations)
    .innerJoin(units, eq(handoverEstimations.unitId, units.id))
    .innerJoin(spks, eq(handoverEstimations.spkId, spks.id))
    .where(eq(handoverEstimations.unitId, unitId))
    .orderBy(desc(handoverEstimations.createdAt));
}

export async function createHandoverEstimation(data: unknown) {
  const activeUser = await requireAuth();
  const parsed = handoverEstimationSchema.parse(data);

  // 1. Ambil data unit & SPK untuk verifikasi
  const [unit] = await db.select().from(units).where(eq(units.id, parsed.unitId)).limit(1);
  const [spk] = await db.select().from(spks).where(eq(spks.id, parsed.spkId)).limit(1);

  if (!unit || !spk) {
    throw new Error("Unit atau SPK tidak ditemukan.");
  }

  // 2. Validasi berdasarkan Tipe BAST
  if (parsed.handoverType === "vendor_to_developer") {
    if (unit.status === "construction_done" || unit.status === "sold" || unit.status === "menunggu_serah_terima" || unit.status === "handover_complete") {
      throw new Error("⚠️ BAST Vendor ke Developer untuk unit ini sudah selesai dilakukan. Silakan pilih BAST Developer ke Konsumen.");
    }
    if (unit.constructionProgress < 100) {
      throw new Error("⚠️ BAST Vendor ke Developer hanya dapat dikalkulasikan jika progres unit sudah 100%.");
    }
  } else if (parsed.handoverType === "developer_to_customer") {
    // Pastikan status unit sudah minimal construction_done atau sold
    if (unit.status !== "construction_done" && unit.status !== "sold" && unit.status !== "menunggu_serah_terima" && unit.status !== "handover_complete") {
      throw new Error("⚠️ Pembangunan unit fisik harus diserahterimakan oleh Vendor terlebih dahulu (Status unit harus 'Selesai Bangun').");
    }
    // Pastikan ada booking aktif untuk unit ini
    const [activeBooking] = await db
      .select()
      .from(bookingsTable)
      .where(and(eq(bookingsTable.unitId, parsed.unitId), ne(bookingsTable.status, "cancelled")))
      .limit(1);

    if (!activeBooking) {
      throw new Error("⚠️ Unit belum terbooking oleh konsumen aktif.");
    }
  }

  const estimationId = crypto.randomUUID();

  await db.insert(handoverEstimations).values({
    id: estimationId,
    unitId: parsed.unitId,
    spkId: parsed.spkId,
    handoverType: parsed.handoverType,
    estimatedHandoverDate: parsed.estimatedHandoverDate,
    calculationNote: parsed.calculationNote || null,
  });

  await writeAuditLog({
    action: "create",
    module: "production",
    entityId: estimationId,
    entityType: "handover_estimation",
    details: {
      unitId: parsed.unitId,
      handoverType: parsed.handoverType,
      date: parsed.estimatedHandoverDate
    },
  });

  revalidatePath("/production/progress");
  return { success: true };
}

export async function getComplaints(projectId?: string) {
  await requireAuth();

  const query = db
    .select({
      complaint: complaints,
      customer: customers,
      unit: units,
    })
    .from(complaints)
    .leftJoin(customers, eq(complaints.customerId, customers.id))
    .leftJoin(units, eq(complaints.unitId, units.id))
    .orderBy(desc(complaints.createdAt));

  if (projectId) {
    return query.where(eq(units.projectId, projectId));
  }

  return query;
}

export async function createComplaint(data: unknown) {
  throw new Error("Fungsi createComplaint() sudah deprecated. Gunakan createVendorComplaint() atau createCustomerComplaint().");
}

export async function createVendorComplaint(data: unknown) {
  const activeUser = await requireAuth();
  const session = await getSessionRole(activeUser.id);
  if (!session.isVendor) {
    throw new Error("Hanya Vendor / Kontraktor yang diizinkan untuk membuat komplain vendor.");
  }

  // Find vendorId from vendorProfiles
  const vProfiles = await db
    .select()
    .from(vendorProfiles)
    .where(eq(vendorProfiles.userId, activeUser.id))
    .limit(1);

  if (vProfiles.length === 0 || !vProfiles[0].vendorId) {
    throw new Error("Profil vendor tidak ditemukan untuk user ini.");
  }
  const currentVendorId = vProfiles[0].vendorId;

  const parsed = vendorComplaintSchema.parse(data);

  // Validate SPK
  const spkResult = await db.select().from(spks).where(eq(spks.id, parsed.spkId)).limit(1);
  if (spkResult.length === 0) throw new Error("SPK tidak ditemukan.");
  const spk = spkResult[0];

  // Validate SPK belongs to this vendor (Rule V2)
  if (spk.vendorId !== currentVendorId) {
    throw new Error("Anda hanya boleh membuat komplain untuk SPK milik Anda sendiri.");
  }

  const complaintId = crypto.randomUUID();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const complaintNumber = `VCP-${dateStr}-${rand}`;

  await db.insert(complaints).values({
    id: complaintId,
    complaintNumber,
    complaintType: "vendor_to_supervisor",
    spkId: parsed.spkId,
    vendorId: currentVendorId,
    projectId: spk.projectId,
    unitId: spk.unitId,
    title: parsed.title,
    category: parsed.category,
    description: parsed.description,
    status: "open",
  });

  await writeAuditLog({
    action: "create",
    module: "production",
    entityId: complaintId,
    entityType: "complaint",
    details: {
      complaintNumber,
      complaintType: "vendor_to_supervisor",
      spkId: parsed.spkId,
      vendorId: currentVendorId,
      category: parsed.category
    },
  });

  // Notify SPK creator (the supervisor)
  try {
    await createNotification({
      userId: spk.createdBy,
      type: "info",
      title: "Komplain Kendala SPK Baru",
      message: `Vendor melaporkan kendala pada SPK ${spk.spkNumber}: "${parsed.title}".`,
      entityId: complaintId,
      entityType: "complaint",
    });

    // Notify Admin and Super Admin
    await notifyUsersWithRoles({
      roleNames: ["Super Admin", "Admin Kantor"],
      type: "info",
      title: "Komplain Kendala SPK Baru",
      message: `Vendor melaporkan kendala pada SPK ${spk.spkNumber}: "${parsed.title}".`,
      entityId: complaintId,
      entityType: "complaint",
    });
  } catch (err) {
    console.warn("Failed to send notifications for vendor complaint:", err);
  }

  revalidatePath("/production/complaints");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function reviewVendorComplaint(data: unknown) {
  const activeUser = await requireAuth();
  const session = await getSessionRole(activeUser.id);
  if (!session.isPengawas) {
    throw new Error("Hanya Pengawas Lapangan yang diizinkan untuk mereview komplain vendor.");
  }

  const parsed = reviewVendorComplaintSchema.parse(data);

  // Fetch complaint
  const results = await db.select().from(complaints).where(eq(complaints.id, parsed.complaintId)).limit(1);
  if (results.length === 0) throw new Error("Komplain tidak ditemukan.");
  const complaint = results[0];

  if (complaint.complaintType !== "vendor_to_supervisor") {
    throw new Error("Tipe komplain tidak sesuai.");
  }

  if (["resolved", "rejected", "closed"].includes(complaint.status)) {
    throw new Error("Komplain sudah selesai diproses dan tidak bisa diubah.");
  }

  if (!complaint.spkId) {
    throw new Error("Komplain tidak terhubung dengan SPK.");
  }

  // Fetch SPK
  const spkResult = await db.select().from(spks).where(eq(spks.id, complaint.spkId)).limit(1);
  if (spkResult.length === 0) throw new Error("SPK terkait tidak ditemukan.");
  const spk = spkResult[0];

  // If decision is approved_extension (Opsi B)
  if (parsed.decision === "approved_extension") {
    const extensionDays = parsed.extensionDays || 0;
    const oldTargetEndDate = spk.targetEndDate;
    const oldTime = oldTargetEndDate instanceof Date ? oldTargetEndDate.getTime() : Number(oldTargetEndDate);
    const extensionMs = extensionDays * 24 * 60 * 60 * 1000;
    const newTargetEndDate = new Date(oldTime + extensionMs);

    // Update SPK end date
    await db.update(spks).set({
      targetEndDate: newTargetEndDate,
      updatedAt: new Date(),
    }).where(eq(spks.id, spk.id));

    // Audit Log for SPK extension
    await writeAuditLog({
      action: "update",
      module: "production",
      entityId: spk.id,
      entityType: "spk",
      details: {
        complaintId: complaint.id,
        spkId: spk.id,
        oldTargetEndDate: new Date(oldTime).toISOString(),
        newTargetEndDate: newTargetEndDate.toISOString(),
        extensionDays,
        extensionReason: parsed.extensionReason || "",
        reviewedBy: activeUser.id,
        reviewedAt: new Date().toISOString(),
      },
    });

    // Update complaint status to approved_extension (NOT resolved - Opsi B)
    await db.update(complaints).set({
      status: "approved_extension",
      supervisorNote: parsed.supervisorNote,
      extensionDays,
      extensionReason: parsed.extensionReason || null,
      reviewedBy: activeUser.id,
      reviewedAt: new Date(),
    }).where(eq(complaints.id, complaint.id));

  } else if (parsed.decision === "resolved") {
    await db.update(complaints).set({
      status: "resolved",
      supervisorNote: parsed.supervisorNote,
      reviewedBy: activeUser.id,
      reviewedAt: new Date(),
      resolvedAt: new Date(),
    }).where(eq(complaints.id, complaint.id));

  } else if (parsed.decision === "need_revision") {
    await db.update(complaints).set({
      status: "need_revision",
      supervisorNote: parsed.supervisorNote,
      reviewedBy: activeUser.id,
      reviewedAt: new Date(),
    }).where(eq(complaints.id, complaint.id));

  } else if (parsed.decision === "rejected") {
    await db.update(complaints).set({
      status: "rejected",
      supervisorNote: parsed.supervisorNote,
      reviewedBy: activeUser.id,
      reviewedAt: new Date(),
    }).where(eq(complaints.id, complaint.id));
  }

  // Audit log for complaint
  await writeAuditLog({
    action: "update",
    module: "production",
    entityId: complaint.id,
    entityType: "complaint",
    details: {
      decision: parsed.decision,
      supervisorNote: parsed.supervisorNote,
      reviewedBy: activeUser.id,
      reviewedAt: new Date().toISOString(),
    },
  });

  // Notify Vendor
  try {
    if (complaint.vendorId) {
      const matchedVendorUser = await db
        .select({ userId: vendorProfiles.userId })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.vendorId, complaint.vendorId))
        .limit(1);

      if (matchedVendorUser.length > 0) {
        await createNotification({
          userId: matchedVendorUser[0].userId,
          type: "info",
          title: `Hasil Review Komplain: ${parsed.decision}`,
          message: `Komplain ${complaint.complaintNumber} Anda telah di-review: "${parsed.decision}". Catatan: ${parsed.supervisorNote}`,
          entityId: complaint.id,
          entityType: "complaint",
        });
      }
    }

    // Notify Admins
    await notifyUsersWithRoles({
      roleNames: ["Super Admin", "Admin Kantor"],
      type: "info",
      title: `Hasil Review Komplain Vendor`,
      message: `Komplain ${complaint.complaintNumber} dari vendor untuk SPK ${spk.spkNumber} telah di-review oleh Pengawas dengan keputusan "${parsed.decision}".`,
      entityId: complaint.id,
      entityType: "complaint",
    });
  } catch (err) {
    console.warn("Failed to send notifications for review vendor complaint:", err);
  }

  revalidatePath("/production/complaints");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createCustomerComplaint(data: unknown) {
  const activeUser = await requireAuth();
  const session = await getSessionRole(activeUser.id);

  if (!session.isAdminKantor && !session.isMarketing && !session.isMarketingManager && !session.isSuperAdmin) {
    throw new Error("Anda tidak memiliki wewenang untuk membuat komplain konsumen.");
  }

  if (session.isVendor) {
    throw new Error("Vendor tidak diperbolehkan membuat komplain konsumen.");
  }

  const parsed = customerComplaintSchema.parse(data);

  let customerId = parsed.customerId;
  let unitId = parsed.unitId;
  let projectId = parsed.projectId;

  if (parsed.bookingId) {
    const bookingResult = await db.select().from(bookingsTable).where(eq(bookingsTable.id, parsed.bookingId)).limit(1);
    if (bookingResult.length > 0) {
      const b = bookingResult[0];
      if (!customerId) customerId = b.customerId;
      if (!unitId) unitId = b.unitId;
      if (!projectId) {
        const unitResult = await db.select().from(units).where(eq(units.id, b.unitId)).limit(1);
        if (unitResult.length > 0) {
          projectId = unitResult[0].projectId;
        }
      }
    }
  }

  const complaintId = crypto.randomUUID();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const complaintNumber = `CCP-${dateStr}-${rand}`;

  await db.insert(complaints).values({
    id: complaintId,
    complaintNumber,
    complaintType: "customer_to_developer",
    customerId: customerId || null,
    unitId: unitId || null,
    projectId: projectId || null,
    bookingId: parsed.bookingId || null,
    title: parsed.title,
    category: parsed.category,
    description: parsed.description,
    status: "open",
  });

  await writeAuditLog({
    action: "create",
    module: "production",
    entityId: complaintId,
    entityType: "complaint",
    details: {
      complaintNumber,
      complaintType: "customer_to_developer",
      category: parsed.category,
      createdBy: activeUser.id
    },
  });

  try {
    const rolesToNotify = ["Super Admin", "Admin Kantor", "Marketing Manager"];
    if (["bangunan", "serah_terima", "listrik_air"].includes(parsed.category)) {
      rolesToNotify.push("Pengawas Lapangan");
    }
    await notifyUsersWithRoles({
      roleNames: rolesToNotify,
      type: "info",
      title: "Komplain Konsumen Baru",
      message: `Laporan komplain konsumen baru (${parsed.category}): "${parsed.title}".`,
      entityId: complaintId,
      entityType: "complaint",
    });
  } catch (err) {
    console.warn("Failed to send notifications for customer complaint creation:", err);
  }

  revalidatePath("/production/complaints");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function resolveCustomerComplaint(data: unknown) {
  const activeUser = await requireAuth();
  const session = await getSessionRole(activeUser.id);

  const parsed = resolveCustomerComplaintSchema.parse(data);

  // Fetch complaint
  const results = await db.select().from(complaints).where(eq(complaints.id, parsed.complaintId)).limit(1);
  if (results.length === 0) throw new Error("Komplain tidak ditemukan.");
  const complaint = results[0];

  if (complaint.complaintType !== "customer_to_developer") {
    throw new Error("Tipe komplain tidak sesuai.");
  }

  if (["resolved", "rejected", "closed"].includes(complaint.status)) {
    throw new Error("Komplain sudah selesai diproses dan tidak bisa diubah.");
  }

  // Permission checks based on category (Fase 4)
  let hasPermission = false;
  const category = complaint.category;
  if (["bangunan", "after_sales", "serah_terima", "delay"].includes(category)) {
    hasPermission = session.isSuperAdmin || session.isAdminKantor || session.isMarketingManager || session.isPengawas;
  } else if (["pelayanan", "fasilitas"].includes(category)) {
    hasPermission = session.isSuperAdmin || session.isAdminKantor || session.isMarketing || session.isMarketingManager;
  } else if (["listrik_air"].includes(category)) {
    hasPermission = session.isSuperAdmin || session.isAdminKantor || session.isMarketingManager || session.isPengawas;
  } else if (category === "legalitas") {
    hasPermission = session.isSuperAdmin || session.isAdminKantor;
  } else {
    hasPermission = session.isSuperAdmin || session.isAdminKantor || session.isMarketingManager;
  }

  if (!hasPermission) {
    throw new Error("Anda tidak memiliki izin untuk memproses komplain konsumen dengan kategori ini.");
  }

  // Calculate followUpTargetDate if applicable
  let followUpTargetDate: Date | null = null;
  if (parsed.resolutionStatus === "follow_up_required" && parsed.followUpDays) {
    followUpTargetDate = new Date(Date.now() + parsed.followUpDays * 24 * 60 * 60 * 1000);
  }

  // Update DB
  await db.update(complaints).set({
    status: parsed.resolutionStatus,
    developerNote: parsed.developerNote,
    repairAction: parsed.repairAction,
    customerMessage: parsed.customerMessage || null,
    assignedToRole: parsed.assignedToRole || null,
    assignedToUserId: parsed.assignedToUserId || null,
    followUpTargetDate,
    resolvedAt: parsed.resolutionStatus === "resolved" ? new Date() : null,
    assignedTo: activeUser.id,
  }).where(eq(complaints.id, complaint.id));

  // Write audit log
  await writeAuditLog({
    action: "update",
    module: "production",
    entityId: complaint.id,
    entityType: "complaint",
    details: {
      complaintId: complaint.id,
      resolutionStatus: parsed.resolutionStatus,
      developerNote: parsed.developerNote,
      repairAction: parsed.repairAction,
      assignedToRole: parsed.assignedToRole || null,
      assignedToUserId: parsed.assignedToUserId || null,
      followUpDays: parsed.followUpDays || null,
      followUpTargetDate: followUpTargetDate ? followUpTargetDate.toISOString() : null,
      resolvedBy: activeUser.id,
      resolvedAt: parsed.resolutionStatus === "resolved" ? new Date().toISOString() : null,
    },
  });

  // If forwarded to vendor, notify vendor if possible (Fase 9)
  try {
    if (parsed.repairAction === "forwarded_to_vendor") {
      // Find if we can identify active vendor for this unit or project
      if (complaint.unitId) {
        const unitSpks = await db.select().from(spks).where(and(eq(spks.unitId, complaint.unitId), eq(spks.status, "active"))).limit(1);
        if (unitSpks.length > 0) {
          const activeVendorId = unitSpks[0].vendorId;
          const matchedVendorUser = await db
            .select({ userId: vendorProfiles.userId })
            .from(vendorProfiles)
            .where(eq(vendorProfiles.vendorId, activeVendorId))
            .limit(1);
          if (matchedVendorUser.length > 0) {
            await createNotification({
              userId: matchedVendorUser[0].userId,
              type: "info",
              title: "Komplain Konsumen Diteruskan",
              message: `Komplain konsumen ${complaint.complaintNumber} diteruskan ke Anda untuk perbaikan: "${parsed.developerNote}".`,
              entityId: complaint.id,
              entityType: "complaint",
            });
          }
        }
      }
    } else if (parsed.repairAction === "forwarded_to_supervisor") {
      if (parsed.assignedToUserId) {
        await createNotification({
          userId: parsed.assignedToUserId,
          type: "info",
          title: "Komplain Konsumen Diteruskan",
          message: `Komplain konsumen ${complaint.complaintNumber} ditugaskan ke Anda: "${parsed.developerNote}".`,
          entityId: complaint.id,
          entityType: "complaint",
        });
      } else {
        await notifyUsersWithRoles({
          roleNames: ["Pengawas Lapangan"],
          type: "info",
          title: "Komplain Konsumen Diteruskan",
          message: `Komplain konsumen ${complaint.complaintNumber} diteruskan ke tim pengawas: "${parsed.developerNote}".`,
          entityId: complaint.id,
          entityType: "complaint",
        });
      }
    }

    // General notification to admin/super/marketing
    await notifyUsersWithRoles({
      roleNames: ["Super Admin", "Admin Kantor", "Marketing Manager"],
      type: "info",
      title: `Komplain Konsumen Diproses`,
      message: `Komplain ${complaint.complaintNumber} telah diupdate oleh developer dengan status "${parsed.resolutionStatus}".`,
      entityId: complaint.id,
      entityType: "complaint",
    });
  } catch (err) {
    console.warn("Failed to send notifications for customer complaint resolution:", err);
  }

  revalidatePath("/production/complaints");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function resolveComplaint(complaintId: string, notes?: string) {
  const results = await db.select().from(complaints).where(eq(complaints.id, complaintId)).limit(1);
  if (results.length === 0) throw new Error("Komplain tidak ditemukan.");
  const complaint = results[0];
  if (complaint.complaintType === "vendor_to_supervisor") {
    throw new Error("Gunakan reviewVendorComplaint() untuk komplain vendor.");
  }
  if (complaint.complaintType === "customer_to_developer") {
    throw new Error("Gunakan resolveCustomerComplaint() untuk komplain konsumen.");
  }
  throw new Error("Tipe komplain tidak dikenali.");
}

// Auxiliary helper to seed active work items if they are missing at runtime
export async function getActiveWorkItems() {
  await requireAuth();
  return db.select().from(workItems).where(eq(workItems.status, "active"));
}

// ─── WORK ITEMS MANAGEMENT ─────────────────────────────────────────────────

export async function getAllWorkItems() {
  await requireAuth();
  return db.select().from(workItems).orderBy(workItems.code);
}

export async function createWorkItem(data: {
  code: string;
  name: string;
  description?: string;
  defaultWeightPct: number;
  status?: "active" | "inactive";
}) {
  await requireAnyRole(["Super Admin", "Admin Kantor"]);

  // Validate total weight constraint (soft warn only)
  const existing = await db.select().from(workItems).where(eq(workItems.status, "active"));
  const currentTotal = existing.reduce((s, i) => s + i.defaultWeightPct, 0);
  if (currentTotal + data.defaultWeightPct > 100) {
    throw new Error(`Total bobot work item aktif akan melebihi 100%. Saat ini: ${currentTotal}%, ditambahkan: ${data.defaultWeightPct}%.`);
  }

  const id = crypto.randomUUID();
  await db.insert(workItems).values({
    id,
    code: data.code,
    name: data.name,
    description: data.description ?? null,
    defaultWeightPct: data.defaultWeightPct,
    status: data.status ?? "active",
  });

  await writeAuditLog({
    action: "create",
    module: "production",
    entityId: id,
    entityType: "work_item",
    details: { code: data.code, name: data.name },
  });

  revalidatePath("/master/work-items");
  revalidatePath("/production");
  return { success: true, id };
}

export async function updateWorkItem(id: string, data: {
  name?: string;
  description?: string;
  defaultWeightPct?: number;
  status?: "active" | "inactive";
}) {
  await requireAnyRole(["Super Admin", "Admin Kantor"]);

  const existing = await db.select().from(workItems);
  const currentItem = existing.find(i => i.id === id);
  if (!currentItem) throw new Error("Item pekerjaan tidak ditemukan.");

  const merged = { ...currentItem, ...data };
  const newTotal = existing
    .map(i => i.id === id ? merged : i)
    .filter(i => i.status === "active")
    .reduce((s, i) => s + i.defaultWeightPct, 0);

  if (newTotal > 100) {
    throw new Error(`Total bobot work item aktif akan melebihi 100%. Setelah perubahan: ${newTotal}%.`);
  }

  await db.update(workItems).set(data).where(eq(workItems.id, id));

  await writeAuditLog({
    action: "update",
    module: "production",
    entityId: id,
    entityType: "work_item",
    details: data,
  });

  revalidatePath("/master/work-items");
  revalidatePath("/production");
  return { success: true };
}

export async function deleteWorkItem(id: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor"]);

  const inUse = await db.select({ id: spkWorkItemWeights.id })
    .from(spkWorkItemWeights)
    .where(eq(spkWorkItemWeights.workItemId, id))
    .limit(1);

  if (inUse.length > 0) {
    throw new Error("Pekerjaan standar ini sedang digunakan dalam SPK aktif/konstruksi dan tidak dapat dihapus. Nonaktifkan saja statusnya jika tidak ingin digunakan lagi.");
  }

  await db.delete(workItems).where(eq(workItems.id, id));

  await writeAuditLog({
    action: "delete",
    module: "production",
    entityId: id,
    entityType: "work_item",
  });

  revalidatePath("/master/work-items");
  return { success: true };
}

export async function completeConstruction(unitId: string, bastAttachmentId?: string | null, reason?: string | null) {
  const activeUser = await requireAuth();
  const roleInfo = await getSessionRole(activeUser.id);

  if (!roleInfo.isSuperAdmin && !roleInfo.isAdminKantor && !roleInfo.isPengawas) {
    throw new Error("Anda tidak memiliki wewenang untuk menyetujui BAST konstruksi unit.");
  }

  const [unit] = await db.select().from(units).where(eq(units.id, unitId)).limit(1);
  if (!unit) throw new Error("Unit tidak ditemukan.");

  const oldStatus = unit.status;

  // Find if there is an active/completed booking for this unit
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.unitId, unitId),
        ne(bookingsTable.status, "cancelled")
      )
    )
    .limit(1);

  // Find SPK that is currently active, in progress, or overdue and has 100% progress for this unit
  const [activeSpk] = await db
    .select()
    .from(spks)
    .where(
      and(
        eq(spks.unitId, unitId),
        inArray(spks.status, ["active", "proses_konstruksi", "selesai_konstruksi", "overdue"]),
        eq(spks.progressPct, 100)
      )
    )
    .limit(1);

  // P2: manual_ready_stock check
  if (unit.readyStockSource === "manual_ready_stock" && !activeSpk) {
    await safeWriteBlockedTransitionLog({
      module: "production",
      entityType: "unit",
      entityId: unitId,
      details: {
        action: "completeConstruction_blocked_manual_ready_stock",
        unitId,
        readyStockSource: unit.readyStockSource,
        reason: "Manual Ready Stock tanpa SPK aktif tidak dapat diselesaikan melalui completeConstruction. Gunakan alur manual override dengan alasan dan audit log.",
      },
    });
    throw new Error(
      "Manual Ready Stock tanpa SPK aktif tidak dapat diselesaikan melalui completeConstruction. Gunakan alur manual override dengan alasan dan audit log."
    );
  }

  if (unit.readyStockSource === "manual_ready_stock" && activeSpk && !reason) {
    throw new Error("Alasan (reason) manual override wajib diisi untuk unit dengan sumber Manual Ready Stock.");
  }

  // P2: construction_flow BAST vendor check
  if (unit.readyStockSource === "construction_flow" && !bastAttachmentId) {
    await safeWriteBlockedTransitionLog({
      module: "production",
      entityType: "unit",
      entityId: unitId,
      details: {
        action: "completeConstruction_blocked_missing_bast",
        unitId,
        readyStockSource: unit.readyStockSource,
        reason: "BAST Vendor ke Developer wajib diunggah sebelum konstruksi dapat diselesaikan.",
      },
    });
    throw new Error(
      "BAST Vendor ke Developer wajib diunggah sebelum konstruksi dapat diselesaikan."
    );
  }

  // P2: Verify attachment exists if provided
  if (bastAttachmentId) {
    const attachment = await db.select().from(attachments).where(eq(attachments.id, bastAttachmentId)).limit(1).get();
    if (!attachment) {
      throw new Error("Lampiran BAST tidak ditemukan. Silakan unggah berkas kembali.");
    }
  }

  let newStatus: "sold" | "kpr_process" | "booking" | "available" = "available";
  if (booking) {
    if (booking.status === "completed" || booking.status === "akad") {
      newStatus = "sold";
    } else if (booking.status === "active") {
      if (booking.paymentScheme === "kpr") {
        newStatus = "kpr_process";
      } else {
        newStatus = "booking";
      }
    }
  }

  await db.transaction(async (tx) => {
    // 1. Update unit status and isReadyStock
    const unitUpdate: Record<string, any> = {
      status: newStatus,
      isReadyStock: true,
      constructionProgress: 100,
      updatedAt: new Date(),
    };
    if (booking) {
      unitUpdate.currentCustomerId = booking.customerId;
      unitUpdate.currentBookingId = booking.id;
    } else {
      unitUpdate.currentCustomerId = null;
      unitUpdate.currentBookingId = null;
    }
    await tx.update(units).set(unitUpdate).where(eq(units.id, unitId)).run();

    // 2. Update SPK status to completed
    if (activeSpk) {
      await tx
        .update(spks)
        .set({
          status: "completed",
          actualEndDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(spks.id, activeSpk.id))
        .run();
    }

    // 3. Add history record
    await tx.insert(unitStatusHistories).values({
      id: crypto.randomUUID(),
      unitId,
      previousStatus: oldStatus,
      newStatus,
      reason: `Pembangunan selesai secara resmi oleh Developer, unit berstatus ${newStatus === "available" ? "Tersedia (Ready Stock)" : newStatus === "sold" ? "Terjual (Sold)" : newStatus === "kpr_process" ? "Proses KPR (Ready Stock)" : "Booking (Ready Stock)"}. Bukti BAST Terunggah: ${bastAttachmentId || "Tidak Ada"}`,
      changedBy: activeUser.id,
      changedAt: new Date(),
    }).run();
  });

  // 3. Write audit log
  await writeAuditLog({
    action: "update",
    module: "production",
    entityId: unitId,
    entityType: "unit",
    details: { unitCode: unit.code, oldStatus, newStatus, isReadyStock: true, bastAttachmentId },
  });

  revalidatePath("/production/progress");
  revalidatePath("/production/spk");
  revalidatePath("/master/units");
  revalidatePath("/siteplan");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function uploadBastAttachment(
  spkId: string,
  data: { fileName: string; fileUrl: string; mimeType?: string; fileSize?: number }
) {
  const user = await requireAuth();

  const attachmentId = crypto.randomUUID();
  await db.insert(attachments).values({
    id: attachmentId,
    entityId: spkId,
    entityType: "bast_vendor_to_developer",
    fileName: data.fileName,
    fileUrl: data.fileUrl,
    mimeType: data.mimeType || "application/octet-stream",
    fileSize: data.fileSize || 0,
    uploadedBy: user.id,
    createdAt: new Date(),
  });

  await writeAuditLog({
    action: "create",
    module: "production",
    entityId: attachmentId,
    entityType: "bast_attachment",
    details: { spkId, fileName: data.fileName },
  });

  revalidatePath("/dashboard");
  revalidatePath("/production");
  return { success: true, attachmentId };
}

export async function getActiveSpkForUnit(unitId: string) {
  await requireAuth();
  const [spk] = await db
    .select()
    .from(spks)
    .where(and(eq(spks.unitId, unitId), ne(spks.status, "cancelled")))
    .limit(1);
  return spk || null;
}

export async function getBastAttachmentForSpk(spkId: string) {
  await requireAuth();
  const [attachment] = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.entityId, spkId),
        eq(attachments.entityType, "bast_vendor_to_developer")
      )
    )
    .limit(1);
  return attachment || null;
}

export async function getCustomerBastForUnit(unitId: string) {
  await requireAuth();

  // 1. Fetch unit
  const [unit] = await db.select().from(units).where(eq(units.id, unitId)).limit(1);
  if (!unit) throw new Error("Unit tidak ditemukan.");

  // 2. Find if there is an active/completed booking for this unit
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.unitId, unitId),
        ne(bookingsTable.status, "cancelled")
      )
    )
    .limit(1);

  // 3. If there is a booking, fetch customer details and any BAST customer document
  let customer = null;
  let custDoc = null;
  if (booking) {
    [customer] = await db.select().from(customers).where(eq(customers.id, booking.customerId)).limit(1);

    // Get customer document of type "bast" for this booking
    const docs = await db
      .select({
        id: customerDocuments.id,
        attachmentId: customerDocuments.attachmentId,
        status: customerDocuments.status,
        notes: customerDocuments.notes,
        fileName: attachments.fileName,
        fileUrl: attachments.fileUrl,
      })
      .from(customerDocuments)
      .innerJoin(attachments, eq(customerDocuments.attachmentId, attachments.id))
      .where(
        and(
          eq(customerDocuments.bookingId, booking.id),
          eq(customerDocuments.documentType, "bast")
        )
      )
      .limit(1);
    custDoc = docs[0] || null;
  }

  return {
    readyStockSource: unit.readyStockSource,
    isLegacyReadyStock: unit.readyStockSource === "legacy_ready_stock",
    requiresVendorBastForReadyStock: unit.readyStockSource === "construction_flow",
    bookingId: booking?.id || null,
    bookingNumber: booking?.bookingNumber || null,
    customerId: booking?.customerId || null,
    customerName: customer?.name || null,
    customerPhone: customer?.phone || null,
    fileName: custDoc?.fileName || null,
    fileUrl: custDoc?.fileUrl || null,
    docStatus: custDoc?.status || null, // uploaded, verified, rejected
    docNotes: custDoc?.notes || null,
    docId: custDoc?.id || null,
  };
}

export async function uploadCustomerBastFromProduction(
  unitId: string,
  bookingId: string,
  customerId: string,
  data: { fileName: string; fileUrl: string; mimeType?: string; fileSize?: number }
) {
  const user = await requireAuth();

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
  if (!booking) throw new Error("Booking tidak ditemukan.");

  const [unit] = await db.select().from(units).where(eq(units.id, unitId)).limit(1);
  if (!unit) throw new Error("Unit tidak ditemukan.");

  const attachmentId = crypto.randomUUID();
  const custDocId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    // 1. Insert into attachments
    await tx.insert(attachments).values({
      id: attachmentId,
      entityId: bookingId,
      entityType: "bast_customer",
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      mimeType: data.mimeType || "application/octet-stream",
      fileSize: data.fileSize || 0,
      uploadedBy: user.id,
      createdAt: new Date(),
    }).run();

    // 2. Check if a BAST document already exists for this booking
    const existingBast = await tx
      .select()
      .from(customerDocuments)
      .where(
        and(
          eq(customerDocuments.bookingId, bookingId),
          eq(customerDocuments.documentType, "bast")
        )
      )
      .get();

    if (existingBast) {
      // Update the existing document's attachment
      await tx.update(customerDocuments)
        .set({
          attachmentId,
          status: "uploaded", // Reset status back to uploaded on new file upload
          notes: null,
          uploadedBy: user.id,
        })
        .where(eq(customerDocuments.id, existingBast.id))
        .run();
    } else {
      // Insert new document
      await tx.insert(customerDocuments).values({
        id: custDocId,
        customerId,
        bookingId,
        attachmentId,
        documentType: "bast",
        status: "uploaded",
        uploadedBy: user.id,
      }).run();
    }
  });

  await writeAuditLog({
    action: "create",
    module: "production",
    entityId: attachmentId,
    entityType: "bast_customer_attachment",
    details: { bookingId, fileName: data.fileName, unitCode: unit.code },
  });

  revalidatePath("/production/progress");
  revalidatePath(`/marketing/bookings/${bookingId}`);
  revalidatePath("/marketing/bookings");
  revalidatePath("/marketing/kpr");
  revalidatePath("/master/units");
  revalidatePath("/siteplan");

  return { success: true };
}

/**
 * Hapus dokumen BAST Konsumen (customer document + attachment).
 * Hanya boleh dilakukan oleh Super Admin, Admin Kantor, atau Pengawas Lapangan.
 * Tidak bisa dihapus jika status dokumen sudah "verified".
 */
export async function deleteCustomerBastDocument(docId: string) {
  const activeUser = await requireAuth();
  const roleInfo = await getSessionRole(activeUser.id);

  if (!roleInfo.isSuperAdmin && !roleInfo.isAdminKantor && !roleInfo.isPengawas) {
    throw new Error("Anda tidak memiliki wewenang untuk menghapus dokumen BAST Konsumen.");
  }

  // Fetch the document to verify it exists and is not already verified
  const [doc] = await db
    .select({
      id: customerDocuments.id,
      attachmentId: customerDocuments.attachmentId,
      status: customerDocuments.status,
      bookingId: customerDocuments.bookingId,
    })
    .from(customerDocuments)
    .where(eq(customerDocuments.id, docId))
    .limit(1);

  if (!doc) throw new Error("Dokumen BAST tidak ditemukan.");
  if (doc.status === "verified") {
    throw new Error("Dokumen BAST yang sudah terverifikasi tidak dapat dihapus.");
  }

  await db.transaction(async (tx) => {
    // 1. Delete the customer document record
    await tx.delete(customerDocuments).where(eq(customerDocuments.id, docId)).run();

    // 2. Delete the attachment record
    if (doc.attachmentId) {
      await tx.delete(attachments).where(eq(attachments.id, doc.attachmentId)).run();
    }
  });

  await writeAuditLog({
    action: "delete",
    module: "production",
    entityId: docId,
    entityType: "bast_customer_document",
    details: { docId, bookingId: doc.bookingId, deletedBy: activeUser.id },
  });

  revalidatePath("/production/progress");
  revalidatePath("/marketing/bookings");
  revalidatePath("/marketing/kpr");
  revalidatePath("/master/units");
  revalidatePath("/siteplan");

  return { success: true };
}



export async function notifyNewSpkCreated(spkId: string, isAuto = false) {
  try {
    const spkDetails = await db
      .select({
        spk: spks,
        unit: units,
        project: projects,
      })
      .from(spks)
      .innerJoin(units, eq(spks.unitId, units.id))
      .innerJoin(projects, eq(spks.projectId, projects.id))
      .where(eq(spks.id, spkId))
      .get();

    if (!spkDetails) return;

    const sourceText = isAuto ? "Otomatis" : "Manual";

    // 1. Notify Pengawas Lapangan
    await notifyUsersWithRoles({
      roleNames: ["Pengawas Lapangan"],
      type: "info",
      title: `SPK Baru Diterbitkan (${sourceText})`,
      message: `Surat Perintah Kerja ${spkDetails.spk.spkNumber} untuk pekerjaan "${spkDetails.spk.title}" di kavling ${spkDetails.unit.code} (${spkDetails.project.name}) telah diterbitkan.`,
      entityId: spkId,
      entityType: "spk",
    });

    // 2. Notify Vendor if they have a user account
    if (spkDetails.spk.vendorId) {
      const matchedVendorUser = await db
        .select({ userId: vendorProfiles.userId })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.vendorId, spkDetails.spk.vendorId))
        .limit(1)
        .all();

      if (matchedVendorUser.length > 0) {
        await createNotification({
          userId: matchedVendorUser[0].userId,
          type: "info",
          title: `SPK Baru Ditugaskan (${sourceText})`,
          message: `Anda mendapat tugas SPK baru ${spkDetails.spk.spkNumber} untuk pekerjaan "${spkDetails.spk.title}" di kavling ${spkDetails.unit.code} (${spkDetails.project.name}).`,
          entityId: spkId,
          entityType: "spk",
        });
      }
    }
  } catch (err) {
    console.error("[Notification] Failed to notify on new SPK:", err);
  }
}

export async function completeVendorSpk(spkId: string) {
  const activeUser = await requireAuth();
  const roleInfo = await getSessionRole(activeUser.id);

  // 1. Fetch SPK
  const [spk] = await db.select().from(spks).where(eq(spks.id, spkId)).limit(1).all();
  if (!spk) throw new Error("SPK tidak ditemukan.");

  // 2. Validate permissions: Super Admin, Admin Kantor, Pengawas, or the specific Vendor assigned to this SPK
  let hasAccess = roleInfo.isSuperAdmin || roleInfo.isAdminKantor || roleInfo.isPengawas;
  if (!hasAccess && roleInfo.isVendor) {
    // Check if the SPK vendor matches this user's vendorId
    const [profile] = await db
      .select({ vendorId: vendorProfiles.vendorId })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.userId, activeUser.id))
      .limit(1)
      .all();
    if (profile && profile.vendorId === spk.vendorId) {
      hasAccess = true;
    }
  }

  if (!hasAccess) {
    throw new Error("Anda tidak memiliki wewenang untuk menyelesaikan SPK ini.");
  }

  // 3. Validate status
  if (spk.status !== "proses_konstruksi" && spk.status !== "overdue") {
    throw new Error("Hanya SPK berstatus Proses Konstruksi atau Terlambat yang dapat diselesaikan.");
  }

  // 4. Validate progress is 100%
  if (spk.progressPct !== 100) {
    throw new Error("Pembangunan SPK belum mencapai 100% progres SLA fisik.");
  }

  // 5. Update SPK status to selesai_konstruksi
  await db
    .update(spks)
    .set({
      status: "selesai_konstruksi",
      updatedAt: new Date(),
    })
    .where(eq(spks.id, spkId))
    .run();

  // 6. Log audit trail
  await writeAuditLog({
    action: "update",
    module: "production",
    entityId: spkId,
    entityType: "spk",
    details: {
      spkNumber: spk.spkNumber,
      title: spk.title,
      status: "selesai_konstruksi",
      completedBy: activeUser.id,
      role: roleInfo.isVendor ? "vendor" : "internal",
    },
  });

  // 7. Notify internal team (Pengawas Lapangan & Admin)
  try {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, spk.vendorId)).limit(1).all();
    const [unit] = await db.select().from(units).where(eq(units.id, spk.unitId)).limit(1).all();
    const vendorName = vendor?.name || "Kontraktor";
    const unitCode = unit?.code || "Unit Kavling";

    await notifyUsersWithRoles({
      roleNames: ["Pengawas Lapangan", "Super Admin", "Admin Kantor"],
      type: "info",
      title: `SPK Dinyatakan Selesai oleh Vendor`,
      message: `Kontraktor "${vendorName}" menyatakan pembangunan untuk SPK ${spk.spkNumber} (${spk.title}) di unit ${unitCode} telah selesai. Silakan lakukan pemeriksaan fisik lapangan dan unggah berkas BAST Developer.`,
      entityId: spkId,
      entityType: "spk",
    });
  } catch (err) {
    console.error("[Notification] Failed to send notification for completeVendorSpk:", err);
  }

  revalidatePath("/production/spk");
  revalidatePath("/production");
  revalidatePath("/dashboard");

  return { success: true };
}


