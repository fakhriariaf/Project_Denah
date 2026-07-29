"use server";

import { db } from "@/db";
import { bookings, leads } from "@/db/schema/marketing";
import { customers, projects, units } from "@/db/schema/master";
import { user as userTable } from "@/db/schema/auth";
import { requireAnyRole } from "../permissions";
import { safeAction } from "./safe-action";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-utils";
import * as XLSX from "xlsx";

interface BulkDeleteResult {
  deleted: number;
  skipped: { id: string; reason: string }[];
}

interface BulkExportResult {
  fileBase64: string;
  fileName: string;
  rowCount: number;
}

/**
 * Normalises the client-supplied id list before it reaches `inArray(...)`.
 * Server actions receive whatever the RPC payload contains, so the declared
 * `string[]` type is not a runtime guarantee: a non-array or a list holding
 * objects/nulls would otherwise be handed straight to the query builder.
 */
function assertBulkIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("Tidak ada item yang dipilih.");
  }
  if (ids.length > 100) {
    throw new Error("Maksimal 100 item dapat diproses dalam satu operasi.");
  }
  const cleaned = ids.map((id) => (typeof id === "string" ? id.trim() : ""));
  if (cleaned.some((id) => id.length === 0)) {
    throw new Error("Daftar item tidak valid.");
  }
  return Array.from(new Set(cleaned));
}

/**
 * Bulk delete server action for bookings or leads.
 *
 * RBAC: Only Super Admin and Admin Kantor can perform bulk delete.
 * Items with status "completed" or "akad" are excluded from deletion.
 * All eligible deletions run in a single database transaction for atomicity.
 * If the transaction fails, all changes are rolled back.
 * Timeout: 30 seconds maximum.
 */
export const bulkDelete = safeAction(
  async (input: {
    entityType: "booking" | "lead";
    ids: string[];
  }): Promise<BulkDeleteResult> => {
    const { entityType } = input;

    if (entityType !== "booking" && entityType !== "lead") {
      throw new Error("Jenis data tidak dikenali.");
    }

    // RBAC check — only Super Admin and Admin Kantor
    await requireAnyRole(["Super Admin", "Admin Kantor"]);

    const ids = assertBulkIds(input.ids);

    // BUG 12 FIX: Store timer reference and clearTimeout when deletion finishes first
    // Prevents timer from lingering in edge runtimes after Promise.race resolves
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error("Operasi gagal. Tidak ada data yang berubah."));
      }, 30000);
    });

    // Execute the deletion logic with timeout
    const deletionPromise = executeBulkDelete(entityType, ids);

    const result = await Promise.race([deletionPromise, timeoutPromise]).finally(() => {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    });

    // Revalidate relevant paths after successful deletion
    if (entityType === "booking") {
      revalidatePath("/marketing/bookings");
      revalidatePath("/dashboard");
    } else {
      revalidatePath("/marketing/leads");
    }

    return result;
  }
);

async function executeBulkDelete(
  entityType: "booking" | "lead",
  ids: string[]
): Promise<BulkDeleteResult> {
  const skipped: { id: string; reason: string }[] = [];
  const toDelete: string[] = [];

  if (entityType === "booking") {
    // Booking bukan entitas yang aman untuk hard-delete: ia dapat memiliki
    // invoice, pembayaran, KPR, serta status unit. Semua pembatalan wajib
    // melalui cancelBooking() agar guard dan riwayat status berjalan.
    const items = await db
      .select({ id: bookings.id, status: bookings.status })
      .from(bookings)
      .where(inArray(bookings.id, ids));

    // Bulk delete booking sengaja dinonaktifkan; jangan pernah melewati guard
    // pembatalan hanya karena aksi berasal dari tabel massal.
    for (const item of items) {
      skipped.push({
        id: item.id,
        reason: "Booking tidak dapat dihapus massal. Gunakan aksi Batalkan Booking agar pembayaran, unit, dan riwayat tetap konsisten.",
      });
    }

    // Also track IDs that were provided but not found in the database
    const foundIds = new Set(items.map((i) => i.id));
    for (const id of ids) {
      if (!foundIds.has(id)) {
        skipped.push({
          id,
          reason: "Item tidak ditemukan",
        });
      }
    }

  } else {
    // entityType === "lead"
    // Leads don't have "completed"/"akad" status, but we still check for "converted" as a safety measure
    // Per the design spec, only "completed" and "akad" are excluded — leads use different statuses
    // However, per the requirement, we filter based on the same rule:
    // items with status "completed" or "akad" cannot be deleted.
    // Leads statuses are: new, contacted, follow_up, converted, lost
    // None of them are "completed" or "akad", so all leads are eligible for deletion.
    const items = await db
      .select({ id: leads.id, status: leads.status })
      .from(leads)
      .where(inArray(leads.id, ids));

    for (const item of items) {
      // Apply the same exclusion rule for consistency
      // Leads don't have "completed"/"akad" statuses, but check generically for safety
      const status = item.status as string;
      if (status === "completed" || status === "akad") {
        skipped.push({
          id: item.id,
          reason: "Item dengan status completed/akad tidak dapat dihapus",
        });
      } else {
        toDelete.push(item.id);
      }
    }

    // Track IDs not found
    const foundIds = new Set(items.map((i) => i.id));
    for (const id of ids) {
      if (!foundIds.has(id)) {
        skipped.push({
          id,
          reason: "Item tidak ditemukan",
        });
      }
    }

    // Execute deletion in a single transaction for atomicity
    if (toDelete.length > 0) {
      await db.transaction(async (tx) => {
        await tx.delete(leads).where(inArray(leads.id, toDelete));
      });
    }
  }

  return {
    deleted: toDelete.length,
    skipped,
  };
}


/**
 * Bulk export server action for bookings or leads.
 *
 * RBAC (P0 hardening): booking & lead exports emit customer PII (nama, telepon,
 * nilai booking fee) into a downloadable file, so `requireAuth()` alone was too
 * broad — it let Kontraktor / Vendor and Viewer accounts bulk-exfiltrate the
 * customer database. Export is now limited to the roles that already own the
 * marketing pipeline.
 *
 * Generates a .xlsx file with all visible table columns for selected items.
 * Returns the file as a base64 string for client-side download.
 */
export const bulkExport = safeAction(
  async (input: {
    entityType: "booking" | "lead";
    ids: string[];
  }): Promise<BulkExportResult> => {
    const { entityType } = input;

    if (entityType !== "booking" && entityType !== "lead") {
      throw new Error("Jenis data ekspor tidak dikenali.");
    }

    // PII export gate — same role-set for booking and lead (both carry customer data).
    await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing Manager"]);

    const ids = assertBulkIds(input.ids);

    let worksheetData: Record<string, unknown>[] = [];
    let fileName: string;

    if (entityType === "booking") {
      // Fetch bookings with JOINs for all visible table columns
      const items = await db
        .select({
          bookingNumber: bookings.bookingNumber,
          status: bookings.status,
          bookingDate: bookings.bookingDate,
          customerName: customers.name,
          unitCode: units.code,
          projectName: projects.name,
          marketingName: userTable.name,
          bookingFee: bookings.bookingFee,
          paymentScheme: bookings.paymentScheme,
        })
        .from(bookings)
        .leftJoin(customers, eq(bookings.customerId, customers.id))
        .leftJoin(units, eq(bookings.unitId, units.id))
        .leftJoin(projects, eq(bookings.projectId, projects.id))
        .leftJoin(userTable, eq(bookings.marketingId, userTable.id))
        .where(inArray(bookings.id, ids));

      // Map to human-readable column names
      worksheetData = items.map((item) => ({
        "No. Booking": item.bookingNumber,
        "Status": formatBookingStatus(item.status),
        "Tanggal Booking": item.bookingDate
          ? formatDateExport(item.bookingDate)
          : "-",
        "Nama Customer": item.customerName || "-",
        "Kode Unit": item.unitCode || "-",
        "Proyek": item.projectName || "-",
        "Marketing": item.marketingName || "-",
        "Booking Fee": item.bookingFee,
        "Skema Pembayaran": formatPaymentScheme(item.paymentScheme),
      }));

      fileName = `export-bookings-${Date.now()}.xlsx`;
    } else {
      // entityType === "lead"
      // Fetch leads with JOINs for visible table columns
      const items = await db
        .select({
          name: leads.name,
          phone: leads.phone,
          source: leads.source,
          status: leads.status,
          marketingName: userTable.name,
          createdAt: leads.createdAt,
        })
        .from(leads)
        .leftJoin(userTable, eq(leads.assignedMarketingId, userTable.id))
        .where(inArray(leads.id, ids));

      // Map to human-readable column names
      worksheetData = items.map((item) => ({
        "Nama": item.name,
        "Telepon": item.phone,
        "Sumber": formatLeadSource(item.source),
        "Status": formatLeadStatus(item.status),
        "Marketing PIC": item.marketingName || "-",
        "Tanggal Dibuat": item.createdAt
          ? formatDateExport(item.createdAt)
          : "-",
      }));

      fileName = `export-leads-${Date.now()}.xlsx`;
    }

    // Generate Excel file using XLSX (SheetJS)
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, entityType === "booking" ? "Bookings" : "Leads");

    // Write workbook to buffer and convert to base64
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const fileBase64 = Buffer.from(buffer).toString("base64");

    return {
      fileBase64,
      fileName,
      rowCount: worksheetData.length,
    };
  }
);

// --- Helper formatters ---

function formatBookingStatus(status: string): string {
  const map: Record<string, string> = {
    active: "Aktif",
    cancelled: "Dibatalkan",
    akad: "Akad",
    completed: "Selesai",
  };
  return map[status] || status;
}

function formatPaymentScheme(scheme: string): string {
  const map: Record<string, string> = {
    cash: "Cash",
    kpr: "KPR",
    installment: "Cash Bertahap",
  };
  return map[scheme] || scheme;
}

function formatLeadSource(source: string): string {
  const map: Record<string, string> = {
    walk_in: "Walk In",
    ads: "Iklan Digital",
    referral: "Referral",
    social_media: "Sosial Media",
    website: "Website",
    other: "Lainnya",
  };
  return map[source] || source;
}

function formatLeadStatus(status: string): string {
  const map: Record<string, string> = {
    new: "Baru",
    contacted: "Dihubungi",
    follow_up: "Follow Up",
    converted: "Deal",
    lost: "Tidak Jadi",
  };
  return map[status] || status;
}

function formatDateExport(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
