"use server";

import { db } from "@/db";
import type { PgTransaction } from "drizzle-orm/pg-core";

// Type alias for functions that accept either the db instance or a transaction
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbOrTx = typeof db | PgTransaction<any, any, any>;

import { 
  leads, 
  customerFollowups, 
  bookings, 
  bookingStatusHistories, 
  kprProcesses, 
  bankPartners, 
  bankSubmissions, 
  customerDocuments,
  waitingLists,
} from "@/db/schema/marketing";
import { invoices, payments, transactions } from "@/db/schema/finance";
import { units, customers, unitStatusHistories, financeAccounts, financeCategories, projects } from "@/db/schema/master";
import { attachments, notifications } from "@/db/schema/system";
import { user as userTable } from "@/db/schema/auth";
import { 
  leadSchema, 
  followupSchema, 
  bookingSchema, 
  bookingUpdateSchema,
  kprProcessSchema,
  kprUpdateSchema,
  bankPartnerSchema, 
  bankSubmissionSchema,
  realizeKprSchema
} from "../validators/marketing";
import { getBookingAkadReadiness } from "@/server/services/booking-akad-readiness";
import { getInstallmentProofGate } from "@/lib/booking-payment-gates";
import {
  getCashConstructionReadiness,
  getCashPemberkasanReadiness,
} from "@/server/services/booking-construction-readiness";
import { generateInvoiceSchedule, computeInvoiceSchedule, round2, computeOutstanding, validateBookingCancellation } from "@/server/services/booking.service";
import { requireAnyRole, getSessionRole, getUserRole } from "../permissions";
import { eq, and, or, sql, inArray, desc, asc, sum, lte, isNotNull, ilike, count } from "drizzle-orm";
import { calculateOffset, validatePaginationParams, type PaginatedResult } from "@/lib/pagination";
import { revalidatePath } from "next/cache";
import { writeAuditLog, safeWriteBlockedTransitionLog } from "./audit";
import { createNotification, notifyUsersWithRoles } from "./notification";
import { applyRateLimit } from "@/server/middleware/apply-rate-limit";

const KPR_PIPELINE_STATUSES = [
  "bi_checking",
  "pemberkasan",
  "proses_bank",
  "offering",
  "approved",
  "rejected",
  "akad",
] as const;

type KprPipelineStatus = (typeof KPR_PIPELINE_STATUSES)[number];

const KPR_ALLOWED_FORWARD_TRANSITIONS: Record<Exclude<KprPipelineStatus, "rejected" | "akad">, readonly KprPipelineStatus[]> = {
  bi_checking: ["pemberkasan", "rejected"],
  pemberkasan: ["proses_bank", "rejected"],
  proses_bank: ["offering", "rejected"],
  offering: ["approved", "rejected"],
  approved: ["akad"],
};

function parseKprPipelineStatus(status: string): KprPipelineStatus {
  if (!(KPR_PIPELINE_STATUSES as readonly string[]).includes(status)) {
    throw new Error("Status KPR tidak valid.");
  }
  return status as KprPipelineStatus;
}

// --- LEADS ---
export async function createLead(data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  applyRateLimit(user.id);
  const parsed = leadSchema.parse(data);
  const id = crypto.randomUUID();
  const targetPicId = parsed.assignedMarketingId || user.id;

  // Duplicate phone guard — block if active lead with same phone already exists
  const existingLeadByPhone = await db
    .select({ id: leads.id, name: leads.name, status: leads.status })
    .from(leads)
    .where(and(eq(leads.phone, parsed.phone), inArray(leads.status, ["new", "contacted", "follow_up"])))
    .limit(1)
    .get();

  if (existingLeadByPhone) {
    throw new Error(
      `Nomor HP ${parsed.phone} sudah terdaftar sebagai lead aktif atas nama "${existingLeadByPhone.name}". ` +
      `Gunakan nomor yang berbeda atau edit lead yang sudah ada.`
    );
  }

  await db.insert(leads).values({
    id,
    ...parsed,
    assignedMarketingId: targetPicId,
    createdAt: new Date(),
  });

  // Notify assigned marketing if not self-assigned
  if (targetPicId !== user.id) {
    await createNotification({
      userId: targetPicId,
      type: "info",
      title: "Penugasan Prospek Baru ??",
      message: `Anda telah ditunjuk oleh ${user.name} sebagai PIC untuk mengelola prospek baru bernama "${parsed.name}".`,
      entityId: id,
      entityType: "lead",
    });
  }

  await writeAuditLog({
    action: "create",
    module: "marketing",
    entityId: id,
    entityType: "lead",
    details: { name: parsed.name, source: parsed.source },
  });

  revalidatePath("/marketing/leads");
  return { success: true, id };
}

export async function updateLead(id: string, data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  applyRateLimit(user.id);
  const parsed = leadSchema.parse(data);

  const [existingLead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!existingLead) throw new Error("Lead tidak ditemukan.");

  // Server-side RBAC: Marketing Biasa cannot delegate leads to others
  const { role } = await getSessionRole(user.id);
  const isMarketingBiasa = role === "Marketing";
  
  if (isMarketingBiasa) {
    // Must always stay assigned to themselves
    if (!parsed.assignedMarketingId || parsed.assignedMarketingId !== user.id) {
      throw new Error("Marketing tidak dapat mengubah penugasan lead ke pengguna lain atau menghapus penugasan.");
    }
  }

  await db.update(leads).set({
    ...parsed,
  }).where(eq(leads.id, id));

  // Notify newly assigned marketing PIC if reassigned
  const oldPicId = existingLead.assignedMarketingId;
  const newPicId = parsed.assignedMarketingId;

  if (newPicId && newPicId !== oldPicId && newPicId !== user.id) {
    await createNotification({
      userId: newPicId,
      type: "info",
      title: "Penugasan Prospek Baru ??",
      message: `Anda telah ditunjuk oleh ${user.name} sebagai PIC baru untuk mengelola prospek bernama "${parsed.name}".`,
      entityId: id,
      entityType: "lead",
    });
  }

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: id,
    entityType: "lead",
    details: { name: parsed.name, status: parsed.status },
  });

  revalidatePath("/marketing/leads");
  return { success: true };
}

export async function deleteLead(id: string) {
  // Only Super Admin and Admin Kantor can delete leads (RBAC policy)
  const user = await requireAnyRole(["Super Admin", "Admin Kantor"]);
  applyRateLimit(user.id);

  await db.delete(leads).where(eq(leads.id, id));
  await writeAuditLog({
    action: "delete",
    module: "marketing",
    entityId: id,
    entityType: "lead",
  });

  revalidatePath("/marketing/leads");
  return { success: true };
}

// --- FOLLOW-UPS ---
export async function createFollowup(data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  applyRateLimit(user.id);
  const parsed = followupSchema.parse(data);
  const id = crypto.randomUUID();

  await db.insert(customerFollowups).values({
    id,
    customerId: parsed.customerId,
    leadId: parsed.leadId,
    followupDate: parsed.followupDate,
    method: parsed.method,
    result: parsed.result,
    nextFollowupAt: parsed.nextFollowupAt,
    createdBy: user.id,
    createdAt: new Date(),
  });

  await writeAuditLog({
    action: "create",
    module: "marketing",
    entityId: id,
    entityType: "customer_followup",
    details: { method: parsed.method, customerId: parsed.customerId, leadId: parsed.leadId },
  });

  revalidatePath("/marketing/leads");
  return { success: true, id };
}

// --- BOOKINGS & KPR FLOW ---

/**
 * BookingListItem ? shape returned by server-side paginated bookings query.
 */
export interface BookingListItem {
  id: string;
  bookingNumber: string;
  status: string;
  bookingDate: Date;
  bookingFee: number;
  dpAmount: number;
  paymentScheme: string;
  cancellationReason: string | null;
  termin: number | null;
  customerName: string | null;
  unitCode: string | null;
  projectName: string | null;
  marketingName: string | null;
  marketingId: string;
  projectId: string;
  unitId: string;
  customerId: string;
}

/**
 * Server-side paginated and filtered bookings query.
 * Eliminates N+1 by using LEFT JOINs and returns only the columns needed for the list view.
 */
export async function getBookingsPaginated(params: {
  page: number;
  pageSize?: number;
  status?: string;
  search?: string;
  marketingId?: string;
}): Promise<PaginatedResult<BookingListItem>> {
  const pageSize = params.pageSize || 20;

  // Build WHERE conditions
  const filterConditions: ReturnType<typeof eq>[] = [];

  // Status filter
  if (params.status) {
    filterConditions.push(eq(bookings.status, params.status as "active" | "cancelled" | "akad" | "completed"));
  }

  // Marketing filter (for RBAC scoping ? marketing biasa only sees own bookings)
  if (params.marketingId) {
    filterConditions.push(eq(bookings.marketingId, params.marketingId));
  }

  // Search filter ? case-insensitive partial match across multiple columns
  let searchCondition: ReturnType<typeof or> | undefined;
  if (params.search && params.search.trim() !== "") {
    const searchTerm = `%${params.search.trim()}%`;
    searchCondition = or(
      ilike(bookings.bookingNumber, searchTerm),
      ilike(customers.name, searchTerm),
      ilike(units.code, searchTerm),
      ilike(projects.name, searchTerm)
    );
  }

  // Combine all conditions
  const whereClause = searchCondition
    ? filterConditions.length > 0
      ? and(...filterConditions, searchCondition)
      : searchCondition
    : filterConditions.length > 0
      ? and(...filterConditions)
      : undefined;

  // Count query for pagination navigation
  const [countResult] = await db
    .select({ totalCount: count() })
    .from(bookings)
    .leftJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(units, eq(bookings.unitId, units.id))
    .leftJoin(projects, eq(bookings.projectId, projects.id))
    .where(whereClause);

  const totalCount = countResult?.totalCount ?? 0;

  // Validate and normalize pagination params
  const validatedParams = validatePaginationParams({ page: params.page, pageSize }, totalCount);
  const { limit, offset } = calculateOffset(validatedParams);
  const totalPages = Math.ceil(totalCount / validatedParams.pageSize);

  // Main data query with LEFT JOINs ? specific columns only
  const results = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      bookingDate: bookings.bookingDate,
      bookingFee: bookings.bookingFee,
      dpAmount: bookings.dpAmount,
      paymentScheme: bookings.paymentScheme,
      cancellationReason: bookings.cancellationReason,
      termin: bookings.termin,
      customerName: customers.name,
      unitCode: units.code,
      projectName: projects.name,
      marketingName: userTable.name,
      marketingId: bookings.marketingId,
      projectId: bookings.projectId,
      unitId: bookings.unitId,
      customerId: bookings.customerId,
    })
    .from(bookings)
    .leftJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(units, eq(bookings.unitId, units.id))
    .leftJoin(projects, eq(bookings.projectId, projects.id))
    .leftJoin(userTable, eq(bookings.marketingId, userTable.id))
    .where(whereClause)
    .orderBy(desc(bookings.bookingDate))
    .limit(limit)
    .offset(offset);

  return {
    data: results as BookingListItem[],
    totalCount,
    page: validatedParams.page,
    pageSize: validatedParams.pageSize,
    totalPages,
  };
}

export async function createBooking(data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  applyRateLimit(user.id);
  const parsed = bookingSchema.parse(data);
  const id = crypto.randomUUID();
  // BUG 4 FIX: Add random suffix to prevent duplicate bookingNumber on concurrent ms-same requests
  const bookingNumber = parsed.bookingNumber || `BOOK-${Date.now().toString().slice(-8)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase()}`;

  // Run as atomic database transaction
  const result = await db.transaction(async (tx) => {
    // 1. Verify Unit Status is Available
    const targetUnit = await tx.select().from(units).where(eq(units.id, parsed.unitId)).get();
    if (!targetUnit) {
      throw new Error("Unit tidak ditemukan.");
    }
    if (targetUnit.status !== "available") {
      throw new Error("Kavling sudah dipesan atau terjual!");
    }
    if (targetUnit.projectId !== parsed.projectId) {
      throw new Error("Unit yang dipilih tidak berada pada proyek booking.");
    }

    let finalCustomerId = parsed.customerId;
    if (parsed.isLead) {
      const leadRow = await tx.select().from(leads).where(eq(leads.id, parsed.customerId)).get();
      if (!leadRow) {
        throw new Error("Calon konsumen (Lead) tidak ditemukan.");
      }

      // Create a new Customer record from the Lead details and entered NIK
      const newCustId = crypto.randomUUID();
      await tx.insert(customers).values({
        id: newCustId,
        name: leadRow.name,
        phone: leadRow.phone,
        nik: parsed.nik || null,
        status: "booking",
        assignedMarketingId: leadRow.assignedMarketingId,
        source: "other",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();

      // Update Lead row to connect customerId and change status to converted
      await tx.update(leads).set({
        customerId: newCustId,
        status: "converted",
      }).where(eq(leads.id, leadRow.id)).run();

      finalCustomerId = newCustId;
    } else {
      const customer = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, parsed.customerId)).get();
      if (!customer) throw new Error("Konsumen tidak ditemukan.");
    }

    // 2. Insert Booking Row
    await tx.insert(bookings).values({
      id,
      bookingNumber,
      projectId: parsed.projectId,
      unitId: parsed.unitId,
      customerId: finalCustomerId,
      marketingId: parsed.marketingId,
      bookingDate: parsed.bookingDate,
      bookingFee: parsed.bookingFee,
      dpAmount: parsed.dpAmount,
      paymentScheme: parsed.paymentScheme,
      termin: parsed.termin || null,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    // 3. Update Unit status with optimistic lock:
    // WHERE status = 'available' ensures concurrent bookings of the same unit fail atomically.
    // SQLite does not support SELECT FOR UPDATE; this WHERE-clause pattern is the compensating control.
    // When a booking is created, the unit (kavling) status is always set to "booking" first.
    const finalUnitStatus = "booking";

    const updateResult = await tx
      .update(units)
      .set({
        status: finalUnitStatus,
        currentCustomerId: finalCustomerId,
        currentBookingId: id,
        updatedAt: new Date(),
      })
      .where(and(eq(units.id, parsed.unitId), eq(units.status, "available")))
      .returning();

    // If 0 rows were updated, the unit was concurrently booked by another request — abort
    if (updateResult.length === 0) {
      throw new Error("Kavling sudah dipesan oleh pihak lain secara bersamaan. Silakan refresh dan coba lagi.");
    }

    // 4. Update Customer status to booking
    await tx.update(customers).set({
      status: "booking",
      updatedAt: new Date(),
    }).where(eq(customers.id, finalCustomerId)).run();

    // 4b. Update any related leads to converted status
    await tx.update(leads).set({
      status: "converted",
    }).where(eq(leads.customerId, finalCustomerId)).run();

    // 5. Write Unit status history log
    const historyId = crypto.randomUUID();
    await tx.insert(unitStatusHistories).values({
      id: historyId,
      unitId: parsed.unitId,
      previousStatus: "available",
      newStatus: finalUnitStatus,
      reason: `Booking dibuat (${bookingNumber})${parsed.paymentScheme === "kpr" ? " - Skema KPR" : ""}`,
      changedBy: user.id,
      changedAt: new Date(),
    }).run();

    // 6. Write Booking status history
    await tx.insert(bookingStatusHistories).values({
      id: crypto.randomUUID(),
      bookingId: id,
      previousStatus: null,
      newStatus: "active",
      notes: "Booking fee berhasil disubmit",
      changedBy: user.id,
      changedAt: new Date(),
    }).run();

    // 7. If Skema KPR, initialize KPR Process with 5-day SLA
    if (parsed.paymentScheme === "kpr") {
      const kprId = crypto.randomUUID();
      const now = new Date();
      
      // Calculate 5 working/business days (skipping Saturday and Sunday)
      const deadline = new Date(now.getTime());
      let addedDays = 0;
      while (addedDays < 5) {
        deadline.setDate(deadline.getDate() + 1);
        const day = deadline.getDay();
        if (day !== 0 && day !== 6) { // 0 = Sunday, 6 = Saturday
          addedDays++;
        }
      }
      
      await tx.insert(kprProcesses).values({
        id: kprId,
        bookingId: id,
        status: "bi_checking",
        biCheckStatus: "pending",
        documentStatus: "incomplete",
        slaStartAt: now,
        slaDeadlineAt: deadline,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    // 8. Auto-generate invoice schedule (BF, DP, and installments if applicable)
    await generateInvoiceSchedule(
      tx as unknown as typeof db,
      {
        id,
        bookingFee: parsed.bookingFee,
        dpAmount: parsed.dpAmount,
        paymentScheme: parsed.paymentScheme as "cash" | "installment" | "kpr",
        termin: parsed.termin || null,
        bookingDate: parsed.bookingDate,
        projectId: parsed.projectId,
        unitId: parsed.unitId,
        customerId: finalCustomerId,
      },
      { price: targetUnit.price },
      user.id
    );

    return { id, bookingNumber };
  });

  await writeAuditLog({
    action: "create",
    module: "marketing",
    entityId: result.id,
    entityType: "booking",
    details: { bookingNumber: result.bookingNumber, unitId: parsed.unitId },
  });

  revalidatePath("/marketing/bookings");
  revalidatePath("/marketing/kpr");
  revalidatePath(`/siteplan/${parsed.projectId}`);
  revalidatePath("/dashboard");
  return { success: true, ...result };
}

export async function updateBooking(id: string, data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  applyRateLimit(user.id);
  const parsed = bookingUpdateSchema.parse(data);

  // Run as atomic database transaction
  const result = await db.transaction(async (tx) => {
    // 1. Verify Booking exists
    const existingBooking = await tx.select().from(bookings).where(eq(bookings.id, id)).get();
    if (!existingBooking) {
      throw new Error("Booking tidak ditemukan.");
    }
    if (existingBooking.status === "cancelled") {
      throw new Error("Booking yang sudah dibatalkan tidak dapat diedit.");
    }

    // 2. Query unit for price (needed for schedule computation)
    const unit = await tx.select().from(units).where(eq(units.id, existingBooking.unitId)).get();
    if (!unit) {
      throw new Error("Unit terkait booking tidak ditemukan.");
    }

    if (existingBooking.paymentScheme !== parsed.paymentScheme) {
      if (existingBooking.status !== "active" || !["booking", "kpr_process"].includes(unit.status)) {
        throw new Error("Skema pembayaran tidak dapat diubah setelah booking memasuki tahap akad, konstruksi, atau serah terima.");
      }
      const paidInvoice = await tx.select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.bookingId, id), inArray(invoices.status, ["paid", "partial"])))
        .get();
      if (paidInvoice) {
        throw new Error("Skema pembayaran tidak dapat diubah setelah ada invoice yang dibayar sebagian atau lunas.");
      }
      const kpr = await tx.select({ id: kprProcesses.id, status: kprProcesses.status })
        .from(kprProcesses)
        .where(eq(kprProcesses.bookingId, id))
        .get();
      const bankSubmission = kpr
        ? await tx.select({ id: bankSubmissions.id }).from(bankSubmissions).where(eq(bankSubmissions.kprProcessId, kpr.id)).get()
        : null;
      if ((kpr && kpr.status !== "bi_checking") || bankSubmission) {
        throw new Error("Skema pembayaran tidak dapat diubah setelah proses pengajuan KPR atau pengajuan bank dimulai.");
      }
    }

    // 3. If paymentScheme changes, handle KPR processes adjustments
    
    // If it was KPR and changes to non-KPR, we delete the KPR process and submissions (to be clean)
    if (existingBooking.paymentScheme === "kpr" && parsed.paymentScheme !== "kpr") {
      const kpr = await tx.select().from(kprProcesses).where(eq(kprProcesses.bookingId, id)).get();
      if (kpr) {
        await tx.delete(bankSubmissions).where(eq(bankSubmissions.kprProcessId, kpr.id)).run();
        await tx.delete(kprProcesses).where(eq(kprProcesses.bookingId, id)).run();
      }
      
      // Update unit status from kpr_process back to booking
      await tx.update(units).set({
        status: "booking",
        updatedAt: new Date(),
      }).where(eq(units.id, existingBooking.unitId)).run();
    } 
    // If it was non-KPR and changes to KPR, initialize KPR process if not exists
    else if (existingBooking.paymentScheme !== "kpr" && parsed.paymentScheme === "kpr") {
      const existingKpr = await tx.select().from(kprProcesses).where(eq(kprProcesses.bookingId, id)).get();
      if (!existingKpr) {
        const kprId = crypto.randomUUID();
        const now = new Date();
        
        // Calculate 5 working/business days (skipping Saturday and Sunday)
        const deadline = new Date(now.getTime());
        let addedDays = 0;
        while (addedDays < 5) {
          deadline.setDate(deadline.getDate() + 1);
          const day = deadline.getDay();
          if (day !== 0 && day !== 6) { // 0 = Sunday, 6 = Saturday
            addedDays++;
          }
        }
        
        await tx.insert(kprProcesses).values({
          id: kprId,
          bookingId: id,
          status: "bi_checking",
          biCheckStatus: "pending",
          documentStatus: "incomplete",
          slaStartAt: now,
          slaDeadlineAt: deadline,
          createdAt: now,
          updatedAt: now,
        }).run();
      }
      
      // Update unit status to booking
      await tx.update(units).set({
        status: "booking",
        updatedAt: new Date(),
      }).where(eq(units.id, existingBooking.unitId)).run();
    }

    // 4. Update Booking Row
    await tx.update(bookings).set({
      marketingId: parsed.marketingId,
      bookingDate: parsed.bookingDate,
      bookingFee: parsed.bookingFee,
      dpAmount: parsed.dpAmount,
      paymentScheme: parsed.paymentScheme,
      termin: parsed.paymentScheme === "installment" ? parsed.termin : null,
      updatedAt: new Date(),
    }).where(eq(bookings.id, id)).run();

    // 5. Invoice Schedule Management (Req 1.8, 1.9, 1.10, 1.11, 1.12, 1.13)
    const prevScheme = existingBooking.paymentScheme;
    const newScheme = parsed.paymentScheme || prevScheme;
    const bookingId = id;

    // CASE 1: cash/installment → kpr (Req 1.8)
    // Cancel all unpaid installment invoices; keep BF and DP unchanged
    if ((prevScheme === "cash" || prevScheme === "installment") && newScheme === "kpr") {
      await tx.update(invoices)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(
          eq(invoices.bookingId, bookingId),
          eq(invoices.type, "installment"),
          eq(invoices.status, "unpaid")
        ));
    }
    // CASE 2: kpr → cash/installment (Req 1.9)
    // Generate new pelunasan/termin invoices; generateInvoiceSchedule skips existing BF/DP
    else if (prevScheme === "kpr" && (newScheme === "cash" || newScheme === "installment")) {
      const updatedBookingForSchedule = {
        id: bookingId,
        bookingFee: parsed.bookingFee,
        dpAmount: parsed.dpAmount,
        paymentScheme: newScheme as "cash" | "installment" | "kpr",
        termin: newScheme === "installment" ? (parsed.termin || null) : null,
        bookingDate: parsed.bookingDate,
        projectId: existingBooking.projectId,
        unitId: existingBooking.unitId,
        customerId: existingBooking.customerId,
      };
      await generateInvoiceSchedule(
        tx as unknown as typeof db,
        updatedBookingForSchedule,
        { price: unit.price },
        user.id
      );
    }
    // CASE 3: Same scheme OR BF/DP amounts changed (Req 1.11, 1.12, 1.13)
    else if (newScheme === "cash" || newScheme === "installment") {
      // Query all existing invoices for this booking
      const existingInvoices = await tx.select().from(invoices).where(eq(invoices.bookingId, bookingId));

      // Guard: BF paid/partial + nominal change → reject (Req 1.11)
      const bfChanged = parsed.bookingFee !== existingBooking.bookingFee;
      if (bfChanged) {
        const bfInv = existingInvoices.find(
          i => i.scheduleKind === "booking_fee" && (i.status === "paid" || i.status === "partial")
        );
        if (bfInv) {
          throw new Error("Perubahan nominal Booking Fee membutuhkan proses adjustment terpisah karena invoice sudah terbayar.");
        }
      }

      // Guard: DP paid/partial + nominal change → reject (Req 1.11)
      const dpChanged = parsed.dpAmount !== existingBooking.dpAmount;
      if (dpChanged) {
        const dpInv = existingInvoices.find(
          i => i.scheduleKind === "dp" && (i.status === "paid" || i.status === "partial")
        );
        if (dpInv) {
          throw new Error("Perubahan nominal DP membutuhkan proses adjustment terpisah karena invoice sudah terbayar.");
        }
      }

      // Guard: installment paid/partial + schedule amount would change → reject (Req 1.12, 1.13)
      const paidPartialInstallments = existingInvoices.filter(
        i => i.scheduleKind === "installment" && (i.status === "paid" || i.status === "partial")
      );
      // Also check cash_settlement paid/partial
      const paidPartialCashSettlement = existingInvoices.filter(
        i => i.scheduleKind === "cash_settlement" && (i.status === "paid" || i.status === "partial")
      );

      if (paidPartialInstallments.length > 0 || paidPartialCashSettlement.length > 0) {
        // Compute new schedule to see if amounts differ
        const finalTermin = newScheme === "installment" ? (parsed.termin || null) : null;
        const newComponents = computeInvoiceSchedule(
          unit.price,
          parsed.bookingFee,
          parsed.dpAmount,
          newScheme as "cash" | "installment",
          finalTermin,
          parsed.bookingDate
        );

        // Check installment components
        for (const existing of paidPartialInstallments) {
          const matching = newComponents.find(
            c => c.kind === "installment" && c.seq === existing.scheduleSequence
          );
          if (matching && round2(matching.amount) !== round2(existing.amount)) {
            throw new Error("Perubahan jadwal cicilan membutuhkan adjustment manual karena terdapat invoice yang sudah terbayar sebagian/lunas.");
          }
          // If no matching component found (schedule shrunk), also reject
          if (!matching) {
            throw new Error("Perubahan jadwal cicilan membutuhkan adjustment manual karena terdapat invoice yang sudah terbayar sebagian/lunas.");
          }
        }

        // Check cash_settlement components
        for (const existing of paidPartialCashSettlement) {
          const matching = newComponents.find(c => c.kind === "cash_settlement");
          if (matching && round2(matching.amount) !== round2(existing.amount)) {
            throw new Error("Perubahan jadwal cicilan membutuhkan adjustment manual karena terdapat invoice yang sudah terbayar sebagian/lunas.");
          }
          if (!matching) {
            throw new Error("Perubahan jadwal cicilan membutuhkan adjustment manual karena terdapat invoice yang sudah terbayar sebagian/lunas.");
          }
        }
      }

      // Safe to recalculate — call generateInvoiceSchedule (idempotent upsert)
      const updatedBookingForSchedule = {
        id: bookingId,
        bookingFee: parsed.bookingFee,
        dpAmount: parsed.dpAmount,
        paymentScheme: newScheme as "cash" | "installment" | "kpr",
        termin: newScheme === "installment" ? (parsed.termin || null) : null,
        bookingDate: parsed.bookingDate,
        projectId: existingBooking.projectId,
        unitId: existingBooking.unitId,
        customerId: existingBooking.customerId,
      };
      await generateInvoiceSchedule(
        tx as unknown as typeof db,
        updatedBookingForSchedule,
        { price: unit.price },
        user.id
      );
    }

    // 6. Write Booking status history
    await tx.insert(bookingStatusHistories).values({
      id: crypto.randomUUID(),
      bookingId: id,
      previousStatus: existingBooking.status,
      newStatus: existingBooking.status,
      notes: `Booking diperbarui: BF=Rp ${parsed.bookingFee.toLocaleString("id-ID")}, DP=Rp ${parsed.dpAmount.toLocaleString("id-ID")}, Skema=${parsed.paymentScheme === "kpr" ? "KPR" : parsed.paymentScheme === "cash" ? "Cash" : `Cash Bertahap (${parsed.termin} Bulan)`}`,
      changedBy: user.id,
      changedAt: new Date(),
    }).run();

    return { id, bookingNumber: existingBooking.bookingNumber, projectId: existingBooking.projectId };
  });

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: result.id,
    entityType: "booking",
    details: { bookingNumber: result.bookingNumber, fieldsUpdated: ["bookingDate", "paymentScheme", "bookingFee", "dpAmount", "termin", "marketingId"] },
  });

  revalidatePath("/marketing/bookings");
  revalidatePath(`/marketing/bookings/${id}`);
  revalidatePath("/marketing/kpr");
  revalidatePath(`/siteplan/${result.projectId}`);
  revalidatePath("/dashboard");
  return { success: true, ...result };
}

export async function cancelBooking(id: string, reason: string) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  applyRateLimit(user.id);

  // BUG 1 FIX: Init projectId = "" to prevent uninitialized variable crash
  let projectId = "";
  await db.transaction(async (tx) => {
    // 1. Fetch booking INSIDE transaction — eliminates stale-read race condition (Req 10.7)
    const booking = await tx.select().from(bookings).where(eq(bookings.id, id)).get();
    if (!booking) throw new Error("Booking tidak ditemukan.");

    // Guard: booking already cancelled → reject (Req 10.6)
    if (booking.status === "cancelled") throw new Error("Booking sudah dibatalkan sebelumnya.");

    // P0 Guard: Use validateBookingCancellation service inside transaction (Req 10.1, 10.2, 10.7)
    const guard = await validateBookingCancellation(id, tx as unknown as typeof db);
    if (!guard.canCancel) {
      await safeWriteBlockedTransitionLog({
        module: "marketing",
        entityType: "booking",
        entityId: id,
        details: {
          action: `cancelBooking_blocked_${guard.reason}`,
          bookingId: id,
          reason: guard.message,
        },
      });
      throw new Error(guard.message);
    }

    projectId = booking.projectId;

    // 2. Update Booking status to cancelled (Req 10.3)
    await tx.update(bookings).set({
      status: "cancelled",
      cancellationReason: reason,
      updatedAt: new Date(),
    }).where(eq(bookings.id, id)).run();

    // 3. Cancel all invoices linked to this booking (Req 10.3)
    await tx.update(invoices).set({
      status: "cancelled",
      updatedAt: new Date(),
    }).where(eq(invoices.bookingId, id));

    // 4. Set Unit state back to available (Req 10.3)
    const unit = await tx.select().from(units).where(eq(units.id, booking.unitId)).get();
    const previousStatus = unit?.status || "booking";

    await tx.update(units).set({
      status: "available",
      currentCustomerId: null,
      currentBookingId: null,
      updatedAt: new Date(),
    }).where(eq(units.id, booking.unitId)).run();

    // 5. Revert Customer status back to prospect (available for future bookings)
    await tx.update(customers).set({
      status: "prospect",
      updatedAt: new Date(),
    }).where(eq(customers.id, booking.customerId)).run();

    // 6. Log status histories
    await tx.insert(unitStatusHistories).values({
      id: crypto.randomUUID(),
      unitId: booking.unitId,
      previousStatus,
      newStatus: "available",
      reason: `Booking dibatalkan: ${reason}`,
      changedBy: user.id,
      changedAt: new Date(),
    }).run();

    await tx.insert(bookingStatusHistories).values({
      id: crypto.randomUUID(),
      bookingId: id,
      previousStatus: booking.status,
      newStatus: "cancelled",
      notes: reason,
      changedBy: user.id,
      changedAt: new Date(),
    }).run();
  });

  // Audit log with action="cancel", module="marketing", entityType="booking" (Req 10.4)
  await writeAuditLog({
    action: "cancel",
    module: "marketing",
    entityId: id,
    entityType: "booking",
    details: { action: "cancel", cancellationReason: reason, userId: user.id },
  });

  revalidatePath("/marketing/bookings");
  revalidatePath("/marketing/kpr");
  // BUG 1 FIX: Guard against empty projectId (tx threw before assignment)
  if (projectId) revalidatePath(`/siteplan/${projectId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function isPhysicalReadyForKprAkad(unit: { id: string }, tx?: DbOrTx) {
  const executor = tx || db;
  const dbUnit = await executor.select().from(units).where(eq(units.id, unit.id)).get();
  if (!dbUnit) {
    return {
      ready: false,
      reason: "Unit tidak ditemukan.",
    };
  }

  const isReadyStock =
    !!dbUnit.isReadyStock ||
    dbUnit.readyStockSource === "legacy_ready_stock" ||
    dbUnit.readyStockSource === "manual_ready_stock";

  if (isReadyStock) {
    return {
      ready: true,
      reason: "Unit sudah Tersedia Siap Huni.",
    };
  }

  const isConstructionOrIndent =
    dbUnit.status === "construction" ||
    dbUnit.status === "overdue" ||
    dbUnit.status === "construction_done" ||
    dbUnit.status === "kpr_process" ||
    dbUnit.status === "booking";

  if (isConstructionOrIndent) {
    return {
      ready: false,
      reason: (dbUnit.constructionProgress ?? 0) === 100
        ? "Progress fisik sudah 100%, tetapi BAST Vendor ke Developer belum diverifikasi."
        : "Akad KPR untuk unit indent hanya dapat dilakukan setelah progress fisik 100% dan BAST Vendor diverifikasi.",
    };
  }

  return {
    ready: false,
    reason: `Status fisik unit (${dbUnit.status}) belum valid untuk Akad KPR.`,
  };
}

export async function validateKprStateTransition(
  tx: DbOrTx,
  kprId: string,
  targetStatus: string,
  payload: {
    approvedBankPartnerId?: string | null;
    biCheckStatus?: "pending" | "partial" | "approved" | "rejected_refund" | "rejected_no_refund";
    /** Hanya untuk menyimpan perubahan metadata pada tahap yang sama. */
    allowSameStage?: boolean;
  }
) {
  const newStatus = parseKprPipelineStatus(targetStatus);
  // 1. Fetch KPR process
  const kpr = await tx.select().from(kprProcesses).where(eq(kprProcesses.id, kprId)).get();
  if (!kpr) throw new Error("Proses KPR tidak ditemukan.");

  // 2. Fetch booking
  const booking = await tx.select().from(bookings).where(eq(bookings.id, kpr.bookingId)).get();
  if (!booking) throw new Error("Data booking tidak ditemukan.");

  if (["cancelled", "rejected"].includes(booking.status)) {
    throw new Error("Booking sudah batal/ditolak. Transaksi KPR tidak dapat diproses.");
  }

  // Booking Fee must be verified before any KPR processing can begin
  // Gate applies from pemberkasan onwards (bi_checking is just a status flag, not a process gate)
  const KPR_PROCESS_STAGES = ["pemberkasan", "proses_bank", "offering", "approved", "akad", "realisasi"];
  if (KPR_PROCESS_STAGES.includes(targetStatus)) {
    const bfInvoice = await tx
      .select({ id: invoices.id, status: invoices.status })
      .from(invoices)
      .where(
        and(
          eq(invoices.bookingId, booking.id),
          eq(invoices.type, "booking_fee")
        )
      )
      .get();

    if (!bfInvoice || bfInvoice.status !== "paid") {
      throw new Error(
        "Booking Fee belum diverifikasi lunas oleh Admin Keuangan. " +
        "Proses KPR tidak dapat dilanjutkan sebelum Booking Fee dikonfirmasi."
      );
    }
  }

  const currentStatus = kpr.status as KprPipelineStatus | "realisasi";
  if (currentStatus === "realisasi" || currentStatus === "rejected" || currentStatus === "akad") {
    throw new Error("KPR pada tahap terminal tidak dapat dipindahkan melalui pipeline.");
  }
  if (currentStatus === newStatus) {
    if (payload.allowSameStage) {
      return { kpr, booking, documentStatus: kpr.documentStatus };
    }
    throw new Error("KPR sudah berada pada tahap tersebut.");
  }
  if (!KPR_ALLOWED_FORWARD_TRANSITIONS[currentStatus].includes(newStatus)) {
    throw new Error(
      `Transisi KPR dari ${currentStatus} ke ${newStatus} tidak diperbolehkan. ` +
      "Gunakan tahap berikutnya sesuai urutan pipeline."
    );
  }

  // BI Checking harus memperoleh keputusan positif sebelum pemberkasan
  // dibuka. Status dari browser tidak digunakan sebagai sumber kebenaran.
  if (newStatus === "pemberkasan" && (payload.biCheckStatus ?? kpr.biCheckStatus) !== "approved") {
    throw new Error("Tahap Pemberkasan hanya dapat dibuka setelah BI Checking berstatus Disetujui.");
  }

  // Kelengkapan dokumen wajib dihitung dari dokumen yang benar-benar sudah
  // diverifikasi. Pemberkasan adalah tempat untuk mengumpulkan dokumen;
  // dokumen baru menjadi gate saat akan dikirim ke bank.
  const docs = await tx
    .select({ documentType: customerDocuments.documentType, status: customerDocuments.status })
    .from(customerDocuments)
    .where(eq(customerDocuments.bookingId, booking.id))
    .all();
  const kprDocumentsComplete = ["ktp", "kk", "npwp", "slip_gaji"].every((documentType) =>
    docs.some((document) => document.documentType === documentType && document.status === "verified")
  );
  if (["proses_bank", "offering", "approved", "akad"].includes(newStatus) && !kprDocumentsComplete) {
    throw new Error("Berkas KPR belum lengkap dan terverifikasi. KTP, Kartu Keluarga, NPWP, dan Slip Gaji wajib diverifikasi terlebih dahulu.");
  }

  // Validation for Proses Bank: requires verified bank submission
  if (newStatus === "proses_bank") {
    const verifiedOrHigher = await tx.select().from(bankSubmissions).where(
      and(
        eq(bankSubmissions.kprProcessId, kprId),
        inArray(bankSubmissions.status, ["verified", "offering", "approved"])
      )
    ).limit(1).all();

    if (verifiedOrHigher.length === 0) {
      throw new Error("Tidak dapat memindahkan status ke Proses Bank. Pengajuan ke bank partner harus berstatus minimal 'Verified' (Diverifikasi oleh analis bank) terlebih dahulu.");
    }
  }

  // 4. Validation for Offering / Approved / Akad: Requires corresponding bank submissions
  if (newStatus === "offering") {
    const offeringOrApproved = await tx.select().from(bankSubmissions).where(
      and(
        eq(bankSubmissions.kprProcessId, kprId),
        inArray(bankSubmissions.status, ["offering", "approved"])
      )
    ).limit(1).all();

    if (offeringOrApproved.length === 0) {
      throw new Error("Tidak dapat memindahkan status ke Offering. Harus ada pengajuan bank yang berstatus minimal 'Offering' terlebih dahulu.");
    }
  }

  if (newStatus === "approved") {
    const approved = await tx.select().from(bankSubmissions).where(
      and(
        eq(bankSubmissions.kprProcessId, kprId),
        eq(bankSubmissions.status, "approved")
      )
    ).limit(1).all();

    if (approved.length === 0) {
      throw new Error("Tidak dapat memindahkan status ke Approved. Pengajuan KPR harus sudah disetujui secara resmi oleh minimal satu bank rekanan (status pengajuan bank adalah 'Approved').");
    }
  }

  if (newStatus === "akad") {
    const approved = await tx.select().from(bankSubmissions).where(
      and(
        eq(bankSubmissions.kprProcessId, kprId),
        eq(bankSubmissions.status, "approved")
      )
    ).limit(1).all();

    if (approved.length === 0) {
      throw new Error("Tidak dapat memindahkan ke Akad. Pengajuan KPR belum disetujui oleh bank rekanan (SP3K belum disetujui).");
    }

    const unitForAkad = await tx.select().from(units).where(eq(units.id, booking.unitId)).get();
    if (unitForAkad) {
      const physical = await isPhysicalReadyForKprAkad(unitForAkad, tx);
      if (!physical.ready) {
        throw new Error(physical.reason);
      }
    }
  }

  if (payload.approvedBankPartnerId && ["offering", "approved", "akad"].includes(newStatus)) {
    const requiredSubmissionStatuses = newStatus === "offering"
      ? (["offering", "approved"] as const)
      : (["approved"] as const);
    const selectedSubmission = await tx
      .select({ id: bankSubmissions.id })
      .from(bankSubmissions)
      .where(and(
        eq(bankSubmissions.kprProcessId, kprId),
        eq(bankSubmissions.bankPartnerId, payload.approvedBankPartnerId),
        inArray(bankSubmissions.status, requiredSubmissionStatuses)
      ))
      .get();
    if (!selectedSubmission) {
      throw new Error("Bank penyetuju harus memiliki status pengajuan yang sesuai dengan tahap KPR.");
    }
  }

  return { kpr, booking, documentStatus: kprDocumentsComplete ? "complete" as const : "incomplete" as const };
}

export async function updateKprProcess(id: string, data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  // Use kprUpdateSchema (no bookingId required — resolved from DB by id)
  const parsed = kprUpdateSchema.parse(data);

  if (
    (parsed.status === "offering" || parsed.status === "approved" || parsed.status === "akad") &&
    !parsed.approvedBankPartnerId
  ) {
    throw new Error("Bank penyetuju wajib dipilih untuk status Offering, Approved, atau Akad.");
  }

  let bookingProjectId = "";
  let bookingIdToTransition = "";

  await db.transaction(async (tx) => {
    let derivedDocumentStatus: "complete" | "incomplete" = "incomplete";
    // Call KPR State Transition validator first, logging blocked attempts
    try {
      const transition = await validateKprStateTransition(tx, id, parsed.status, {
        approvedBankPartnerId: parsed.approvedBankPartnerId,
        biCheckStatus: parsed.biCheckStatus,
        allowSameStage: true,
      });
      derivedDocumentStatus = transition.documentStatus;
    } catch (err: unknown) {
      await safeWriteBlockedTransitionLog({
        module: "marketing",
        entityType: "kpr_process",
        entityId: id,
        details: {
          action: "updateKprProcess_blocked_transition",
          kprProcessId: id,
          targetStatus: parsed.status,
          reason: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }

    const kpr = await tx.select().from(kprProcesses).where(eq(kprProcesses.id, id)).get();
    const booking = await tx.select().from(bookings).where(eq(bookings.id, kpr.bookingId)).get();
    bookingProjectId = booking.projectId;

    // Update KPR row status
    await tx.update(kprProcesses).set({
      status: parsed.status,
      biCheckStatus: parsed.biCheckStatus,
      documentStatus: derivedDocumentStatus,
      bankNotes: parsed.bankNotes,
      akadDate: parsed.akadDate,
      updatedAt: new Date(),
    }).where(eq(kprProcesses.id, id)).run();

     // Enforce that the selected bank partner has a matching approved/offered submission
    if (
      (parsed.status === "offering" || parsed.status === "approved" || parsed.status === "akad") &&
      parsed.approvedBankPartnerId
    ) {
      const existingSub = await tx.select()
        .from(bankSubmissions)
        .where(
          and(
            eq(bankSubmissions.kprProcessId, id),
            eq(bankSubmissions.bankPartnerId, parsed.approvedBankPartnerId)
          )
        )
        .get();

      if (existingSub) {
        await tx.update(bankSubmissions)
          .set({
            plafondAmount: parsed.approvedPlafond !== undefined ? parsed.approvedPlafond : existingSub.plafondAmount,
            tenorYear: parsed.approvedTenor !== undefined ? (parsed.approvedTenor ? Math.round(parsed.approvedTenor) : null) : existingSub.tenorYear,
          })
          .where(eq(bankSubmissions.id, existingSub.id))
          .run();
      }
    }

    // If step shifts to Akad, set unit and booking status to finalized
    if (parsed.status === "akad") {
      const currentUnit = await tx.select().from(units).where(eq(units.id, booking.unitId)).get();
      if (!currentUnit) throw new Error("Unit tidak ditemukan.");

      // Keep unit status unchanged (do not set to "sold" yet), but link customer & booking
      await tx.update(units).set({
        currentCustomerId: booking.customerId,
        currentBookingId: booking.id,
        updatedAt: new Date(),
      }).where(eq(units.id, booking.unitId)).run();

      // Customer = buyer
      await tx.update(customers).set({
        status: "buyer",
        updatedAt: new Date(),
      }).where(eq(customers.id, booking.customerId)).run();

      // Akad Kredit belum sama dengan realisasi dana. Booking baru dinyatakan
      // selesai setelah jalur realizeKprFunds() mencatat kas masuk secara atomik.
      await tx.update(bookings).set({
        status: "akad",
        updatedAt: new Date(),
      }).where(eq(bookings.id, booking.id)).run();
    } else {
      // Synchronize unit status to match KPR state
      let unitState: "kpr_process" | "booking" | "available" = "kpr_process";
      if (parsed.status === "rejected") {
        // Penolakan KPR tidak otomatis melepaskan unit. Booking, invoice, dan
        // kemungkinan refund harus diselesaikan melalui flow pembatalan/revisi.
        // Catat penolakan pada riwayat booking agar timeline tidak menggantung
        // tanpa penanda meskipun bookings.status tetap "active".
        unitState = "booking";
        await tx.insert(bookingStatusHistories).values({
          id: crypto.randomUUID(),
          bookingId: booking.id,
          previousStatus: booking.status,
          newStatus: booking.status,
          notes: "KPR ditolak bank. Menunggu tindak lanjut pembatalan/refund.",
          changedBy: user.id,
          changedAt: new Date(),
        }).run();
      } else if (parsed.status === "bi_checking" || parsed.status === "pemberkasan") {
        // Early KPR stages remain as booking
        unitState = "booking";
      } else if (parsed.status === "approved") {
        // Approved KPR transitions unit to construction ONLY for non-ready-stock (indent) units.
        // Ready stock units bypass construction phase entirely (BR-22).
        const unitForApproved = await tx.select({ isReadyStock: units.isReadyStock }).from(units).where(eq(units.id, booking.unitId)).get();
        if (!unitForApproved?.isReadyStock) {
          // Construction is promoted only by checkAndTransitionToConstruction(),
          // which revalidates DP and KPR approval after this transaction.
        }
        // else: keep unitState = "kpr_process" for ready stock — handover gate handled separately
      }

      const currentUnit = await tx.select().from(units).where(eq(units.id, booking.unitId)).get();
      if (currentUnit && currentUnit.status !== unitState) {
        const unitUpdate: Partial<typeof units.$inferInsert> = {
          status: unitState,
          updatedAt: new Date(),
        };
        unitUpdate.currentCustomerId = booking.customerId;
        unitUpdate.currentBookingId = booking.id;
        await tx.update(units).set(unitUpdate).where(eq(units.id, booking.unitId)).run();

        await tx.insert(unitStatusHistories).values({
          id: crypto.randomUUID(),
          unitId: booking.unitId,
          previousStatus: currentUnit.status,
          newStatus: unitState,
          reason: `Progress status KPR: ${parsed.status}`,
          changedBy: user.id,
          changedAt: new Date(),
        }).run();
      }
    }

    bookingIdToTransition = kpr.bookingId;
  });

  if (bookingIdToTransition) {
    await checkAndTransitionToConstruction(db, bookingIdToTransition, user.id);
  }

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: id,
    entityType: "kpr_process",
    details: { step: parsed.status },
  });

  revalidatePath("/marketing/kpr");
  revalidatePath("/marketing/bookings");
  if (bookingProjectId) {
    revalidatePath(`/siteplan/${bookingProjectId}`);
  }
  return { success: true };
}

export async function updateKprStatusDirect(id: string, newStatus: string, revisionNotes?: string) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);

  // "realisasi" MUST go through realizeKprFunds() which records kas masuk + memo attachment.
  // Blocking here prevents accidental drag-drop that would change unit status without financial records.
  if (newStatus === "realisasi") {
    throw new Error(
      "Status 'Realisasi Dana' tidak dapat diubah melalui drag-and-drop. " +
      "Gunakan Form Realisasi KPR di dialog 'Kelola Berkas KPR' untuk mencatat pencairan dana bank beserta rincian keuangannya."
    );
  }
  const parsedStatus = parseKprPipelineStatus(newStatus);
  
  let bookingProjectId = "";
  let bookingIdToTransition = "";

  await db.transaction(async (tx) => {
    // Call KPR State Transition validator first, logging blocked attempts
    try {
      await validateKprStateTransition(tx, id, parsedStatus, {});
    } catch (err: unknown) {
      await safeWriteBlockedTransitionLog({
        module: "marketing",
        entityType: "kpr_process",
        entityId: id,
        details: {
          action: "updateKprStatusDirect_blocked_transition",
          kprProcessId: id,
          targetStatus: parsedStatus,
          reason: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }

    const kpr = await tx.select().from(kprProcesses).where(eq(kprProcesses.id, id)).get();
    const booking = await tx.select().from(bookings).where(eq(bookings.id, kpr.bookingId)).get();

    bookingProjectId = booking.projectId;

    // Parse and update bankNotes if revision notes are provided
    let updatedNotes = kpr.bankNotes;
    if (revisionNotes) {
      let notesMap: Record<string, string> = {};
      if (kpr.bankNotes) {
        try {
          if (kpr.bankNotes.trim().startsWith("{")) {
            notesMap = JSON.parse(kpr.bankNotes);
          } else {
            notesMap = { [kpr.status]: kpr.bankNotes };
          }
        } catch (e) {}
      }
      notesMap[parsedStatus] = revisionNotes;
      updatedNotes = JSON.stringify(notesMap);
    }

    // 5. Update KPR row status
    await tx.update(kprProcesses).set({
      status: parsedStatus,
      bankNotes: updatedNotes,
      akadDate: parsedStatus === "akad" ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(kprProcesses.id, id)).run();

    // 6. Synchronize unit status based on KPR status
    if (parsedStatus === "akad") {
      const currentUnit = await tx.select().from(units).where(eq(units.id, booking.unitId)).get();
      if (!currentUnit) throw new Error("Unit tidak ditemukan.");

      // Keep unit status unchanged (do not set to "sold" yet), but link customer & booking
      await tx.update(units).set({
        currentCustomerId: booking.customerId,
        currentBookingId: booking.id,
        updatedAt: new Date(),
      }).where(eq(units.id, booking.unitId)).run();

      await tx.update(customers).set({
        status: "buyer",
        updatedAt: new Date(),
      }).where(eq(customers.id, booking.customerId)).run();

      await tx.update(bookings).set({
        status: "akad",
        updatedAt: new Date(),
      }).where(eq(bookings.id, booking.id)).run();

    } else if (newStatus === "realisasi") {
      // RULE 9: KPR realisasi ? unit: menunggu_serah_terima
      const currentUnit = await tx.select().from(units).where(eq(units.id, booking.unitId)).get();
      if (currentUnit) {
        const prevStatus = currentUnit.status;
        await tx.update(units).set({
          status: "menunggu_serah_terima",
          updatedAt: new Date(),
        }).where(eq(units.id, booking.unitId)).run();

        await tx.insert(unitStatusHistories).values({
          id: crypto.randomUUID(),
          unitId: booking.unitId,
          previousStatus: prevStatus,
          newStatus: "menunggu_serah_terima",
          reason: "Dana KPR telah direalisasikan — unit menunggu serah terima fisik kepada konsumen",
          changedBy: user.id,
          changedAt: new Date(),
        }).run();
      }

    } else {
      let unitState: "kpr_process" | "booking" | "available" = "kpr_process";
      if (parsedStatus === "rejected") {
        unitState = "booking";
        // Tandai penolakan KPR pada riwayat booking (Pilihan A: unit tetap
        // ter-link; pembatalan/refund lewat flow terpisah).
        await tx.insert(bookingStatusHistories).values({
          id: crypto.randomUUID(),
          bookingId: booking.id,
          previousStatus: booking.status,
          newStatus: booking.status,
          notes: "KPR ditolak bank (Kanban). Menunggu tindak lanjut pembatalan/refund.",
          changedBy: user.id,
          changedAt: new Date(),
        }).run();
      } else if (parsedStatus === "bi_checking" || parsedStatus === "pemberkasan") {
        unitState = "booking";
      }

      const currentUnit = await tx.select().from(units).where(eq(units.id, booking.unitId)).get();
      if (currentUnit && currentUnit.status !== unitState) {
        const unitUpdate: Partial<typeof units.$inferInsert> = {
          status: unitState,
          updatedAt: new Date(),
        };
        unitUpdate.currentCustomerId = booking.customerId;
        unitUpdate.currentBookingId = booking.id;
        await tx.update(units).set(unitUpdate).where(eq(units.id, booking.unitId)).run();

        await tx.insert(unitStatusHistories).values({
          id: crypto.randomUUID(),
          unitId: booking.unitId,
          previousStatus: currentUnit.status,
          newStatus: unitState,
          reason: `Progress status KPR (Kanban): ${parsedStatus}`,
          changedBy: user.id,
          changedAt: new Date(),
        }).run();
      }
    }

    bookingIdToTransition = kpr.bookingId;
  });

  if (bookingIdToTransition) {
    await checkAndTransitionToConstruction(db, bookingIdToTransition, user.id);
  }

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: id,
    entityType: "kpr_process",
    details: { step: parsedStatus, source: "kanban_drag" },
  });

  revalidatePath("/marketing/kpr");
  revalidatePath("/marketing/bookings");
  if (bookingProjectId) {
    revalidatePath(`/siteplan/${bookingProjectId}`);
  }
  revalidatePath("/master/units");
  return { success: true };
}

// -----------------------------------------------------------------------------
// BAST KONSUMEN — APPROVE SERAH TERIMA (RULE 11, 12, 13)
// Role: Super Admin, Admin Kantor, Direksi / Manager
// -----------------------------------------------------------------------------
export async function approveBastKonsumen(bookingId: string) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Direksi / Manager"]);

  // Fetch booking
  const booking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .get();
  if (!booking) throw new Error("Booking tidak ditemukan.");

  // RULE 10/11: booking harus completed
  if (booking.status !== "completed") {
    throw new Error(
      "Serah terima tidak dapat dilakukan. Akad / PPJB atau Akad Kredit belum diselesaikan."
    );
  }

  // RULE 10/11: BAST Konsumen harus ada & verified
  const bastDoc = await db
    .select()
    .from(customerDocuments)
    .where(
      and(
        eq(customerDocuments.bookingId, bookingId),
        eq(customerDocuments.documentType, "bast")
      )
    )
    .get();

  if (!bastDoc) {
    throw new Error(
      "Dokumen BAST (Berita Acara Serah Terima) dari Developer ke Konsumen belum diunggah. " +
      "Silakan unggah BAST terlebih dahulu pada kartu BAST Developer ke Konsumen di Detail Booking."
    );
  }
  if (bastDoc.status !== "verified") {
    throw new Error(
      "Dokumen BAST sudah diunggah namun belum diverifikasi oleh Admin. " +
      "Minta Admin untuk memverifikasi BAST sebelum melanjutkan proses Serah Terima."
    );
  }

  // Get unit
  const unit = await db
    .select()
    .from(units)
    .where(eq(units.id, booking.unitId))
    .get();
  if (!unit) throw new Error("Unit tidak ditemukan.");

  // RULE 11: unit harus menunggu_serah_terima
  // "sold" no longer accepted — unit must go through the proper menunggu_serah_terima gate
  // (set by realizeKprFunds for KPR, or triggerMenungguSerahTerima for cash/installment)
  if (unit.status !== "menunggu_serah_terima") {
    throw new Error(
      `Status unit (${unit.status}) tidak valid untuk serah terima. ` +
      "Unit harus berstatus 'Menunggu Serah Terima' sebelum dapat diserahterimakan. " +
      "Pastikan realisasi dana / pelunasan sudah diproses terlebih dahulu."
    );
  }

  // RULE 8: KPR tidak boleh rejected
  if (booking.paymentScheme === "kpr") {
    const kprProcess = await db
      .select({ status: kprProcesses.status })
      .from(kprProcesses)
      .where(eq(kprProcesses.bookingId, bookingId))
      .get();
    if (kprProcess?.status === "rejected") {
      throw new Error(
        "KPR konsumen ini ditolak oleh bank. Serah terima tidak dapat dilakukan."
      );
    }
  }

  const oldStatus = unit.status;
  const projectId = booking.projectId;

  // RULE 12: update unit ? handover_complete
  await db.transaction(async (tx) => {
    await tx.update(units).set({
      status: "handover_complete",
      updatedAt: new Date(),
    }).where(eq(units.id, unit.id)).run();

    // RULE 13: catat ke unit_status_histories
    await tx.insert(unitStatusHistories).values({
      id: crypto.randomUUID(),
      unitId: unit.id,
      previousStatus: oldStatus,
      newStatus: "handover_complete",
      reason: `BAST Developer ke Konsumen telah diverifikasi dan disetujui. Serah terima unit selesai.`,
      changedBy: user.id,
      changedAt: new Date(),
    }).run();
  });

  // RULE 13: audit log
  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: unit.id,
    entityType: "handover",
    details: {
      unitCode: unit.code,
      bookingId,
      bastDocId: bastDoc.id,
      oldStatus,
      newStatus: "handover_complete",
    },
  });

  // Notifikasi ke role yang berwenang
  try {
    await notifyUsersWithRoles({
      roleNames: ["Super Admin", "Admin Kantor", "Direksi / Manager", "Marketing Manager"],
      type: "info",
      title: "Serah Terima Unit Selesai",
      message: `Unit ${unit.code} telah resmi diserahterimakan kepada konsumen. BAST Developer ? Konsumen telah disetujui.`,
      entityId: unit.id,
      entityType: "unit",
    });

    // Notifikasi ke Marketing PIC unit
    if (booking.marketingId) {
      await createNotification({
        userId: booking.marketingId,
        type: "info",
        title: "Serah Terima Unit Selesai",
        message: `Unit ${unit.code} yang Anda tangani telah resmi diserahterimakan kepada konsumen.`,
        entityId: unit.id,
        entityType: "unit",
      });
    }
  } catch (err) {
    console.warn("Failed to send handover notifications:", err);
  }

  revalidatePath("/marketing/kpr");
  revalidatePath("/marketing/bookings");
  revalidatePath(`/siteplan/${projectId}`);
  revalidatePath("/master/units");
  revalidatePath("/siteplan");

  return { success: true };
}

/**
 * Controlled correction path for an already completed handover.
 * Only Super Admin may reopen the handover queue; the signed BAST is retained
 * as a rejected record so the audit trail is never removed silently.
 */
export async function requestHandoverRevision(bookingId: string, reason: string) {
  const user = await requireAnyRole(["Super Admin"]);
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 10 || normalizedReason.length > 500) {
    throw new Error("Alasan revisi serah terima wajib diisi antara 10 sampai 500 karakter.");
  }

  const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking) throw new Error("Booking tidak ditemukan.");
  if (booking.status !== "completed") {
    throw new Error("Revisi serah terima hanya dapat dilakukan pada booking yang telah selesai.");
  }

  const unit = await db.select().from(units).where(eq(units.id, booking.unitId)).get();
  if (!unit) throw new Error("Unit tidak ditemukan.");
  if (unit.status !== "handover_complete") {
    throw new Error("Unit belum berada pada status Serah Terima Selesai.");
  }

  const bastDocument = await db
    .select()
    .from(customerDocuments)
    .where(
      and(
        eq(customerDocuments.bookingId, bookingId),
        eq(customerDocuments.documentType, "bast")
      )
    )
    .get();
  if (!bastDocument) {
    throw new Error("Dokumen BAST untuk booking ini tidak ditemukan.");
  }

  await db.transaction(async (tx) => {
    await tx.update(units).set({
      status: "menunggu_serah_terima",
      updatedAt: new Date(),
    }).where(eq(units.id, unit.id)).run();

    await tx.update(customerDocuments).set({
      status: "rejected",
      notes: `Revisi serah terima: ${normalizedReason}`,
    }).where(eq(customerDocuments.id, bastDocument.id)).run();

    await tx.insert(unitStatusHistories).values({
      id: crypto.randomUUID(),
      unitId: unit.id,
      previousStatus: "handover_complete",
      newStatus: "menunggu_serah_terima",
      reason: `Revisi serah terima oleh Super Admin: ${normalizedReason}`,
      changedBy: user.id,
      changedAt: new Date(),
    }).run();

    await tx.insert(bookingStatusHistories).values({
      id: crypto.randomUUID(),
      bookingId,
      previousStatus: "completed",
      newStatus: "Handover Revision",
      notes: `Serah terima dibuka kembali. ${normalizedReason}`,
      changedBy: user.id,
      changedAt: new Date(),
    }).run();
  });

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: unit.id,
    entityType: "handover",
    details: {
      action: "handover_revision",
      bookingId,
      bastDocumentId: bastDocument.id,
      reason: normalizedReason,
      previousUnitStatus: "handover_complete",
      newUnitStatus: "menunggu_serah_terima",
    },
  });

  revalidatePath(`/marketing/bookings/${bookingId}`);
  revalidatePath("/marketing/bookings");
  revalidatePath("/marketing/kpr");
  revalidatePath(`/siteplan/${booking.projectId}`);
  revalidatePath("/master/units");
  return { success: true };
}

// --- BANK SUBMISSIONS & PARTNERS ---
export async function createBankPartner(data: unknown) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  const parsed = bankPartnerSchema.parse(data);
  const id = crypto.randomUUID();

  await db.insert(bankPartners).values({
    id,
    ...parsed,
    createdAt: new Date(),
  });

  await writeAuditLog({
    action: "create",
    module: "marketing",
    entityId: id,
    entityType: "bank_partner",
    details: { name: parsed.name },
  });

  revalidatePath("/marketing/kpr");
  return { success: true };
}

export async function deleteBankPartner(id: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);

  const inUse = await db.select({ id: bankSubmissions.id })
    .from(bankSubmissions)
    .where(eq(bankSubmissions.bankPartnerId, id))
    .limit(1);

  if (inUse.length > 0) {
    throw new Error("Bank partner ini memiliki riwayat pengajuan KPR aktif dan tidak dapat dihapus. Nonaktifkan saja statusnya jika tidak ingin digunakan lagi.");
  }

  await db.delete(bankPartners).where(eq(bankPartners.id, id));
  await writeAuditLog({
    action: "delete",
    module: "marketing",
    entityId: id,
    entityType: "bank_partner",
  });

  revalidatePath("/marketing/kpr");
  revalidatePath("/master/banks");
  return { success: true };
}

export async function updateBankPartner(id: string, data: unknown) {
  await requireAnyRole(["Super Admin", "Admin Kantor"]);
  const parsed = bankPartnerSchema.parse(data);

  await db.update(bankPartners).set(parsed).where(eq(bankPartners.id, id));

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: id,
    entityType: "bank_partner",
    details: { name: parsed.name },
  });

  revalidatePath("/marketing/kpr");
  revalidatePath("/master/banks");
  return { success: true };
}

export async function getBankPartners() {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager", "Admin Keuangan"]);
  return db.select().from(bankPartners).orderBy(bankPartners.name);
}

export async function submitKprToBank(data: unknown) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  const parsed = bankSubmissionSchema.parse(data);
  const id = crypto.randomUUID();

  await db.transaction(async (tx) => {
    const kpr = await tx.select().from(kprProcesses).where(eq(kprProcesses.id, parsed.kprProcessId)).get();
    if (!kpr) throw new Error("Proses KPR tidak ditemukan.");
    if (kpr.status !== "pemberkasan" || kpr.documentStatus !== "complete") {
      throw new Error("Pengajuan ke bank hanya dapat dibuat setelah tahap Pemberkasan dan seluruh dokumen KPR terverifikasi.");
    }
    if (parsed.status !== "submitted") {
      throw new Error("Pengajuan bank baru harus dimulai dengan status Diajukan.");
    }
    const duplicate = await tx.select({ id: bankSubmissions.id })
      .from(bankSubmissions)
      .where(and(eq(bankSubmissions.kprProcessId, parsed.kprProcessId), eq(bankSubmissions.bankPartnerId, parsed.bankPartnerId)))
      .get();
    if (duplicate) throw new Error("Pengajuan ke bank ini sudah ada untuk proses KPR yang sama.");

    await tx.insert(bankSubmissions).values({
      id,
      kprProcessId: parsed.kprProcessId,
      bankPartnerId: parsed.bankPartnerId,
      submissionDate: parsed.submissionDate,
      status: parsed.status,
      plafondAmount: parsed.plafondAmount,
      interestRate: parsed.interestRate,
      tenorYear: parsed.tenorYear,
      rejectionReason: parsed.rejectionReason,
      createdAt: new Date(),
    }).run();

  });

  await writeAuditLog({
    action: "create",
    module: "marketing",
    entityId: id,
    entityType: "bank_submission",
    details: { status: parsed.status },
  });

  revalidatePath("/marketing/kpr");
  return { success: true };
}

export async function updateBankSubmission(id: string, data: {
  status: "submitted" | "verified" | "offering" | "approved" | "rejected";
  plafondAmount?: number | null;
  interestRate?: number | null;
  tenorYear?: number | null;
  rejectionReason?: string | null;
}) {
  const activeUser = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager", "Direksi / Manager"]);
  const roleInfo = await getSessionRole(activeUser.id);
  const parsed = bankSubmissionSchema
    .pick({ status: true, plafondAmount: true, interestRate: true, tenorYear: true, rejectionReason: true })
    .parse(data);

  // Marketing mengelola pemberkasan dan pengiriman. Keputusan/tanggapan bank
  // hanya dapat dicatat oleh pejabat internal yang berwenang agar marketing
  // tidak dapat mengesahkan pengajuan bank miliknya sendiri.
  const canRecordBankDecision =
    roleInfo.isSuperAdmin || roleInfo.isAdminKantor || roleInfo.isDireksi;
  if (!canRecordBankDecision) {
    throw new Error("Hanya Super Admin, Admin Kantor, atau Direksi yang dapat memperbarui keputusan pengajuan bank.");
  }
  if (parsed.status === "rejected" && !parsed.rejectionReason?.trim()) {
    throw new Error("Alasan penolakan dari bank wajib diisi.");
  }
  
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(bankSubmissions).where(eq(bankSubmissions.id, id)).get();
    if (!existing) throw new Error("Pengajuan bank tidak ditemukan.");

    const kpr = await tx.select().from(kprProcesses).where(eq(kprProcesses.id, existing.kprProcessId)).get();
    if (!kpr) throw new Error("Proses KPR tidak ditemukan.");

    const allowedTransitions: Record<string, string[]> = {
      submitted: ["verified", "rejected"],
      verified: ["offering", "rejected"],
      offering: ["approved", "rejected"],
      approved: [],
      rejected: [],
    };
    if (parsed.status === existing.status) throw new Error("Pengajuan bank sudah berada pada status tersebut.");
    if (!allowedTransitions[existing.status]?.includes(parsed.status)) {
      throw new Error("Transisi status pengajuan bank tidak diperbolehkan.");
    }
    const requiredKprStatus: Partial<Record<typeof parsed.status, string>> = {
      verified: "pemberkasan",
      offering: "proses_bank",
      approved: "offering",
    };
    if (requiredKprStatus[parsed.status] && kpr.status !== requiredKprStatus[parsed.status]) {
      throw new Error("Tahap KPR harus dilanjutkan terlebih dahulu sebelum status pengajuan bank dapat diubah.");
    }

    await tx.update(bankSubmissions).set({
      status: parsed.status,
      plafondAmount: parsed.plafondAmount !== undefined ? parsed.plafondAmount : existing.plafondAmount,
      interestRate: parsed.interestRate !== undefined ? parsed.interestRate : existing.interestRate,
      tenorYear: parsed.tenorYear !== undefined ? parsed.tenorYear : existing.tenorYear,
      rejectionReason: parsed.rejectionReason !== undefined ? parsed.rejectionReason : existing.rejectionReason,
    }).where(eq(bankSubmissions.id, id)).run();
  });

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: id,
    entityType: "bank_submission",
    details: { status: parsed.status },
  });

  revalidatePath("/marketing/kpr");
  return { success: true };
}

export async function deleteBankSubmission(id: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(bankSubmissions).where(eq(bankSubmissions.id, id)).get();
    if (!existing) throw new Error("Pengajuan bank tidak ditemukan.");

    // Riwayat keputusan bank merupakan bukti proses KPR dan tidak boleh
    // dihapus. Hanya draf pengajuan yang belum diproses bank yang dapat dibatalkan.
    if (existing.status !== "submitted") {
      throw new Error("Pengajuan bank yang sudah diproses tidak dapat dihapus. Riwayat keputusan bank harus dipertahankan.");
    }

    const kpr = await tx.select({ status: kprProcesses.status })
      .from(kprProcesses)
      .where(eq(kprProcesses.id, existing.kprProcessId))
      .get();
    if (!kpr || kpr.status !== "pemberkasan") {
      throw new Error("Pengajuan bank hanya dapat dihapus saat proses KPR masih pada tahap Pemberkasan.");
    }

    await tx.delete(bankSubmissions).where(eq(bankSubmissions.id, id)).run();
  });

  await writeAuditLog({
    action: "delete",
    module: "marketing",
    entityId: id,
    entityType: "bank_submission",
    details: {},
  });

  revalidatePath("/marketing/kpr");
  return { success: true };
}

// --- BOOKING PAYMENT PROOF ---
export async function uploadPaymentProof(
  bookingId: string,
  data: { fileName: string; fileUrl: string; mimeType?: string; fileSize?: number },
  paymentType?: "booking_fee" | "dp" | "cash_settlement" | "installment",
  invoiceId?: string
) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) throw new Error("Booking tidak ditemukan.");
  if (booking.status === "cancelled") throw new Error("Booking sudah dibatalkan.");
  if (paymentType === "cash_settlement" && booking.paymentScheme !== "cash") {
    throw new Error("Pelunasan Cash hanya tersedia untuk booking dengan skema Cash.");
  }
  if (paymentType === "installment" && booking.paymentScheme !== "installment") {
    throw new Error("Termin Cash Bertahap hanya tersedia untuk booking dengan skema Cash Bertahap.");
  }
  // Both cash settlement and installment termin require the pemberkasan gate
  // (Booking Fee + DP + KTP/KK verified) before any follow-up proof is uploaded.
  if (paymentType === "cash_settlement" || paymentType === "installment") {
    const pemberkasanReadiness = await getCashPemberkasanReadiness(db, bookingId);
    if (!pemberkasanReadiness.eligible) {
      const label = paymentType === "installment" ? "Bukti Termin Cash Bertahap" : "Bukti Pelunasan Cash";
      throw new Error(
        `${label} belum dapat diunggah. ${pemberkasanReadiness.reason}`
      );
    }
  }

  const attachmentEntityType =
    paymentType === "dp"
      ? "booking_dp"
      : paymentType === "cash_settlement"
        ? "booking_cash_settlement"
        : paymentType === "installment"
          ? "booking_installment"
          : "booking_bf";

  // ── Req 2.10: Search invoice candidates with status "unpaid" OR "partial" ──
  let targetInvoice: typeof invoices.$inferSelect | null = null;

  if (invoiceId) {
    // ── Req 2.12: Explicit invoiceId takes priority (deterministic target) ──
    const [explicit] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.bookingId, bookingId),
          ...(paymentType === "cash_settlement"
            ? [eq(invoices.scheduleKind, "cash_settlement")]
            : paymentType
              ? [eq(invoices.type, paymentType)]
              : []),
          inArray(invoices.status, ["unpaid", "partial"])
        )
      )
      .limit(1);

    if (!explicit) {
      throw new Error("Invoice target tidak ditemukan atau sudah lunas/dibatalkan.");
    }
    targetInvoice = explicit;
  } else {
    // ── Req 2.12: Fallback deterministic ordering when invoiceId not provided ──
    // scheduleKind priority: booking_fee=1, dp=2, cash_settlement=3, installment=4, NULL=5
    // Then dueDate ASC (earliest first), then id ASC (tiebreaker)
    const candidates = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.bookingId, bookingId),
          inArray(invoices.status, ["unpaid", "partial"]),
          ...(paymentType === "cash_settlement"
            ? [eq(invoices.scheduleKind, "cash_settlement")]
            : paymentType
              ? [eq(invoices.type, paymentType)]
              : [])
        )
      )
      .orderBy(
        sql`CASE
          WHEN ${invoices.scheduleKind} = 'booking_fee' THEN 1
          WHEN ${invoices.scheduleKind} = 'dp' THEN 2
          WHEN ${invoices.scheduleKind} = 'cash_settlement' THEN 3
          WHEN ${invoices.scheduleKind} = 'installment' THEN 4
          ELSE 5
        END`,
        asc(invoices.dueDate),
        asc(invoices.id)
      );

    if (candidates.length > 0) {
      targetInvoice = candidates[0];
    }
  }

  // UI may dim later termins, but the sequential rule must also be enforced
  // server-side so a crafted request cannot upload payment proof for Termin 2+
  // while an earlier termin is still unpaid.
  if (paymentType === "installment" && targetInvoice) {
    const installmentInvoices = await db
      .select({ id: invoices.id, status: invoices.status })
      .from(invoices)
      .where(
        and(
          eq(invoices.bookingId, bookingId),
          eq(invoices.type, "installment")
        )
      )
      .orderBy(asc(invoices.scheduleSequence), asc(invoices.dueDate), asc(invoices.id));
    const installmentGate = getInstallmentProofGate(installmentInvoices, targetInvoice.id);
    if (!installmentGate.eligible) {
      throw new Error(installmentGate.reason);
    }
  }

  // Kandidat invoice sudah tervalidasi sebelum bukti disimpan, sehingga file
  // tidak tercatat untuk invoice eksplisit yang salah atau sudah lunas.
  const attachmentId = crypto.randomUUID();
  await db.transaction(async (tx) => {
  await tx.insert(attachments).values({
    id: attachmentId,
    entityId: bookingId,
    entityType: attachmentEntityType,
    fileName: data.fileName,
    fileUrl: data.fileUrl,
    mimeType: data.mimeType || "application/octet-stream",
    fileSize: data.fileSize || 0,
    uploadedBy: user.id,
    createdAt: new Date(),
  });

  await writeAuditLog({
    action: "create",
    module: "marketing",
    entityId: attachmentId,
    entityType: "booking_proof",
    details: { bookingId, fileName: data.fileName, paymentType },
  });

  // If there is a valid target invoice, create a payment record linked to that invoice
  if (targetInvoice) {
    // ── Req 2.11: Outstanding guard — validate payment amount does not exceed outstanding ──
    const [sumResult] = await tx
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(
        and(
          eq(payments.invoiceId, targetInvoice.id),
          eq(payments.status, "verified")
        )
      );

    const paidTotal = Number(sumResult?.total ?? 0);
    const outstanding = computeOutstanding(targetInvoice.amount, paidTotal);

    // For auto-payment from proof upload, use the invoice amount or outstanding (whichever is smaller)
    const paymentAmount = Math.min(targetInvoice.amount, outstanding);

    if (paymentAmount <= 0) {
      // Invoice already fully paid by verified payments — skip creating payment
      revalidatePath(`/marketing/bookings/${bookingId}`);
      revalidatePath("/marketing/bookings");
      revalidatePath("/finance/payments");
      return { success: true, attachmentId };
    }

    const paymentId = crypto.randomUUID();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    const paymentNumber = `PAY-AUTO-${dateStr}-${rand}`;

    await tx.insert(payments).values({
      id: paymentId,
      invoiceId: targetInvoice.id,
      paymentNumber,
      projectId: booking.projectId,
      unitId: booking.unitId,
      customerId: booking.customerId,
      amount: paymentAmount,
      paymentDate: new Date(),
      paymentMethod: "transfer",
      proofAttachmentId: attachmentId,
      uploadedBy: user.id,
      status: "pending",
    });

    // Notify Admin Keuangan and Super Admin about new payment verification
    await notifyUsersWithRoles({
      roleNames: ["Admin Keuangan", "Super Admin"],
      type: "approval_pending",
      title: "Verifikasi Pembayaran Baru",
      message: `Pembayaran baru senilai Rp ${paymentAmount.toLocaleString("id-ID")} dari konsumen memerlukan verifikasi keuangan.`,
      entityId: paymentId,
      entityType: "payment",
    });
  }
  });

  revalidatePath(`/marketing/bookings/${bookingId}`);
  revalidatePath("/marketing/bookings");
  revalidatePath("/finance/payments");
  return { success: true, attachmentId };
}

/**
 * Adds a proof file to an existing booking payment without creating another
 * payment row. This is used for historical payments that were verified before
 * a proof file was attached.
 */
export async function attachExistingPaymentProof(
  bookingId: string,
  paymentId: string,
  data: { fileName: string; fileUrl: string; mimeType?: string; fileSize?: number }
) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);

  const [paymentRecord] = await db
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      status: payments.status,
      proofAttachmentId: payments.proofAttachmentId,
      invoiceId: payments.invoiceId,
      invoiceType: invoices.type,
      scheduleKind: invoices.scheduleKind,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(
      and(
        eq(payments.id, paymentId),
        eq(invoices.bookingId, bookingId)
      )
    )
    .limit(1);

  if (!paymentRecord) {
    throw new Error("Pembayaran tidak ditemukan atau tidak terkait dengan booking ini.");
  }
  if (paymentRecord.status === "voided") {
    throw new Error("Bukti tidak dapat ditambahkan ke pembayaran yang sudah dibatalkan.");
  }
  if (paymentRecord.proofAttachmentId) {
    throw new Error("Pembayaran ini sudah memiliki bukti pembayaran.");
  }

  const attachmentEntityType = paymentRecord.scheduleKind === "cash_settlement"
    ? "booking_cash_settlement"
    : paymentRecord.invoiceType === "dp"
      ? "booking_dp"
      : "booking_bf";

  const attachmentId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(attachments).values({
      id: attachmentId,
      entityId: bookingId,
      entityType: attachmentEntityType,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      mimeType: data.mimeType || "application/octet-stream",
      fileSize: data.fileSize || 0,
      uploadedBy: user.id,
      createdAt: new Date(),
    });

    await tx
      .update(payments)
      .set({ proofAttachmentId: attachmentId })
      .where(eq(payments.id, paymentId));
  });

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: paymentId,
    entityType: "payment",
    details: {
      bookingId,
      paymentNumber: paymentRecord.paymentNumber,
      action: "attach_existing_payment_proof",
      attachmentId,
      attachmentEntityType,
    },
  });

  revalidatePath("/marketing/bookings/" + bookingId);
  revalidatePath("/marketing/bookings");
  revalidatePath("/finance/payments");
  return { success: true, attachmentId };
}

export async function upgradeBookingToAkad(bookingId: string) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor"]);
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) throw new Error("Booking tidak ditemukan.");

  const [unit] = await db.select().from(units).where(eq(units.id, booking.unitId));
  if (!unit) throw new Error("Unit tidak ditemukan.");

  const readiness = await getBookingAkadReadiness(bookingId);
  if (!readiness.eligible) {
    throw new Error(readiness.reason);
  }

  await db.transaction(async (tx) => {
    await tx.update(bookings).set({ status: "akad", updatedAt: new Date() }).where(eq(bookings.id, bookingId)).run();
    await tx.insert(bookingStatusHistories).values({
      id: crypto.randomUUID(),
      bookingId,
      previousStatus: "active",
      newStatus: "akad",
      notes: "Akad / PPJB telah ditandai. Menunggu konfirmasi penyelesaian akad.",
      changedBy: user.id,
      changedAt: new Date(),
    }).run();
  });

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: bookingId,
    entityType: "booking",
    details: { action: "start_akad" },
  });

  revalidatePath(`/marketing/bookings/${bookingId}`);
  revalidatePath("/marketing/bookings");
  revalidatePath("/siteplan");
  return { success: true };
}

/**
 * Completes a non-KPR Akad / PPJB that has already been marked.
 * The unit only enters the handover queue after this explicit confirmation.
 */
export async function completeBookingAkad(bookingId: string) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor"]);
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) throw new Error("Booking tidak ditemukan.");

  if (booking.paymentScheme === "kpr") {
    throw new Error("Akad KPR diselesaikan melalui Pipeline KPR, bukan dari detail booking.");
  }

  const [unit] = await db.select().from(units).where(eq(units.id, booking.unitId));
  if (!unit) throw new Error("Unit tidak ditemukan.");

  const readiness = await getBookingAkadReadiness(bookingId, "akad");
  if (!readiness.eligible) {
    throw new Error(readiness.reason);
  }

  await db.transaction(async (tx) => {
    await tx.update(bookings).set({ status: "completed", updatedAt: new Date() }).where(eq(bookings.id, bookingId)).run();
    await tx.update(units).set({
      ...(unit.status !== "menunggu_serah_terima" ? { status: "menunggu_serah_terima" } : {}),
      currentCustomerId: booking.customerId,
      currentBookingId: bookingId,
      updatedAt: new Date(),
    }).where(eq(units.id, booking.unitId)).run();
    await tx.update(customers).set({ status: "buyer", updatedAt: new Date() }).where(eq(customers.id, booking.customerId)).run();

    await tx.insert(bookingStatusHistories).values({
      id: crypto.randomUUID(),
      bookingId,
      previousStatus: "akad",
      newStatus: "completed",
      notes: "Akad / PPJB selesai dikonfirmasi. Booking siap masuk proses serah terima.",
      changedBy: user.id,
      changedAt: new Date(),
    }).run();
    if (unit.status !== "menunggu_serah_terima") {
      await tx.insert(unitStatusHistories).values({
        id: crypto.randomUUID(),
        unitId: booking.unitId,
        previousStatus: unit.status,
        newStatus: "menunggu_serah_terima",
        reason: "Akad / PPJB selesai dikonfirmasi. Unit masuk tahap menunggu serah terima.",
        changedBy: user.id,
        changedAt: new Date(),
      }).run();
    }
  });

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: bookingId,
    entityType: "booking",
    details: { action: "complete_akad" },
  });

  revalidatePath(`/marketing/bookings/${bookingId}`);
  revalidatePath("/marketing/bookings");
  revalidatePath("/siteplan");
  return { success: true };
}

// --- CUSTOMER DOCUMENTS ---
export async function getCustomerDocuments(customerId: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager", "Admin Keuangan", "Direksi / Manager"]);
  return db
    .select()
    .from(customerDocuments)
    .innerJoin(attachments, eq(customerDocuments.attachmentId, attachments.id))
    .where(eq(customerDocuments.customerId, customerId))
    .orderBy(customerDocuments.uploadedAt);
}

export async function getCustomerDocumentsByBooking(bookingId: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager", "Admin Keuangan", "Direksi / Manager"]);
  return db
    .select()
    .from(customerDocuments)
    .innerJoin(attachments, eq(customerDocuments.attachmentId, attachments.id))
    .where(eq(customerDocuments.bookingId, bookingId))
    .orderBy(customerDocuments.uploadedAt);
}

export async function uploadCustomerDocument(
  data: {
    customerId: string;
    bookingId?: string;
    documentType: "ktp" | "npwp" | "slip_gaji" | "kk" | "spjb" | "kpr_doc" | "bast" | "other";
    fileName: string;
    fileUrl: string;
    mimeType: string;
    fileSize: number;
    notes?: string;
  }
) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager", "Admin Keuangan"]);

  const booking = data.bookingId
    ? await db.select({ id: bookings.id, customerId: bookings.customerId, paymentScheme: bookings.paymentScheme }).from(bookings).where(eq(bookings.id, data.bookingId)).get()
    : null;
  if (data.bookingId && !booking) {
    throw new Error("Booking untuk dokumen ini tidak ditemukan.");
  }
  if (booking && booking.customerId !== data.customerId) {
    throw new Error("Dokumen harus diunggah untuk konsumen yang sama dengan pemilik booking.");
  }

  if (data.documentType === "bast" && !data.bookingId) {
    throw new Error("Dokumen BAST harus dikaitkan dengan booking konsumen.");
  }

  if (booking && data.documentType !== "bast") {
    const allowedTypes = booking.paymentScheme === "kpr"
      ? ["ktp", "kk", "npwp", "slip_gaji", "kpr_doc"]
      : ["ktp", "kk", "npwp", "spjb"];
    if (!allowedTypes.includes(data.documentType)) {
      throw new Error(
        booking.paymentScheme === "kpr"
          ? "Jenis dokumen ini tidak termasuk berkas pengajuan KPR."
          : "Jenis dokumen ini tidak diperlukan untuk booking Cash."
      );
    }
  }

  // Check if a document of this type already exists for this customer (excluding 'other')
  if (data.documentType !== "other") {
    const documentIdentity = data.bookingId
      ? and(
          eq(customerDocuments.customerId, data.customerId),
          eq(customerDocuments.bookingId, data.bookingId!),
          eq(customerDocuments.documentType, data.documentType)
        )
      : and(
          eq(customerDocuments.customerId, data.customerId),
          eq(customerDocuments.documentType, data.documentType)
        );
    const [existing] = await db
      .select()
      .from(customerDocuments)
      .where(documentIdentity)
      .limit(1);

    if (existing) {
      const typeLabels: Record<string, string> = {
        ktp: "KTP",
        npwp: "NPWP",
        slip_gaji: "Slip Gaji",
        kk: "Kartu Keluarga",
        spjb: "Dokumen Akad / PPJB",
        kpr_doc: "Dokumen Pendukung Bank",
        bast: "BAST Konsumen",
      };
      throw new Error(`Dokumen ${typeLabels[data.documentType] || data.documentType.toUpperCase()} sudah pernah diunggah untuk konsumen ini.`);
    }
  }

  // 1. Create attachment record
  const attachmentId = crypto.randomUUID();
  const docId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(attachments).values({
      id: attachmentId,
      entityType: "customer_document",
      entityId: data.customerId,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      uploadedBy: user.id,
    });

    await tx.insert(customerDocuments).values({
      id: docId,
      customerId: data.customerId,
      bookingId: data.bookingId || null,
      attachmentId,
      documentType: data.documentType,
      status: "uploaded",
      notes: data.notes || null,
      uploadedBy: user.id,
    });
  });

  await writeAuditLog({
    action: "create",
    module: "marketing",
    entityId: docId,
    entityType: "customer_document",
    details: { documentType: data.documentType, customerId: data.customerId },
  });

  if (data.bookingId) {
    revalidatePath(`/marketing/bookings/${data.bookingId}`);
  }
  revalidatePath("/marketing/kpr");

  // Notifikasi kelengkapan empat berkas hanya berlaku untuk proses KPR.
  // Booking Cash tidak boleh memicu pemberkasan bank.
  try {
    if (booking?.paymentScheme === "kpr") {
      const existingDocs = await db.select().from(customerDocuments).where(eq(customerDocuments.bookingId, booking.id));
      const uploadedTypes = new Set<string>(existingDocs.map(d => d.documentType));
      const isMandatoryComplete = ["ktp", "npwp", "slip_gaji", "kk"].every(type => uploadedTypes.has(type));
      if (isMandatoryComplete) {
        const customer = await db.select().from(customers).where(eq(customers.id, data.customerId)).get();
        const customerName = customer?.name || "Konsumen";

        await notifyUsersWithRoles({
          roleNames: ["Super Admin", "Admin Kantor", "Admin Keuangan", "Direksi / Manager"],
          type: "approval_pending",
          title: "Pengecekan Berkas KPR Konsumen",
          message: `Seluruh berkas persyaratan KPR konsumen ${customerName} telah lengkap diunggah. Silakan lakukan pemeriksaan dan verifikasi berkas!`,
          entityId: booking.id,
          entityType: "booking",
        });
      }
    }
  } catch (err) {
    console.warn("Failed to trigger mandatory document upload notification:", err);
  }

  return { success: true, id: docId, attachmentId };
}

/** Replaces a rejected BAST without deleting its customer-document record. */
export async function replaceBastCustomerDocument(
  bookingId: string,
  documentId: string,
  data: {
    fileName: string;
    fileUrl: string;
    mimeType: string;
    fileSize: number;
  }
) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager", "Admin Keuangan"]);
  const document = await db
    .select()
    .from(customerDocuments)
    .where(
      and(
        eq(customerDocuments.id, documentId),
        eq(customerDocuments.bookingId, bookingId),
        eq(customerDocuments.documentType, "bast")
      )
    )
    .get();
  if (!document) throw new Error("Dokumen BAST tidak ditemukan untuk booking ini.");
  if (document.status !== "rejected") {
    throw new Error("Hanya BAST yang berstatus Perlu Diperbaiki yang dapat diganti.");
  }

  const replacementAttachmentId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(attachments).values({
      id: replacementAttachmentId,
      entityType: "customer_document",
      entityId: document.customerId,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      uploadedBy: user.id,
    });
    await tx.update(customerDocuments).set({
      attachmentId: replacementAttachmentId,
      status: "uploaded",
      notes: "BAST pengganti telah diunggah dan menunggu verifikasi ulang.",
    }).where(eq(customerDocuments.id, document.id)).run();
  });

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: document.id,
    entityType: "customer_document",
    details: {
      action: "replace_rejected_bast",
      bookingId,
      oldAttachmentId: document.attachmentId,
      replacementAttachmentId,
      documentType: "bast",
    },
  });

  revalidatePath(`/marketing/bookings/${bookingId}`);
  revalidatePath("/marketing/bookings");
  return { success: true, attachmentId: replacementAttachmentId };
}

async function syncKprDocumentStatus(tx: DbOrTx, customerId: string, bookingId: string | null) {
  let targetBookingId = bookingId;
  if (!targetBookingId) {
    const activeBooking = await tx.select()
      .from(bookings)
      .where(and(eq(bookings.customerId, customerId), eq(bookings.status, "active")))
      .get();
    if (activeBooking) {
      targetBookingId = activeBooking.id;
    }
  }
  
  if (!targetBookingId) return;
  
  const kprProcess = await tx.select().from(kprProcesses).where(eq(kprProcesses.bookingId, targetBookingId)).get();
  if (!kprProcess) return;
  
  const docs = await tx.select().from(customerDocuments).where(eq(customerDocuments.bookingId, targetBookingId)).all();
  
  const hasKtp = docs.some((d: typeof customerDocuments.$inferSelect) => d.documentType === "ktp" && d.status === "verified");
  const hasNpwp = docs.some((d: typeof customerDocuments.$inferSelect) => d.documentType === "npwp" && d.status === "verified");
  const hasSlip = docs.some((d: typeof customerDocuments.$inferSelect) => d.documentType === "slip_gaji" && d.status === "verified");
  const hasKk = docs.some((d: typeof customerDocuments.$inferSelect) => d.documentType === "kk" && d.status === "verified");
  
  const allCoreDocsVerified = hasKtp && hasNpwp && hasSlip && hasKk;
  
  await tx.update(kprProcesses)
    .set({ 
      documentStatus: allCoreDocsVerified ? "complete" : "incomplete",
      updatedAt: new Date()
    })
    .where(eq(kprProcesses.id, kprProcess.id))
    .run();
}

export async function verifyCustomerDocument(docId: string, status: "verified" | "rejected", notes?: string) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Admin Keuangan", "Direksi / Manager"]);
  if (status !== "verified" && status !== "rejected") {
    throw new Error("Status verifikasi dokumen tidak valid.");
  }
  if (status === "rejected" && !notes?.trim()) {
    throw new Error("Catatan perbaikan wajib diisi saat dokumen ditolak.");
  }
  let bookingIdToCheckForConstruction: string | null = null;

  await db.transaction(async (tx) => {
    const docRecord = await tx.select().from(customerDocuments).where(eq(customerDocuments.id, docId)).get();
    if (!docRecord) {
      throw new Error("Dokumen yang akan diverifikasi tidak ditemukan.");
    }

    await tx.update(customerDocuments)
      .set({ status, notes: notes || null })
      .where(eq(customerDocuments.id, docId))
      .run();

    await syncKprDocumentStatus(tx, docRecord.customerId, docRecord.bookingId);

    if (
      status === "verified" &&
      docRecord.bookingId &&
      ["ktp", "kk"].includes(docRecord.documentType)
    ) {
      bookingIdToCheckForConstruction = docRecord.bookingId;
    }

    // Write document verification log to Booking Status History
    if (docRecord.bookingId) {
        const typeLabels: Record<string, string> = {
          ktp: "KTP",
          npwp: "NPWP",
          slip_gaji: "Slip Gaji",
          kk: "Kartu Keluarga",
          spjb: "Dokumen Akad / PPJB",
          kpr_doc: "Dokumen Pendukung Bank",
          bast: "BAST Konsumen",
          other: "Berkas Lainnya",
        };
        const docLabel = typeLabels[docRecord.documentType] || docRecord.documentType.toUpperCase();

        await tx.insert(bookingStatusHistories).values({
          id: crypto.randomUUID(),
          bookingId: docRecord.bookingId,
          previousStatus: "uploaded",
          newStatus: status === "verified" ? "Doc Verified" : "Doc Rejected",
          notes: status === "verified"
            ? `Verifikasi berkas ${docLabel} disetujui (Lolos verifikasi).`
            : `Verifikasi berkas ${docLabel} ditolak. Catatan revisi: ${notes || "-"}`,
          changedBy: user.id,
          changedAt: new Date(),
        }).run();
    }
  });

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: docId,
    entityType: "customer_document",
    details: { status, notes },
  });

  if (bookingIdToCheckForConstruction) {
    await checkAndTransitionToConstruction(db, bookingIdToCheckForConstruction, user.id);
  }

  // Send notification to the assigned Marketing PIC
  try {
    const [docRecord] = await db.select().from(customerDocuments).where(eq(customerDocuments.id, docId)).limit(1);
    if (docRecord) {
      const [customer] = await db.select().from(customers).where(eq(customers.id, docRecord.customerId)).limit(1);
      if (customer && customer.assignedMarketingId) {
        const typeLabels: Record<string, string> = {
          ktp: "KTP",
          npwp: "NPWP",
          slip_gaji: "Slip Gaji",
          kk: "Kartu Keluarga",
          spjb: "Dokumen Akad / PPJB",
          kpr_doc: "Dokumen Pendukung Bank",
          bast: "BAST Konsumen",
          other: "Berkas Lainnya",
        };

        const docLabel = typeLabels[docRecord.documentType] || docRecord.documentType.toUpperCase();
        const statusLabel = status === "verified" ? "diterima/terverifikasi" : "ditolak";
        const verifierRole = await getUserRole(user.id) || "Staf Berwenang";

        await createNotification({
          userId: customer.assignedMarketingId,
          type: "info",
          title: `Verifikasi Berkas ${docLabel} - ${status === "verified" ? "Lolos" : "Ditolak"}`,
          message: `Berkas ${docLabel} konsumen ${customer.name} telah selesai diperiksa dan dinyatakan ${statusLabel} oleh ${user.name} (${verifierRole}).${notes ? ` Catatan: ${notes}` : ""}`,
          entityId: docRecord.bookingId || undefined,
          entityType: "booking",
        });
      }
    }
  } catch (err) {
    console.warn("Failed to send document verification notification to marketing PIC:", err);
  }

  revalidatePath("/marketing/bookings");
  revalidatePath("/marketing/kpr");
  return { success: true };
}

export async function deleteCustomerDocument(docId: string) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager", "Admin Keuangan"]);

  await db.transaction(async (tx) => {
    const docRecord = await tx.select().from(customerDocuments).where(eq(customerDocuments.id, docId)).get();
    if (!docRecord) throw new Error("Dokumen tidak ditemukan.");

    if (docRecord.status === "verified") {
      throw new Error("Dokumen yang sudah terverifikasi tidak dapat dihapus.");
    }

    await tx.delete(attachments).where(eq(attachments.id, docRecord.attachmentId)).run();
    await tx.delete(customerDocuments).where(eq(customerDocuments.id, docId)).run();
    
    await syncKprDocumentStatus(tx, docRecord.customerId, docRecord.bookingId);
  });

  await writeAuditLog({
    action: "delete",
    module: "marketing",
    entityId: docId,
    entityType: "customer_document",
  });

  revalidatePath("/marketing/bookings");
  revalidatePath("/marketing/kpr");
  return { success: true };
}

export async function checkFollowupReminders() {
  const now = new Date();
  
  const overdueFollowups = await db
    .select({
      id: customerFollowups.id,
      nextFollowupAt: customerFollowups.nextFollowupAt,
      customerId: customerFollowups.customerId,
      leadId: customerFollowups.leadId,
      createdBy: customerFollowups.createdBy,
      customerName: customers.name,
      leadName: leads.name,
      customerAssignedMkt: customers.assignedMarketingId,
      leadAssignedMkt: leads.assignedMarketingId,
    })
    .from(customerFollowups)
    .leftJoin(customers, eq(customerFollowups.customerId, customers.id))
    .leftJoin(leads, eq(customerFollowups.leadId, leads.id))
    .where(
      and(
        isNotNull(customerFollowups.nextFollowupAt),
        lte(customerFollowups.nextFollowupAt, now)
      )
    );

  if (overdueFollowups.length === 0) {
    return { success: true, notifiedCount: 0 };
  }

  const followupIds = overdueFollowups.map(item => item.id);

  // Check which notifications already exist in a single batch query
  const existingNotifications = await db
    .select({ entityId: notifications.entityId })
    .from(notifications)
    .where(
      and(
        inArray(notifications.entityId, followupIds),
        eq(notifications.entityType, "followup_reminder")
      )
    );

  const existingEntityIds = new Set(
    existingNotifications
      .map(n => n.entityId)
      .filter((id): id is string => id !== null)
  );

  const batchValues: typeof notifications.$inferInsert[] = [];

  for (const item of overdueFollowups) {
    if (existingEntityIds.has(item.id)) continue;

    const targetUserId = item.customerAssignedMkt || item.leadAssignedMkt || item.createdBy;
    if (!targetUserId) continue;

    const name = item.customerName || item.leadName || "Konsumen";
    const typeLabel = item.customerId ? "konsumen" : "prospek/lead";

    batchValues.push({
      id: crypto.randomUUID(),
      userId: targetUserId,
      type: "info",
      title: "Jadwal Follow-up Terlewat",
      message: `Jadwal follow-up berikutnya untuk ${typeLabel} "${name}" seharusnya pada ${new Date(item.nextFollowupAt!).toLocaleDateString("id-ID")}. Silakan lakukan tindakan.`,
      entityId: item.id,
      entityType: "followup_reminder",
      isRead: false,
      createdAt: new Date(),
    });
  }

  if (batchValues.length > 0) {
    await db.insert(notifications).values(batchValues);
  }

  return { success: true, notifiedCount: batchValues.length };
}

export async function deleteBookingAttachment(attachmentId: string) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);

  const [att] = await db.select().from(attachments).where(eq(attachments.id, attachmentId));
  if (!att) throw new Error("Lampiran tidak ditemukan.");

  await db.delete(attachments).where(eq(attachments.id, attachmentId));

  await writeAuditLog({
    action: "delete",
    module: "marketing",
    entityId: attachmentId,
    entityType: "booking_proof",
    details: { fileName: att.fileName, bookingId: att.entityId },
  });

  revalidatePath(`/marketing/bookings/${att.entityId}`);
  revalidatePath("/marketing/bookings");
  return { success: true };
}

export async function checkAndTransitionToConstruction(tx: DbOrTx, bookingId: string, userId: string) {
  // Find booking
  const booking = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking) return;

  // Find unit
  const unit = await tx.select().from(units).where(eq(units.id, booking.unitId)).get();
  if (!unit) return;

  // Ready stock units bypass construction phase entirely (BR-22)
  if (
    unit.isReadyStock ||
    unit.readyStockSource === "legacy_ready_stock" ||
    unit.readyStockSource === "manual_ready_stock"
  ) {
    return;
  }

  // Only booked units can be promoted into construction. This prevents stale
  // currentBookingId data from moving ready/handover/terminal units backwards.
  if (!["booking", "kpr_process"].includes(unit.status)) {
    return;
  }

  const cashConstructionReadiness = await getCashConstructionReadiness(tx, bookingId);
  if (!cashConstructionReadiness.eligible) {
    return;
  }

  // Find invoices
  const bookingInvoices = await tx.select().from(invoices).where(eq(invoices.bookingId, bookingId)).all();

  // Booking fee must exist AND be paid (not absent)
  // If BF invoice was never created (bookingFee = 0), treat as not paid — require explicit payment
  const bfInvoice = bookingInvoices.find((i) => i.type === "booking_fee");
  const bfPaid = !!bfInvoice && bfInvoice.status === "paid";

  // For KPR: DP is conditional (bank may waive it). Only treat as "not required" if
  // dpAmount was explicitly 0 at booking time (no invoice generated).
  // If invoice exists but unpaid ? block.
  const dpInvoice = bookingInvoices.find((i) => i.type === "dp");
  const dpPaid = !dpInvoice || dpInvoice.status === "paid";
  // Note: !dpInvoice = developer set dpAmount = 0 at booking = dp not required for this deal.
  // If dpInvoice exists but unpaid = dp required but not yet paid = block.

  // Check KPR status
  let kprApproved = true;
  if (booking.paymentScheme === "kpr") {
    const kpr = await tx.select().from(kprProcesses).where(eq(kprProcesses.bookingId, bookingId)).get();
    kprApproved = kpr && (kpr.status === "approved" || kpr.status === "akad");
  }

  if (bfPaid && dpPaid && kprApproved) {
    // Transition to construction
    await tx.update(units)
      .set({
        status: "construction",
        updatedAt: new Date(),
      })
      .where(eq(units.id, booking.unitId))
      .run();

    await tx.insert(unitStatusHistories).values({
      id: crypto.randomUUID(),
      unitId: booking.unitId,
      previousStatus: unit.status,
      newStatus: "construction",
      reason: booking.paymentScheme === "cash"
        ? "Otomatis: Seluruh invoice Cash lunas serta KTP dan Kartu Keluarga telah diverifikasi. Unit masuk pembangunan fisik."
        : booking.paymentScheme === "installment"
          ? "Otomatis: Booking Fee, DP, KTP, dan Kartu Keluarga telah diverifikasi. Unit Cash Bertahap masuk pembangunan fisik; seluruh termin tetap wajib lunas sebelum Akad / PPJB."
          : "Otomatis: Pembayaran DP lunas dan analisis KPR disetujui. Unit masuk pembangunan fisik.",
      changedBy: userId,
      changedAt: new Date(),
    }).run();

    // Create notification for the triggering user
    await createNotification({
      userId: userId,
      type: "info",
      title: "Unit Siap Pembangunan Konsumen",
      message: `Unit ${unit.code} telah memenuhi seluruh syarat (Booking Fee & DP Lunas${booking.paymentScheme === "kpr" ? " — KPR Disetujui" : ""}). Status otomatis berubah menjadi Pembangunan Unit Konsumen. Silakan terbitkan SPK.`,
      entityId: unit.projectId,
      entityType: "unit_construction_ready",
    });

    // Broadcast to all authorized roles who can trigger manual construction start
    await notifyUsersWithRoles({
      roleNames: ["Super Admin", "Admin Kantor", "Marketing Manager"],
      type: "info",
      title: "??? Kavling Siap Dibangun",
      message: `Unit ${unit.code} telah memenuhi seluruh syarat pembangunan (Booking Fee & DP Lunas${booking.paymentScheme === "kpr" ? " — KPR Disetujui" : ""}). Buka Site Plan untuk menerbitkan SPK Konstruksi.`,
      entityId: unit.projectId,
      entityType: "unit_construction_ready",
    });
  }
}

export async function startPhysicalConstructionManual(unitId: string) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing Manager"]);
  
  const result = await db.transaction(async (tx) => {
    const unit = await tx.select().from(units).where(eq(units.id, unitId)).get();
    if (!unit) throw new Error("Unit tidak ditemukan.");

    if (
      unit.isReadyStock ||
      unit.readyStockSource === "legacy_ready_stock" ||
      unit.readyStockSource === "manual_ready_stock"
    ) {
      throw new Error(
        "Unit sudah berstatus Tersedia Siap Huni. Tidak perlu masuk ke Pembangunan Fisik; lanjutkan ke Akad / PPJB atau Pipeline KPR sesuai skema."
      );
    }

    if (!unit.currentBookingId) {
      throw new Error("Unit tidak memiliki data booking aktif.");
    }

    const booking = await tx.select().from(bookings).where(eq(bookings.id, unit.currentBookingId)).get();
    if (!booking) throw new Error("Data booking tidak ditemukan.");

    if (!["booking", "kpr_process"].includes(unit.status)) {
      throw new Error("Pembangunan fisik hanya bisa dimulai dari status Booking atau Proses KPR.");
    }

    const cashConstructionReadiness = await getCashConstructionReadiness(tx, booking.id);
    if (!cashConstructionReadiness.eligible) {
      throw new Error(cashConstructionReadiness.reason);
    }

    // Find invoices
    const bookingInvoices = await tx.select().from(invoices).where(eq(invoices.bookingId, booking.id)).all();

    // Booking fee must exist AND be paid
    const bfInvoice = bookingInvoices.find((i) => i.type === "booking_fee");
    const bfPaid = !!bfInvoice && bfInvoice.status === "paid";
    if (!bfPaid) {
      throw new Error("Booking Fee belum divalidasi Lunas oleh Keuangan.");
    }

    // DP: only block if invoice exists but unpaid. If no invoice = dpAmount was 0 = ok.
    const dpInvoice = bookingInvoices.find((i) => i.type === "dp");
    const dpPaid = !dpInvoice || dpInvoice.status === "paid";
    if (!dpPaid) {
      throw new Error("Uang Muka (DP) belum divalidasi Lunas oleh Keuangan.");
    }

    // Check KPR status
    if (booking.paymentScheme === "kpr") {
      const kpr = await tx.select().from(kprProcesses).where(eq(kprProcesses.bookingId, booking.id)).get();
      const kprApproved = kpr && (kpr.status === "approved" || kpr.status === "akad");
      if (!kprApproved) {
        throw new Error("Analisis KPR belum disetujui (Status minimal 'Disetujui' / SP3K Terbit).");
      }
    }

    // Transition to construction
    await tx.update(units)
      .set({
        status: "construction",
        updatedAt: new Date(),
      })
      .where(eq(units.id, unitId))
      .run();

    await tx.insert(unitStatusHistories).values({
      id: crypto.randomUUID(),
      unitId: unitId,
      previousStatus: unit.status,
      newStatus: "construction",
      reason: booking.paymentScheme === "cash"
        ? "Manual: Seluruh invoice Cash lunas serta KTP dan Kartu Keluarga telah diverifikasi. Memulai pembangunan fisik."
        : booking.paymentScheme === "installment"
          ? "Manual: Booking Fee, DP, KTP, dan Kartu Keluarga telah diverifikasi. Memulai pembangunan Cash Bertahap; seluruh termin tetap wajib lunas sebelum Akad / PPJB."
          : "Manual: Analisis KPR telah disetujui. Memulai pembangunan fisik.",
      changedBy: user.id,
      changedAt: new Date(),
    }).run();

    return { projectId: booking.projectId };
  });

  revalidatePath(`/siteplan/${result.projectId}`);
  return { success: true };
}

async function getOrCreateIncomeKprCategoryId(): Promise<string> {
  const categoryResults = await db
    .select()
    .from(financeCategories)
    .where(
      and(
        eq(financeCategories.type, "income"),
        sql`lower(${financeCategories.name}) LIKE '%realisasi%' OR lower(${financeCategories.name}) LIKE '%kpr%'`
      )
    )
    .limit(1)
    .get();

  if (categoryResults) {
    return categoryResults.id;
  }

  // Fallback to any income category
  const fallbackResults = await db
    .select()
    .from(financeCategories)
    .where(eq(financeCategories.type, "income"))
    .limit(1)
    .get();

  if (fallbackResults) {
    return fallbackResults.id;
  }

  // Create new category if none exists
  const newId = crypto.randomUUID();
  await db.insert(financeCategories).values({
    id: newId,
    name: "Realisasi KPR",
    type: "income",
    status: "active",
  });

  return newId;
}

export async function realizeKprFunds(data: unknown) {
  // 1. Auth & Role Guard
  const activeUser = await requireAnyRole([
    "Super Admin", "Admin Keuangan", "Marketing Manager", "Admin Kantor"
  ]);

  // 2. Validasi Input (Zod)
  const parsed = realizeKprSchema.parse(data);

  // 3. Formula Kas Bersih (server-side)
  const netReceived =
    parsed.plafondApproved -
    parsed.realizedBankFees -
    parsed.realizedInsuranceFees -
    parsed.realizedWithheldAmount;

  // 4. Fetch async SEBELUM transaction
  const attachment = await db
    .select({ id: attachments.id, entityType: attachments.entityType, entityId: attachments.entityId })
    .from(attachments)
    .where(eq(attachments.id, parsed.realizedAttachmentId))
    .get();
  if (!attachment) throw new Error("File memo pencairan tidak ditemukan. Silakan unggah ulang.");
  if (attachment.entityType !== "kpr_realization_memo") {
    throw new Error("File yang diunggah bukan bertipe memo pencairan KPR. Silakan unggah file yang benar.");
  }
  if (attachment.entityId !== parsed.kprProcessId) {
    throw new Error("Memo pencairan harus berasal dari proses KPR yang sama dan tidak dapat digunakan ulang untuk KPR lain.");
  }

  const incomeCategoryId = await getOrCreateIncomeKprCategoryId();
  if (!incomeCategoryId) throw new Error("Kategori pemasukan KPR belum dikonfigurasi di Master Data.");

  let bookingId = "";
  let unitId = "";
  let projectId = "";
  let oldKprStatus = "";
  let oldUnitStatus = "";

  // 5. Synchronous Transaction Atomic
  await db.transaction(async (tx) => {
    // 5.1. Get & Validate KPR status
    const kpr = await tx.select().from(kprProcesses).where(eq(kprProcesses.id, parsed.kprProcessId)).get();
    if (!kpr) throw new Error("Proses KPR tidak ditemukan.");
    oldKprStatus = kpr.status;

    if (kpr.status !== "akad") {
      throw new Error("Realisasi dana hanya dapat diproses apabila status KPR saat ini adalah 'Akad'.");
    }
    if ((kpr.status as string) === "realisasi" || kpr.realizedDate) {
      throw new Error("Realisasi dana KPR sudah pernah diproses. Tidak bisa diproses dua kali.");
    }

    // Nominal pencairan wajib bersandar pada keputusan bank yang sudah
    // disetujui. Tanpa ini, nominal dapat diisi bebas dari dialog realisasi.
    const approvedSubmissions = await tx
      .select({ id: bankSubmissions.id, plafondAmount: bankSubmissions.plafondAmount })
      .from(bankSubmissions)
      .where(and(
        eq(bankSubmissions.kprProcessId, parsed.kprProcessId),
        eq(bankSubmissions.status, "approved")
      ));
    if (approvedSubmissions.length === 0) {
      throw new Error("Realisasi dana memerlukan minimal satu keputusan bank berstatus Disetujui.");
    }
    const maximumApprovedPlafond = Math.max(
      ...approvedSubmissions.map((submission) => Number(submission.plafondAmount ?? 0))
    );
    if (!Number.isFinite(maximumApprovedPlafond) || maximumApprovedPlafond <= 0) {
      throw new Error("Nominal plafon pada keputusan bank belum valid. Perbarui keputusan bank sebelum realisasi.");
    }
    if (round2(parsed.plafondApproved) > round2(maximumApprovedPlafond)) {
      throw new Error("Nominal plafon realisasi tidak boleh melebihi plafon yang disetujui bank.");
    }

    // 5.2. Layer 2 Idempotency: check if transaction already has this kprProcessId
    const existingKprTrx = await tx.select({ id: transactions.id }).from(transactions).where(eq(transactions.kprProcessId, parsed.kprProcessId)).get();
    if (existingKprTrx) {
      throw new Error("Transaksi realisasi dana KPR sudah pernah dibuat. Kemungkinan double submit.");
    }

    // 5.3. Get & Validate Booking
    const booking = await tx.select().from(bookings).where(eq(bookings.id, kpr.bookingId)).get();
    if (!booking) throw new Error("Data booking konsumen tidak ditemukan.");
    if (booking.paymentScheme !== "kpr") {
      throw new Error("Realisasi dana bank hanya berlaku untuk booking dengan metode pembayaran KPR.");
    }
    if (["cancelled", "rejected"].includes(booking.status)) {
      throw new Error("Booking sudah batal/ditolak. Realisasi dana tidak dapat diproses.");
    }

    bookingId = booking.id;
    projectId = booking.projectId;

    // 5.4. Get & Validate Unit
    const unit = await tx.select().from(units).where(eq(units.id, booking.unitId)).get();
    if (!unit) throw new Error("Unit tidak ditemukan.");
    unitId = unit.id;
    oldUnitStatus = unit.status;

    const ALLOWED_UNIT_STATUSES = ["sold", "payment_pending", "menunggu_serah_terima", "construction", "construction_done", "kpr_process", "booking"];
    if (!ALLOWED_UNIT_STATUSES.includes(unit.status)) {
      throw new Error(
        `Status unit "${unit.status}" tidak valid untuk realisasi KPR. ` +
        `Unit harus berstatus "sold", "payment_pending", "construction", atau "construction_done".`
      );
    }
    if (unit.status === "handover_complete") {
      throw new Error("Unit sudah serah terima selesai.");
    }

    // 5.5. Get & Validate Account
    const account = await tx.select().from(financeAccounts).where(eq(financeAccounts.id, parsed.realizedAccountId)).get();
    if (!account) throw new Error("Rekening tujuan realisasi tidak ditemukan.");
    if (account.status !== "active") throw new Error("Rekening tujuan realisasi tidak aktif.");
    if (account.type !== "cash" && account.type !== "bank") {
      throw new Error("Rekening tujuan realisasi harus bertipe Kas atau Bank.");
    }

    // 5.6. Update KPR ? status "realisasi"
    await tx.update(kprProcesses).set({
      status: "realisasi",
      realizedDate: parsed.realizedDate,
      plafondApproved: parsed.plafondApproved,
      realizedNetReceived: netReceived,
      realizedBankFees: parsed.realizedBankFees,
      realizedInsuranceFees: parsed.realizedInsuranceFees,
      realizedWithheldAmount: parsed.realizedWithheldAmount,
      realizedAccountId: parsed.realizedAccountId,
      realizedAttachmentId: parsed.realizedAttachmentId,
      realizedNotes: parsed.realizedNotes || null,
      updatedAt: new Date(),
    }).where(eq(kprProcesses.id, parsed.kprProcessId)).run();

    // Akad Kredit menjadi booking selesai hanya sesudah realisasi dana bank
    // tercatat. Ini mencegah UI menyebut transaksi selesai lebih awal.
    await tx.update(bookings).set({
      status: "completed",
      updatedAt: new Date(),
    }).where(eq(bookings.id, booking.id)).run();
    await tx.update(customers).set({
      status: "buyer",
      updatedAt: new Date(),
    }).where(eq(customers.id, booking.customerId)).run();

    // 5.7. Update Unit to menunggu_serah_terima (only if not already)
    if (unit.status !== "menunggu_serah_terima") {
      await tx.update(units).set({
        status: "menunggu_serah_terima",
        updatedAt: new Date(),
      }).where(eq(units.id, unit.id)).run();

      await tx.insert(unitStatusHistories).values({
        id: crypto.randomUUID(),
        unitId: unit.id,
        previousStatus: unit.status,
        newStatus: "menunggu_serah_terima",
        reason: "Realisasi dana KPR dari bank partner — unit siap diserahterimakan",
        changedBy: activeUser.id,
        changedAt: new Date(),
      }).run();
    }

    // 5.8. Insert TRX-IN to transactions
    const dateStr = parsed.realizedDate.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();

    await tx.insert(transactions).values({
      id: crypto.randomUUID(),
      transactionNumber: `TRX-IN-KPR-${dateStr}-${rand}`,
      projectId: booking.projectId,
      unitId: booking.unitId,
      customerId: booking.customerId,
      kprProcessId: parsed.kprProcessId,
      accountId: parsed.realizedAccountId,
      categoryId: incomeCategoryId,
      type: "income",
      description: `Realisasi bersih dana KPR Unit ${unit.code} — ${account.name}`,
      amount: netReceived,
      transactionDate: parsed.realizedDate,
      paymentMethod: "transfer",
      approvalStatus: "not_required",
      attachmentId: parsed.realizedAttachmentId,
      createdBy: activeUser.id,
    }).run();
  });

  // 6. Audit Log
  try {
    await writeAuditLog({
      action: "kpr_realization",
      module: "finance",
      entityId: parsed.kprProcessId,
      entityType: "kpr_process",
      details: {
        trigger: "kpr_bank_disbursement",
        kprProcessId: parsed.kprProcessId,
        bookingId,
        unitId,
        projectId,
        oldKprStatus,
        newKprStatus: "realisasi",
        oldUnitStatus,
        newUnitStatus: "menunggu_serah_terima",
        plafondApproved: parsed.plafondApproved,
        realizedNetReceived: netReceived,
        realizedBankFees: parsed.realizedBankFees,
        realizedInsuranceFees: parsed.realizedInsuranceFees,
        realizedWithheldAmount: parsed.realizedWithheldAmount,
        realizedDate: parsed.realizedDate,
      },
    });
  } catch (err) {
    console.warn("[realizeKprFunds] Audit log gagal ditulis:", err);
  }

  // 7. Notifikasi Multi-Role
  try {
    await notifyUsersWithRoles({
      roleNames: ["Super Admin", "Admin Keuangan", "Direksi / Manager", "Admin Kantor", "Marketing Manager"],
      type: "handover_waiting",
      title: "Dana KPR Terealisasi — Unit Siap Serah Terima",
      message: `Dana KPR dicairkan bersih Rp ${netReceived.toLocaleString("id-ID")}. Unit kini menunggu serah terima konsumen.`,
      entityId: bookingId,
      entityType: "unit_handover_wait",
    });
  } catch (err) {
    console.warn("[realizeKprFunds] Gagal mengirim notifikasi:", err);
  }

  // 8. Revalidate paths
  revalidatePath("/marketing/kpr");
  revalidatePath("/finance/transactions");
  revalidatePath("/master/units");
  revalidatePath("/production");
  revalidatePath("/siteplan");
  revalidatePath("/dashboard");
  if (projectId) {
    revalidatePath(`/siteplan/${projectId}`);
  }

  return {
    success: true,
    kprProcessId: parsed.kprProcessId,
    bookingId,
    unitId,
    realizedNetReceived: netReceived,
    newUnitStatus: "menunggu_serah_terima",
  };
}

export async function createRealizationAttachment(data: {
  kprProcessId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
}) {
  const activeUser = await requireAnyRole([
    "Super Admin", "Admin Keuangan", "Marketing Manager", "Admin Kantor"
  ]);

  const kpr = await db.select({ id: kprProcesses.id, status: kprProcesses.status })
    .from(kprProcesses)
    .where(eq(kprProcesses.id, data.kprProcessId))
    .get();
  if (!kpr) throw new Error("Proses KPR tidak ditemukan.");
  if (kpr.status !== "akad") {
    throw new Error("Memo pencairan hanya dapat diunggah setelah proses KPR berada pada tahap Akad.");
  }

  const id = crypto.randomUUID();
  await db.insert(attachments).values({
    id,
    entityType: "kpr_realization_memo",
    entityId: data.kprProcessId,
    fileName: data.fileName,
    fileUrl: data.fileUrl,
    mimeType: data.mimeType,
    fileSize: data.fileSize,
    uploadedBy: activeUser.id,
  });

  return { success: true, attachmentId: id };
}


