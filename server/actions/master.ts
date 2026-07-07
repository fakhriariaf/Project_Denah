"use server";

import { db } from "@/db";
import { projects, units, customers, vendors, projectUsers, siteplans, siteplanShapes, financeCategories, financeAccounts } from "@/db/schema/master";
import { projectSchema, unitSchema, customerSchema, vendorSchema, financeCategorySchema } from "../validators/master";
import { requireAnyRole, requireRole } from "../permissions";
import { bookings } from "@/db/schema/marketing";
import { spks, spmbs } from "@/db/schema/production";
import { transactions, budgetLines } from "@/db/schema/finance";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { writeAuditLog, safeWriteBlockedTransitionLog } from "./audit";
import { user as userTable, vendorProfiles } from "@/db/schema/auth";
import { auth } from "@/server/auth";
import { notifyNewSpkCreated } from "./production";
import { applyRateLimit } from "@/server/middleware/apply-rate-limit";

// --- PROJECTS ---
export async function createProject(data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor"]);
  applyRateLimit(user.id);
  const parsed = projectSchema.parse(data);
  const id = crypto.randomUUID();

  await db.insert(projects).values({ id, ...parsed, createdBy: user.id, createdAt: new Date(), updatedAt: new Date() });
  await writeAuditLog({ action: "create", module: "master", entityId: id, entityType: "project", details: { name: parsed.name } });

  revalidatePath("/master/projects");
  revalidatePath("/marketing/bookings");
  return { success: true, id };
}

export async function updateProject(id: string, data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor"]);
  applyRateLimit(user.id);
  const parsed = projectSchema.parse(data);

  await db.update(projects).set({ ...parsed, updatedAt: new Date() }).where(eq(projects.id, id));
  await writeAuditLog({ action: "update", module: "master", entityId: id, entityType: "project", details: { name: parsed.name } });

  revalidatePath("/master/projects");
  revalidatePath("/marketing/bookings");
  return { success: true };
}

export async function deleteProject(id: string) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor"]);
  applyRateLimit(user.id);

  // Prevent deletion if project has active or sold units
  const projectUnits = await db.select().from(units).where(eq(units.projectId, id));
  const activeUnits = projectUnits.filter(u => u.status !== "available");
  if (activeUnits.length > 0) {
    throw new Error(`Tidak dapat menghapus project. Terdapat ${activeUnits.length} kavling yang sudah dibooking atau terjual.`);
  }

  await db.transaction(async (tx) => {
    // Manual cascade deletes to guarantee cleanup in SQLite
    const projectSiteplans = await tx.select({ id: siteplans.id }).from(siteplans).where(eq(siteplans.projectId, id)).all();
    if (projectSiteplans.length > 0) {
      const spIds = projectSiteplans.map(sp => sp.id);
      await tx.delete(siteplanShapes).where(inArray(siteplanShapes.siteplanId, spIds)).run();
    }
    await tx.delete(siteplans).where(eq(siteplans.projectId, id)).run();
    await tx.delete(units).where(eq(units.projectId, id)).run();
    await tx.delete(projectUsers).where(eq(projectUsers.projectId, id)).run();

    await tx.delete(projects).where(eq(projects.id, id)).run();
  });

  await writeAuditLog({ action: "delete", module: "master", entityId: id, entityType: "project" });

  revalidatePath("/master/projects");
  revalidatePath("/marketing/bookings");
  return { success: true };
}

/**
 * Force-delete a project and ALL dependent data.
 * Only Super Admin can execute this. No blocking — deletes everything.
 * Cascade order: SPK progress → SPKs/SPMBs → bookings/KPR → invoices/payments → transactions → units → siteplans → project
 */
export async function forceDeleteProject(id: string) {
  const user = await requireRole("Super Admin");
  applyRateLimit(user.id);

  // Verify project exists
  const [project] = await db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) throw new Error("Project tidak ditemukan.");

  await db.transaction(async (tx) => {
    // Get unit IDs for this project (needed for cascading dependent data)
    const projectUnitIds = (await tx.select({ id: units.id }).from(units).where(eq(units.projectId, id))).map(u => u.id);

    // Get booking IDs for this project
    const projectBookingIds = (await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.projectId, id))).map(b => b.id);

    // Get SPK IDs for this project
    const projectSpkIds = (await tx.select({ id: spks.id }).from(spks).where(eq(spks.projectId, id))).map(s => s.id);

    // 1. Delete SPK progress logs & work item weights
    if (projectSpkIds.length > 0) {
      const { spkProgressLogs, spkWorkItemWeights } = await import("@/db/schema/production");
      await tx.delete(spkProgressLogs).where(inArray(spkProgressLogs.spkId, projectSpkIds)).run();
      await tx.delete(spkWorkItemWeights).where(inArray(spkWorkItemWeights.spkId, projectSpkIds)).run();
      // Delete SPMBs
      await tx.delete(spmbs).where(inArray(spmbs.spkId, projectSpkIds)).run();
    }

    // 2. Delete SPKs & material requests
    await tx.delete(spks).where(eq(spks.projectId, id)).run();
    const { materialRequests } = await import("@/db/schema/production");
    await tx.delete(materialRequests).where(eq(materialRequests.projectId, id)).run();

    // 3. Delete KPR processes & booking status histories (via bookings)
    if (projectBookingIds.length > 0) {
      const { kprProcesses, bookingStatusHistories } = await import("@/db/schema/marketing");
      await tx.delete(kprProcesses).where(inArray(kprProcesses.bookingId, projectBookingIds)).run();
      await tx.delete(bookingStatusHistories).where(inArray(bookingStatusHistories.bookingId, projectBookingIds)).run();
    }

    // 4. Delete bookings
    await tx.delete(bookings).where(eq(bookings.projectId, id)).run();

    // 5. Delete invoices, payments, transactions
    const { invoices, payments } = await import("@/db/schema/finance");
    await tx.delete(payments).where(eq(payments.projectId, id)).run();
    await tx.delete(invoices).where(eq(invoices.projectId, id)).run();
    await tx.delete(transactions).where(eq(transactions.projectId, id)).run();

    // 6. Delete budget lines & budgets
    const { budgets } = await import("@/db/schema/finance");
    const projectBudgetIds = (await tx.select({ id: budgets.id }).from(budgets).where(eq(budgets.projectId, id))).map(b => b.id);
    if (projectBudgetIds.length > 0) {
      await tx.delete(budgetLines).where(inArray(budgetLines.budgetId, projectBudgetIds)).run();
    }
    await tx.delete(budgets).where(eq(budgets.projectId, id)).run();

    // 7. Delete unit status histories
    if (projectUnitIds.length > 0) {
      const { unitStatusHistories } = await import("@/db/schema/master");
      await tx.delete(unitStatusHistories).where(inArray(unitStatusHistories.unitId, projectUnitIds)).run();
    }

    // 8. Delete siteplan shapes & siteplans
    const projectSiteplans = await tx.select({ id: siteplans.id }).from(siteplans).where(eq(siteplans.projectId, id)).all();
    if (projectSiteplans.length > 0) {
      const spIds = projectSiteplans.map(sp => sp.id);
      await tx.delete(siteplanShapes).where(inArray(siteplanShapes.siteplanId, spIds)).run();
    }
    await tx.delete(siteplans).where(eq(siteplans.projectId, id)).run();

    // 9. Delete units
    await tx.delete(units).where(eq(units.projectId, id)).run();

    // 10. Delete project users
    await tx.delete(projectUsers).where(eq(projectUsers.projectId, id)).run();

    // 11. Delete the project itself
    await tx.delete(projects).where(eq(projects.id, id)).run();
  });

  await writeAuditLog({
    action: "delete",
    module: "master",
    entityId: id,
    entityType: "project",
    details: { forced: true, projectName: project.name },
  });

  revalidatePath("/master/projects");
  revalidatePath("/marketing/bookings");
  revalidatePath("/finance");
  revalidatePath("/production");
  revalidatePath("/dashboard");
  revalidatePath("/siteplan");
  return { success: true, message: `Proyek "${project.name}" beserta seluruh data terkait berhasil dihapus.` };
}

// --- UNITS ---
export async function createUnit(data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor"]);
  applyRateLimit(user.id);
  const parsed = unitSchema.parse(data);
  const id = crypto.randomUUID();
  const { readyStockVendorId, ...unitData } = parsed;

  if (!parsed.isReadyStock) {
    const ALLOWED_INITIAL_STATUSES = ["available", "belum_siap", "cancelled"];
    if (!ALLOWED_INITIAL_STATUSES.includes(parsed.status)) {
      throw new Error(`⚠️ Unit baru dengan alur Konstruksi ERP hanya dapat dibuat dengan status 'Tersedia', 'Belum Siap', atau 'Batal'. Status '${parsed.status}' wajib melalui alur transaksi ERP.`);
    }
  }

  let newSpkId: string | null = null;

  await db.transaction(async (tx) => {
    // 1. Create Unit
    await tx.insert(units).values({ 
      id, 
      ...unitData, 
      createdAt: new Date(), 
      updatedAt: new Date() 
    }).run();

    // 2. Auto-generate SPK & SPMB if Ready Stock
    if (parsed.isReadyStock && readyStockVendorId && (parsed.status === "available" || parsed.status === "construction")) {
      newSpkId = crypto.randomUUID();
      const spmbId = crypto.randomUUID();
      const timestamp = Date.now();
      const spkNumber = `SPK-RS-${timestamp}`;
      const spmbNumber = `SPMB-RS-${timestamp}`;
      const now = new Date();
      
      const isCompleted = parsed.status === "available";
      const progressPct = isCompleted ? 100 : 0;
      const spkStatus = isCompleted ? "selesai_konstruksi" : "active";
      const spmbStatus = isCompleted ? "completed" : "active";
      
      const targetEndDate = new Date(now);
      if (!isCompleted) targetEndDate.setMonth(targetEndDate.getMonth() + 3);

      await tx.insert(spks).values({
        id: newSpkId,
        spkNumber,
        projectId: parsed.projectId,
        unitId: id,
        vendorId: readyStockVendorId,
        title: `Pembangunan Ready Stock Kavling ${parsed.code}`,
        workDescription: "Pembuatan otomatis dari Master Unit (Bypass Ready Stock)",
        rabAmount: 0,
        startDate: now,
        targetEndDate: targetEndDate,
        actualEndDate: isCompleted ? now : null,
        status: spkStatus,
        progressPct: progressPct,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      }).run();

      await tx.insert(spmbs).values({
        id: spmbId,
        spmbNumber,
        spkId: newSpkId,
        issueDate: now,
        startWorkDate: now,
        targetEndDate: targetEndDate,
        status: spmbStatus,
        notes: "Diterbitkan otomatis dari Master Unit",
        createdBy: user.id,
        createdAt: now,
      }).run();

      // Update unit to link the new SPK
      await tx.update(units).set({ currentSpkId: newSpkId, constructionProgress: progressPct }).where(eq(units.id, id)).run();
    }
  });

  await writeAuditLog({ action: "create", module: "master", entityId: id, entityType: "unit", details: { code: parsed.code, autoSpk: !!newSpkId } });

  if (newSpkId) {
    await notifyNewSpkCreated(newSpkId, true);
  }

  revalidatePath("/master/units");
  revalidatePath("/production");
  revalidatePath("/marketing/bookings");
  return { success: true, id };
}

export async function updateUnit(id: string, data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor"]);
  applyRateLimit(user.id);
  const parsed = unitSchema.parse(data);
  const { readyStockVendorId, ...unitData } = parsed;

  let newSpkId: string | null = null;

  await db.transaction(async (tx) => {
    // Check existing SPK
    const existingUnit = await tx.select().from(units).where(eq(units.id, id)).get();
    if (!existingUnit) throw new Error("Unit not found");

    const TRANSACTIONAL_STATUSES = [
      "booking",
      "kpr_process",
      "payment_pending",
      "sold",
      "menunggu_serah_terima",
      "handover_complete",
      "construction",
      "construction_done",
      "overdue",
    ];

    const currentStatus = existingUnit.status;
    const newStatus = parsed.status;

    if (newStatus !== currentStatus) {
      const isReadyStockConstructionBypass = parsed.isReadyStock && newStatus === "construction";
      
      if (TRANSACTIONAL_STATUSES.includes(newStatus) && !isReadyStockConstructionBypass) {
        await safeWriteBlockedTransitionLog({
          module: "master",
          entityType: "unit",
          entityId: id,
          details: {
            action: "updateUnit_blocked_trans_status",
            currentStatus,
            attemptedStatus: newStatus,
            reason: "Status transaksional tidak dapat diubah langsung dari Master Unit.",
          },
        });
        throw new Error(
          "Status transaksional tidak dapat diubah langsung dari Master Unit. Gunakan workflow modul terkait."
        );
      }

      if (TRANSACTIONAL_STATUSES.includes(currentStatus)) {
        await safeWriteBlockedTransitionLog({
          module: "master",
          entityType: "unit",
          entityId: id,
          details: {
            action: "updateUnit_blocked_edit_trans_unit",
            currentStatus,
            attemptedStatus: newStatus,
            reason: "Unit sedang berada dalam alur transaksi. Status tidak dapat diubah dari Master Unit.",
          },
        });
        throw new Error(
          "Unit sedang berada dalam alur transaksi. Status tidak dapat diubah dari Master Unit."
        );
      }
    }

    const ALLOWED_TO_BECOME_AVAILABLE = ["available", "belum_siap", "cancelled"];
    if (parsed.status === "available" && !ALLOWED_TO_BECOME_AVAILABLE.includes(existingUnit.status) && parsed.readyStockSource === "construction_flow" && !existingUnit.isReadyStock) {
      throw new Error("⚠️ Unit dengan alur Konstruksi ERP wajib menyelesaikan pembangunan dan mengunggah BAST Vendor di modul Konstruksi untuk menjadi Tersedia.");
    }

    if (parsed.status === "construction" && existingUnit.status !== "construction" && !parsed.isReadyStock) {
      throw new Error("⚠️ Unit tidak dapat langsung diset 'Proses Bangun'. Status 'Proses Bangun' hanya dapat diubah melalui SPK Konstruksi.");
    }

    let finalSpkId = existingUnit.currentSpkId;

    if (parsed.isReadyStock && readyStockVendorId && (parsed.status === "available" || parsed.status === "construction") && !existingUnit.currentSpkId) {
      newSpkId = crypto.randomUUID();
      finalSpkId = newSpkId;
      const spmbId = crypto.randomUUID();
      const timestamp = Date.now();
      const spkNumber = `SPK-RS-${timestamp}`;
      const spmbNumber = `SPMB-RS-${timestamp}`;
      const now = new Date();
      
      const isCompleted = parsed.status === "available";
      const progressPct = isCompleted ? 100 : 0;
      const spkStatus = isCompleted ? "selesai_konstruksi" : "active";
      const spmbStatus = isCompleted ? "completed" : "active";
      
      const targetEndDate = new Date(now);
      if (!isCompleted) targetEndDate.setMonth(targetEndDate.getMonth() + 3);

      await tx.insert(spks).values({
        id: newSpkId,
        spkNumber,
        projectId: parsed.projectId,
        unitId: id,
        vendorId: readyStockVendorId,
        title: `Pembangunan Ready Stock Kavling ${parsed.code}`,
        workDescription: "Pembuatan otomatis dari Master Unit (Bypass Ready Stock)",
        rabAmount: 0,
        startDate: now,
        targetEndDate: targetEndDate,
        actualEndDate: isCompleted ? now : null,
        status: spkStatus,
        progressPct: progressPct,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      }).run();

      await tx.insert(spmbs).values({
        id: spmbId,
        spmbNumber,
        spkId: newSpkId,
        issueDate: now,
        startWorkDate: now,
        targetEndDate: targetEndDate,
        status: spmbStatus,
        notes: "Diterbitkan otomatis dari Master Unit",
        createdBy: user.id,
        createdAt: now,
      }).run();
    }

    const progressToUpdate = newSpkId ? (parsed.status === "available" ? 100 : 0) : existingUnit.constructionProgress;

    await tx.update(units).set({ 
      ...unitData, 
      currentSpkId: finalSpkId,
      constructionProgress: progressToUpdate,
      updatedAt: new Date() 
    }).where(eq(units.id, id)).run();
  });

  await writeAuditLog({ action: "update", module: "master", entityId: id, entityType: "unit", details: { code: parsed.code, autoSpk: !!newSpkId } });

  if (newSpkId) {
    await notifyNewSpkCreated(newSpkId, true);
  }

  revalidatePath("/master/units");
  revalidatePath("/production");
  revalidatePath("/marketing/bookings");
  return { success: true };
}

export async function deleteUnit(id: string) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor"]);
  applyRateLimit(user.id);

  const [targetUnit] = await db.select().from(units).where(eq(units.id, id));
  if (!targetUnit) throw new Error("Unit tidak ditemukan.");
  
  const DELETABLE_STATUSES = ["available", "belum_siap", "cancelled"];
  if (!DELETABLE_STATUSES.includes(targetUnit.status)) {
    throw new Error("Tidak dapat menghapus kavling. Status kavling tidak 'Tersedia', 'Belum Siap', atau 'Batal' (sudah dibooking/kpr/terjual).");
  }

  // Clear unitId from shapes to avoid orphaned shape data in UI
  await db.update(siteplanShapes)
    .set({ unitId: null })
    .where(eq(siteplanShapes.unitId, id));

  await db.delete(units).where(eq(units.id, id));
  await writeAuditLog({ action: "delete", module: "master", entityId: id, entityType: "unit" });

  revalidatePath("/master/units");
  revalidatePath("/marketing/bookings");
  return { success: true };
}

export async function bulkDeleteUnits(ids: string[]) {
  await requireAnyRole(["Super Admin", "Admin Kantor"]);

  if (!ids || ids.length === 0) {
    throw new Error("Tidak ada unit yang dipilih untuk dihapus.");
  }

  // Fetch all targeted units and check their status
  const targetUnits = await db.select().from(units).where(inArray(units.id, ids));

  const DELETABLE_STATUSES = ["available", "belum_siap", "cancelled"];
  const nonDeletable = targetUnits.filter(u => !DELETABLE_STATUSES.includes(u.status));
  if (nonDeletable.length > 0) {
    const codes = nonDeletable.map(u => u.code).join(", ");
    throw new Error(
      `Tidak dapat menghapus ${nonDeletable.length} kavling (${codes}). Hanya kavling dengan status 'Tersedia', 'Belum Siap', atau 'Batal' yang dapat dihapus.`
    );
  }

  // Clear unitId from shapes first
  await db.update(siteplanShapes)
    .set({ unitId: null })
    .where(inArray(siteplanShapes.unitId, ids));

  // Delete all units in bulk
  await db.delete(units).where(inArray(units.id, ids));

  await writeAuditLog({
    action: "bulk_delete",
    module: "master",
    entityId: ids.join(","),
    entityType: "unit",
    details: { count: ids.length, codes: targetUnits.map(u => u.code) },
  });

  revalidatePath("/master/units");
  revalidatePath("/marketing/bookings");
  return { success: true, deletedCount: ids.length };
}

// --- CUSTOMERS ---
export async function createCustomer(data: unknown) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  const parsed = customerSchema.parse(data);
  const id = crypto.randomUUID();

  await db.insert(customers).values({ id, ...parsed, createdAt: new Date(), updatedAt: new Date() });
  await writeAuditLog({ action: "create", module: "master", entityId: id, entityType: "customer", details: { name: parsed.name } });

  revalidatePath("/master/customers");
  revalidatePath("/marketing/bookings");
  return { success: true, id };
}

export async function updateCustomer(id: string, data: unknown) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  const parsed = customerSchema.parse(data);

  await db.update(customers).set({ ...parsed, updatedAt: new Date() }).where(eq(customers.id, id));
  await writeAuditLog({ action: "update", module: "master", entityId: id, entityType: "customer", details: { name: parsed.name } });

  revalidatePath("/master/customers");
  revalidatePath("/marketing/bookings");
  return { success: true };
}

export async function deleteCustomer(id: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);

  // Prevent deletion if customer has active bookings
  const customerBookings = await db.select().from(bookings).where(eq(bookings.customerId, id));
  if (customerBookings.length > 0) {
    throw new Error("Tidak dapat menghapus konsumen. Konsumen memiliki riwayat atau transaksi pemesanan (booking).");
  }

  await db.delete(customers).where(eq(customers.id, id));
  await writeAuditLog({ action: "delete", module: "master", entityId: id, entityType: "customer" });

  revalidatePath("/master/customers");
  revalidatePath("/marketing/bookings");
  return { success: true };
}

// --- VENDORS ---
export async function provisionVendorAccount(vendorId: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor"]);

  // Layer 1 — Vendor harus ada
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!vendor) throw new Error("Vendor tidak ditemukan.");

  // Layer 2 — Vendor harus active
  if (vendor.status !== "active") {
    throw new Error("Vendor tidak aktif. Akun login tidak dapat dibuat untuk vendor nonaktif.");
  }

  // Layer 3 — Vendor harus punya email
  if (!vendor.email || vendor.email.trim() === "") {
    throw new Error("Vendor belum memiliki email. Tambahkan email terlebih dahulu sebelum membuat akun.");
  }

  // Layer 4 — Normalisasi email
  const normalizedEmail = vendor.email.trim().toLowerCase();

  // Layer 5 — Vendor belum boleh punya vendorProfile
  const [existingProfile] = await db
    .select({ id: vendorProfiles.id })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.vendorId, vendorId))
    .limit(1);
  if (existingProfile) {
    throw new Error("Vendor sudah memiliki akun login.");
  }

  // Layer 6 — Email belum boleh dipakai user lain
  const [existingUser] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, normalizedEmail))
    .limit(1);
  if (existingUser) {
    throw new Error(
      "Email sudah terdaftar di sistem. Hubungkan akun secara manual atau gunakan email lain."
    );
  }

  // Generate password random (tidak disimpan plain text)
  const tempPassword = `Vendor@${crypto.randomUUID().slice(0, 8)}`;

  // Buat user via Better Auth (async, di LUAR transaction)
  const authResult = await auth.api.signUpEmail({
    body: {
      name: vendor.name,
      email: normalizedEmail,
      password: tempPassword,
    },
  });
  if (!authResult?.user) throw new Error("Gagal membuat akun pengguna.");

  // Assign role + buat vendorProfile dalam transaction sync
  const vendorCode = `VND-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  try {
    await db.transaction(async (tx) => {
      await tx.update(userTable)
        .set({
          roleId: "role_vendor",
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, authResult.user.id))
        .run();

      await tx.insert(vendorProfiles).values({
        id: crypto.randomUUID(),
        userId: authResult.user.id,
        vendorId: vendor.id,
        vendorCode,
        companyName: vendor.name,
        picPhone: vendor.phone || null,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();
    });
  } catch (txErr) {
    // Orphan user safety — nonaktifkan user yang gagal di-link
    await db
      .update(userTable)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(userTable.id, authResult.user.id));

    throw new Error(
      "Akun pengguna berhasil dibuat, tetapi gagal menghubungkan ke vendor. " +
      "Akun telah dinonaktifkan dan perlu diperiksa Admin."
    );
  }

  // Audit log — TANPA tempPassword
  await writeAuditLog({
    action: "create",
    module: "master",
    entityId: vendor.id,
    entityType: "vendor_account",
    details: { vendorName: vendor.name, email: normalizedEmail, vendorCode },
  });

  revalidatePath("/master/vendors");

  // Kembalikan credential — hanya sekali, tidak tersimpan
  return {
    success: true,
    accountCreated: true,
    vendorId: vendor.id,
    userId: authResult.user.id,
    email: normalizedEmail,
    tempPassword,
  };
}

export async function createVendor(data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor"]);
  const parsed = vendorSchema.parse(data);

  // Normalisasi email sebelum simpan
  const normalizedEmail = parsed.email ? parsed.email.trim().toLowerCase() : undefined;
  const vendorData = { ...parsed, email: normalizedEmail };

  const id = crypto.randomUUID();
  await db.insert(vendors).values({ id, ...vendorData, createdAt: new Date() });
  await writeAuditLog({
    action: "create", module: "master", entityId: id, entityType: "vendor",
    details: { name: parsed.name },
  });

  // Auto-provision akun jika vendor punya email dan active
  let provisionResult: {
    accountCreated: boolean;
    email?: string;
    tempPassword?: string;
    warning?: string;
  } = { accountCreated: false };

  if (normalizedEmail && parsed.status === "active") {
    try {
      const result = await provisionVendorAccount(id);
      provisionResult = {
        accountCreated: result.accountCreated,
        email: result.email,
        tempPassword: result.tempPassword,
      };
    } catch (err: unknown) {
      // Non-fatal — vendor tetap tersimpan
      provisionResult = {
        accountCreated: false,
        warning: err instanceof Error ? err.message : "Akun login tidak berhasil dibuat secara otomatis.",
      };
    }
  }

  revalidatePath("/master/vendors");
  return { success: true, id, ...provisionResult };
}

export async function updateVendor(id: string, data: unknown) {
  await requireAnyRole(["Super Admin", "Admin Kantor"]);
  const parsed = vendorSchema.parse(data);

  // Normalisasi email jika berubah
  const normalizedEmail = parsed.email ? parsed.email.trim().toLowerCase() : undefined;
  const vendorData = { ...parsed, email: normalizedEmail };

  await db.update(vendors).set({ ...vendorData }).where(eq(vendors.id, id));

  // Sync status akun — wajib filter by vendorId, bukan companyName
  const [profile] = await db
    .select({ userId: vendorProfiles.userId })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.vendorId, id))   // ← filter by vendorId, bukan nama
    .limit(1);

  if (profile) {
    const newUserStatus = parsed.status === "active" ? "active" : "inactive";
    await db
      .update(userTable)
      .set({ status: newUserStatus, updatedAt: new Date() })
      .where(eq(userTable.id, profile.userId));
  }

  await writeAuditLog({
    action: "update", module: "master", entityId: id, entityType: "vendor",
    details: { name: parsed.name, status: parsed.status },
  });

  revalidatePath("/master/vendors");
  return { success: true };
}

export async function deleteVendor(id: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor"]);

  // Block deletion if vendor is referenced by existing SPK records
  const vendorSpks = await db.select({ id: spks.id }).from(spks).where(eq(spks.vendorId, id)).limit(1);
  if (vendorSpks.length > 0) {
    throw new Error("Tidak dapat menghapus vendor. Terdapat Surat Perintah Kerja (SPK) yang masih menggunakan vendor ini.");
  }

  await db.delete(vendors).where(eq(vendors.id, id));
  await writeAuditLog({ action: "delete", module: "master", entityId: id, entityType: "vendor" });

  revalidatePath("/master/vendors");
  return { success: true };
}

// --- FINANCE CATEGORIES ---
export async function getFinanceCategories() {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Admin Keuangan", "Direksi / Manager"]);
  return db.select().from(financeCategories).orderBy(financeCategories.name);
}

export async function createFinanceCategory(data: unknown) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Admin Keuangan"]);
  const parsed = financeCategorySchema.parse(data);
  const id = crypto.randomUUID();

  await db.insert(financeCategories).values({
    id,
    name: parsed.name,
    type: parsed.type,
    parentId: parsed.parentId || null,
    status: "active",
  });

  await writeAuditLog({
    action: "create",
    module: "master",
    entityId: id,
    entityType: "finance_category",
    details: { name: parsed.name, type: parsed.type },
  });

  revalidatePath("/master/categories");
  revalidatePath("/finance/transactions");
  revalidatePath("/finance/budgets");
  return { success: true, id };
}

export async function updateFinanceCategory(id: string, data: unknown) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Admin Keuangan"]);
  const parsed = financeCategorySchema.parse(data);

  await db.update(financeCategories)
    .set({
      name: parsed.name,
      type: parsed.type,
      parentId: parsed.parentId || null,
    })
    .where(eq(financeCategories.id, id));

  await writeAuditLog({
    action: "update",
    module: "master",
    entityId: id,
    entityType: "finance_category",
    details: { name: parsed.name, type: parsed.type },
  });

  revalidatePath("/master/categories");
  revalidatePath("/finance/transactions");
  revalidatePath("/finance/budgets");
  return { success: true };
}

export async function deleteFinanceCategory(id: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Admin Keuangan"]);

  // Block deletion if category is used by any existing transaction or budget line
  const usedInTrx = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.categoryId, id)).limit(1);
  if (usedInTrx.length > 0) {
    throw new Error("Tidak dapat menghapus kategori. Terdapat transaksi keuangan yang menggunakan kategori ini.");
  }
  const usedInBudget = await db.select({ id: budgetLines.id }).from(budgetLines).where(eq(budgetLines.categoryId, id)).limit(1);
  if (usedInBudget.length > 0) {
    throw new Error("Tidak dapat menghapus kategori. Terdapat baris anggaran (budget lines) yang menggunakan kategori ini.");
  }

  await db.delete(financeCategories).where(eq(financeCategories.id, id));
  await writeAuditLog({
    action: "delete",
    module: "master",
    entityId: id,
    entityType: "finance_category",
  });

  revalidatePath("/master/categories");
  revalidatePath("/finance/transactions");
  revalidatePath("/finance/budgets");
  return { success: true };
}


// --- FINANCE ACCOUNTS ---
export async function getFinanceAccounts() {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Admin Keuangan", "Direksi / Manager"]);
  return db.select().from(financeAccounts).orderBy(financeAccounts.code);
}

export async function createFinanceAccount(data: unknown) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Admin Keuangan"]);
  const { financeAccountSchema } = await import("../validators/master");
  const parsed = financeAccountSchema.parse(data);
  const id = crypto.randomUUID();

  const existing = await db.select({ id: financeAccounts.id })
    .from(financeAccounts)
    .where(eq(financeAccounts.code, parsed.code))
    .limit(1);
  if (existing.length > 0) {
    throw new Error(`Kode akun "${parsed.code}" sudah digunakan. Gunakan kode yang berbeda.`);
  }

  await db.insert(financeAccounts).values({
    id, code: parsed.code, name: parsed.name,
    type: parsed.type, openingBalance: parsed.openingBalance, status: parsed.status,
  });
  await writeAuditLog({ action: "create", module: "master", entityId: id, entityType: "finance_account", details: { code: parsed.code, name: parsed.name, type: parsed.type } });
  revalidatePath("/master/accounts"); revalidatePath("/finance");
  return { success: true, id };
}

export async function updateFinanceAccount(id: string, data: unknown) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Admin Keuangan"]);
  const { financeAccountSchema } = await import("../validators/master");
  const parsed = financeAccountSchema.parse(data);

  const existing = await db.select({ id: financeAccounts.id })
    .from(financeAccounts).where(eq(financeAccounts.code, parsed.code)).limit(1);
  if (existing.length > 0 && existing[0].id !== id) {
    throw new Error(`Kode akun "${parsed.code}" sudah digunakan oleh rekening lain.`);
  }
  // openingBalance is IMMUTABLE � DO NOT update it
  await db.update(financeAccounts)
    .set({ code: parsed.code, name: parsed.name, type: parsed.type, status: parsed.status })
    .where(eq(financeAccounts.id, id));
  await writeAuditLog({ action: "update", module: "master", entityId: id, entityType: "finance_account", details: { code: parsed.code, name: parsed.name } });
  revalidatePath("/master/accounts"); revalidatePath("/finance");
  return { success: true };
}

export async function deleteFinanceAccount(id: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor"]);
  const usedInTrx = await db.select({ id: transactions.id })
    .from(transactions).where(eq(transactions.accountId, id)).limit(1);
  if (usedInTrx.length > 0) {
    throw new Error("Tidak dapat menghapus rekening. Terdapat transaksi yang menggunakan rekening ini. Nonaktifkan saja rekening tersebut.");
  }
  await db.delete(financeAccounts).where(eq(financeAccounts.id, id));
  await writeAuditLog({ action: "delete", module: "master", entityId: id, entityType: "finance_account" });
  revalidatePath("/master/accounts"); revalidatePath("/finance");
  return { success: true };
}

export async function updateUnitDefectList(id: string, notes: string, fileData?: { fileName: string; fileUrl: string; fileSize?: number; mimeType?: string }) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager", "Pengawas Lapangan"]);
  const { attachments } = await import("@/db/schema/system");
  
  await db.transaction(async (tx) => {
    // 1. Update notes
    await tx.update(units).set({
      notes,
      updatedAt: new Date()
    }).where(eq(units.id, id)).run();

    // 2. Insert attachment if provided
    if (fileData) {
      const attachmentId = crypto.randomUUID();
      await tx.insert(attachments).values({
        id: attachmentId,
        entityId: id,
        entityType: "unit",
        fileName: fileData.fileName,
        fileUrl: fileData.fileUrl,
        fileSize: fileData.fileSize || null,
        mimeType: fileData.mimeType || null,
        uploadedBy: user.id,
        createdAt: new Date(),
      }).run();
    }
  });

  await writeAuditLog({
    action: "update",
    module: "master",
    entityId: id,
    entityType: "unit",
    details: { type: "defect_list_notes", hasAttachment: !!fileData },
  });

  revalidatePath("/siteplan");
  return { success: true };
}

export async function deleteUnitAttachment(attachmentId: string) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager", "Pengawas Lapangan"]);
  const { attachments } = await import("@/db/schema/system");
  
  const [target] = await db.select().from(attachments).where(eq(attachments.id, attachmentId));
  if (!target) throw new Error("Lampiran tidak ditemukan.");
  
  await db.delete(attachments).where(eq(attachments.id, attachmentId));
  
  await writeAuditLog({
    action: "delete",
    module: "master",
    entityId: target.entityId,
    entityType: "unit",
    details: { type: "defect_attachment", fileName: target.fileName },
  });

  revalidatePath("/siteplan");
  return { success: true };
}

