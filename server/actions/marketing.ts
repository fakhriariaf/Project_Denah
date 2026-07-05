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
  kprProcessSchema,
  kprUpdateSchema,
  bankPartnerSchema, 
  bankSubmissionSchema,
  realizeKprSchema
} from "../validators/marketing";
import { requireAnyRole, getSessionRole, getUserRole } from "../permissions";
import { eq, and, or, sql, inArray, desc, lte, isNotNull, ilike, count } from "drizzle-orm";
import { calculateOffset, validatePaginationParams, type PaginatedResult } from "@/lib/pagination";
import { revalidatePath } from "next/cache";
import { writeAuditLog, safeWriteBlockedTransitionLog } from "./audit";
import { createNotification, notifyUsersWithRoles } from "./notification";
import { applyRateLimit } from "@/server/middleware/apply-rate-limit";

// --- LEADS ---
export async function createLead(data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  applyRateLimit(user.id);
  const parsed = leadSchema.parse(data);
  const id = crypto.randomUUID();
  const targetPicId = parsed.assignedMarketingId || user.id;

  // Duplicate phone guard � block if active lead with same phone already exists
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

    // If 0 rows were updated, the unit was concurrently booked by another request � abort
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

    // 8. Auto-generate Booking Fee Invoice
    if (parsed.bookingFee && parsed.bookingFee > 0) {
      const invoiceNum = `INV-BF-${bookingNumber}`;
      await tx.insert(invoices).values({
        id: crypto.randomUUID(),
        invoiceNumber: invoiceNum,
        projectId: parsed.projectId,
        unitId: parsed.unitId,
        customerId: finalCustomerId,
        bookingId: id,
        type: "booking_fee",
        amount: parsed.bookingFee,
        dueDate: parsed.bookingDate,
        status: "unpaid",
      }).run();
    }

    // 9. Auto-generate DP Invoice (for all payment schemes including KPR)
    if (parsed.dpAmount && parsed.dpAmount > 0) {
      const dpDueDate = new Date(parsed.bookingDate);
      dpDueDate.setDate(dpDueDate.getDate() + 14); // 14 days from booking
      await tx.insert(invoices).values({
        id: crypto.randomUUID(),
        invoiceNumber: `INV-DP-${bookingNumber}`,
        projectId: parsed.projectId,
        unitId: parsed.unitId,
        customerId: finalCustomerId,
        bookingId: id,
        type: "dp",
        amount: parsed.dpAmount,
        dueDate: dpDueDate,
        status: "unpaid",
      }).run();
    }

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
  const parsed = bookingSchema.parse(data);

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

    // 2. Query existing invoices to prevent modifying paid invoices
    const bfInvoice = await tx.select().from(invoices).where(and(eq(invoices.bookingId, id), eq(invoices.type, "booking_fee"))).get();
    const dpInvoice = await tx.select().from(invoices).where(and(eq(invoices.bookingId, id), eq(invoices.type, "dp"))).get();

    if (bfInvoice && bfInvoice.amount !== parsed.bookingFee && bfInvoice.status !== "unpaid") {
      throw new Error("Nominal Booking Fee tidak dapat diubah karena tagihan kuitansi terkait sudah terbayar sebagian atau lunas.");
    }
    if (dpInvoice && dpInvoice.amount !== parsed.dpAmount && dpInvoice.status !== "unpaid") {
      throw new Error("Nominal Uang Muka (DP) tidak dapat diubah karena tagihan kuitansi terkait sudah terbayar sebagian atau lunas.");
    }

    // 3. If paymentScheme changes, handle KPR processes adjustments
    const schemeChanged = existingBooking.paymentScheme !== parsed.paymentScheme;
    
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

    // 5. Update/Regenerate Invoices dynamically
    // A. Booking Fee Invoice
    if (bfInvoice) {
      if (parsed.bookingFee > 0) {
        if (bfInvoice.status === "unpaid") {
          await tx.update(invoices).set({
            amount: parsed.bookingFee,
            dueDate: parsed.bookingDate,
            updatedAt: new Date(),
          }).where(eq(invoices.id, bfInvoice.id)).run();
        }
      } else {
        // bookingFee is 0, delete the unpaid invoice
        if (bfInvoice.status === "unpaid") {
          await tx.delete(invoices).where(eq(invoices.id, bfInvoice.id)).run();
        }
      }
    } else if (parsed.bookingFee > 0) {
      // Create new booking fee invoice
      const invoiceNum = `INV-BF-${existingBooking.bookingNumber}`;
      await tx.insert(invoices).values({
        id: crypto.randomUUID(),
        invoiceNumber: invoiceNum,
        projectId: existingBooking.projectId,
        unitId: existingBooking.unitId,
        customerId: existingBooking.customerId,
        bookingId: id,
        type: "booking_fee",
        amount: parsed.bookingFee,
        dueDate: parsed.bookingDate,
        status: "unpaid",
      }).run();
    }

    // B. DP Invoice
    if (dpInvoice) {
      if (parsed.dpAmount > 0) {
        if (dpInvoice.status === "unpaid") {
          const dpDueDate = new Date(parsed.bookingDate);
          dpDueDate.setDate(dpDueDate.getDate() + 14); // 14 days from booking
          await tx.update(invoices).set({
            amount: parsed.dpAmount,
            dueDate: dpDueDate,
            updatedAt: new Date(),
          }).where(eq(invoices.id, dpInvoice.id)).run();
        }
      } else {
        // dpAmount is 0, delete the unpaid DP invoice
        if (dpInvoice.status === "unpaid") {
          await tx.delete(invoices).where(eq(invoices.id, dpInvoice.id)).run();
        }
      }
    } else if (parsed.dpAmount > 0) {
      // Create new DP invoice
      const dpDueDate = new Date(parsed.bookingDate);
      dpDueDate.setDate(dpDueDate.getDate() + 14); // 14 days from booking
      await tx.insert(invoices).values({
        id: crypto.randomUUID(),
        invoiceNumber: `INV-DP-${existingBooking.bookingNumber}`,
        projectId: existingBooking.projectId,
        unitId: existingBooking.unitId,
        customerId: existingBooking.customerId,
        bookingId: id,
        type: "dp",
        amount: parsed.dpAmount,
        dueDate: dpDueDate,
        status: "unpaid",
      }).run();
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
    // 1. Fetch booking INSIDE transaction � eliminates stale-read race condition
    const booking = await tx.select().from(bookings).where(eq(bookings.id, id)).get();
    if (!booking) throw new Error("Booking tidak ditemukan.");
    if (booking.status === "cancelled") throw new Error("Booking sudah dibatalkan sebelumnya.");

    // P0 Guard: Check if there are any invoices with status "paid" or "partial" linked to this booking
    const paidInvoices = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.bookingId, id),
          inArray(invoices.status, ["paid", "partial"])
        )
      )
      .all();

    if (paidInvoices.length > 0) {
      await safeWriteBlockedTransitionLog({
        module: "marketing",
        entityType: "booking",
        entityId: id,
        details: {
          action: "cancelBooking_blocked_paid_invoice",
          bookingId: id,
          reason: "Booking ini sudah memiliki kuitansi lunas/sebagian. Pembatalan langsung ditolak.",
        },
      });
      throw new Error(
        "Booking ini sudah memiliki kuitansi pembayaran terverifikasi atau lunas sebagian. Pembatalan langsung tidak diperbolehkan. Silakan buat pengajuan refund atau pembatalan dengan persetujuan Direksi."
      );
    }

    // Also check if any payment is "verified"
    const bookingInvoices = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.bookingId, id))
      .all();
    
    const invoiceIds = bookingInvoices.map(r => r.id);
    if (invoiceIds.length > 0) {
      const verifiedPayments = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            inArray(payments.invoiceId, invoiceIds),
            eq(payments.status, "verified")
          )
        )
        .all();

      if (verifiedPayments.length > 0) {
        await safeWriteBlockedTransitionLog({
          module: "marketing",
          entityType: "booking",
          entityId: id,
          details: {
            action: "cancelBooking_blocked_verified_payment",
            bookingId: id,
            reason: "Booking ini memiliki pembayaran yang berstatus verified. Pembatalan langsung ditolak.",
          },
        });
        throw new Error(
          "Booking ini sudah memiliki kuitansi pembayaran terverifikasi. Pembatalan langsung tidak diperbolehkan. Silakan ajukan proses refund atau pembatalan melalui persetujuan Direksi."
        );
      }
    }

    projectId = booking.projectId;

    // 2. Update Booking status to cancelled
    await tx.update(bookings).set({
      status: "cancelled",
      cancellationReason: reason,
      updatedAt: new Date(),
    }).where(eq(bookings.id, id)).run();

    // 3. Set Unit state back to available
    const unit = await tx.select().from(units).where(eq(units.id, booking.unitId)).get();
    const previousStatus = unit?.status || "booking";

    await tx.update(units).set({
      status: "available",
      currentCustomerId: null,
      currentBookingId: null,
      updatedAt: new Date(),
    }).where(eq(units.id, booking.unitId)).run();

    // 4. Revert Customer status back to prospect (available for future bookings)
    await tx.update(customers).set({
      status: "prospect",
      updatedAt: new Date(),
    }).where(eq(customers.id, booking.customerId)).run();

    // 5. Log status histories
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

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: id,
    entityType: "booking",
    details: { action: "cancel", reason },
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
      reason: "Unit sudah Ready Stock.",
    };
  }

  const isConstructionOrIndent =
    dbUnit.status === "construction" ||
    dbUnit.status === "overdue" ||
    dbUnit.status === "construction_done" ||
    dbUnit.status === "kpr_process" ||
    dbUnit.status === "booking";

  if (isConstructionOrIndent) {
    const progressDone = (dbUnit.constructionProgress ?? 0) === 100;

    return {
      ready: progressDone,
      reason: progressDone
        ? "Progress fisik unit sudah 100%."
        : "Akad KPR untuk unit indent hanya dapat dilakukan setelah progress fisik 100%.",
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
    documentStatus?: string;
    approvedBankPartnerId?: string | null;
  }
) {
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

  const currentStatus = kpr.status;
  const newStatus = targetStatus;

  // Enforce one-way gates
  const BACKWARD_FROM_APPROVED = ["bi_checking", "pemberkasan", "proses_bank", "offering"];
  if (currentStatus === "approved" && BACKWARD_FROM_APPROVED.includes(newStatus)) {
    throw new Error(
      "KPR yang sudah berstatus Approved tidak dapat dikembalikan ke tahap sebelumnya. " +
      "Dari Approved, alur hanya dapat maju ke tahap Akad."
    );
  }

  const BACKWARD_FROM_REALISASI = ["bi_checking", "pemberkasan", "proses_bank", "offering", "approved", "akad"];
  if (currentStatus === "realisasi" && BACKWARD_FROM_REALISASI.includes(newStatus)) {
    throw new Error(
      "Status Realisasi tidak dapat dikembalikan ke tahap sebelumnya. " +
      "Dana KPR yang sudah dicairkan tidak dapat dibatalkan melalui sistem ini."
    );
  }

  if (newStatus === "rejected" && currentStatus === "approved") {
    throw new Error(
      "KPR yang sudah berstatus Approved tidak dapat dikembalikan ke Ditolak (Rejected). " +
      "Hubungi Super Admin jika diperlukan penanganan khusus."
    );
  }

  // 3. Validation for Pemberkasan / Proses Bank: Documents must be complete
  const finalDocStatus = payload.documentStatus ?? kpr.documentStatus;
  if ((newStatus === "pemberkasan" || newStatus === "proses_bank") && finalDocStatus !== "complete") {
    throw new Error("Berkas berkas KPR belum lengkap. Silakan lengkapi berkas di berkas checklist KPR terlebih dahulu.");
  }

  // Must pass through "pemberkasan" before reaching "proses_bank"
  // Direct jump from bi_checking ? proses_bank is not allowed
  const STAGES_BEFORE_PROSES_BANK = ["bi_checking"];
  if (newStatus === "proses_bank" && STAGES_BEFORE_PROSES_BANK.includes(currentStatus)) {
    throw new Error(
      "Tidak dapat langsung ke Proses Bank dari BI Checking. " +
      "Wajib melewati tahap Pemberkasan (pengumpulan & verifikasi dokumen) terlebih dahulu."
    );
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

  return { kpr, booking };
}

export async function updateKprProcess(id: string, data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  // Use kprUpdateSchema (no bookingId required � resolved from DB by id)
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
    // Call KPR State Transition validator first, logging blocked attempts
    try {
      await validateKprStateTransition(tx, id, parsed.status, {
        documentStatus: parsed.documentStatus,
        approvedBankPartnerId: parsed.approvedBankPartnerId,
      });
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
      documentStatus: parsed.documentStatus,
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

      // Booking = completed
      await tx.update(bookings).set({
        status: "completed",
        updatedAt: new Date(),
      }).where(eq(bookings.id, booking.id)).run();
    } else {
      // Synchronize unit status to match KPR state
      let unitState: "construction" | "kpr_process" | "booking" | "available" = "kpr_process";
      if (parsed.status === "rejected") {
        // KPR rejected ? release unit back to market
        unitState = "available";
      } else if (parsed.status === "bi_checking" || parsed.status === "pemberkasan") {
        // Early KPR stages remain as booking
        unitState = "booking";
      } else if (parsed.status === "approved") {
        // Approved KPR transitions unit to construction ONLY for non-ready-stock (indent) units.
        // Ready stock units bypass construction phase entirely (BR-22).
        const unitForApproved = await tx.select({ isReadyStock: units.isReadyStock }).from(units).where(eq(units.id, booking.unitId)).get();
        if (!unitForApproved?.isReadyStock) {
          unitState = "construction";
        }
        // else: keep unitState = "kpr_process" for ready stock � handover gate handled separately
      }

      const currentUnit = await tx.select().from(units).where(eq(units.id, booking.unitId)).get();
      if (currentUnit && currentUnit.status !== unitState) {
        const unitUpdate: Partial<typeof units.$inferInsert> = {
          status: unitState,
          updatedAt: new Date(),
        };
        // On KPR rejection, clear customer/booking references so unit is truly free
        if (parsed.status === "rejected") {
          unitUpdate.currentCustomerId = null;
          unitUpdate.currentBookingId = null;
        } else {
          unitUpdate.currentCustomerId = booking.customerId;
          unitUpdate.currentBookingId = booking.id;
        }
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
  
  let bookingProjectId = "";
  let bookingIdToTransition = "";

  await db.transaction(async (tx) => {
    // Call KPR State Transition validator first, logging blocked attempts
    try {
      await validateKprStateTransition(tx, id, newStatus, {});
    } catch (err: unknown) {
      await safeWriteBlockedTransitionLog({
        module: "marketing",
        entityType: "kpr_process",
        entityId: id,
        details: {
          action: "updateKprStatusDirect_blocked_transition",
          kprProcessId: id,
          targetStatus: newStatus,
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
      notesMap[newStatus] = revisionNotes;
      updatedNotes = JSON.stringify(notesMap);
    }

    // 5. Update KPR row status
    await tx.update(kprProcesses).set({
      status: newStatus as "bi_checking" | "pemberkasan" | "proses_bank" | "offering" | "approved" | "rejected" | "akad",
      bankNotes: updatedNotes,
      akadDate: newStatus === "akad" ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(kprProcesses.id, id)).run();

    // 6. Synchronize unit status based on KPR status
    if (newStatus === "akad") {
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
        status: "completed",
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
          reason: "Dana KPR telah direalisasikan � unit menunggu serah terima fisik kepada konsumen",
          changedBy: user.id,
          changedAt: new Date(),
        }).run();
      }

    } else {
      let unitState: "kpr_process" | "booking" | "available" = "kpr_process";
      if (newStatus === "rejected") {
        unitState = "available";
      } else if (newStatus === "bi_checking" || newStatus === "pemberkasan") {
        unitState = "booking";
      }

      const currentUnit = await tx.select().from(units).where(eq(units.id, booking.unitId)).get();
      if (currentUnit && currentUnit.status !== unitState) {
        const unitUpdate: Partial<typeof units.$inferInsert> = {
          status: unitState,
          updatedAt: new Date(),
        };
        if (newStatus === "rejected") {
          unitUpdate.currentCustomerId = null;
          unitUpdate.currentBookingId = null;
        } else {
          unitUpdate.currentCustomerId = booking.customerId;
          unitUpdate.currentBookingId = booking.id;
        }
        await tx.update(units).set(unitUpdate).where(eq(units.id, booking.unitId)).run();

        await tx.insert(unitStatusHistories).values({
          id: crypto.randomUUID(),
          unitId: booking.unitId,
          previousStatus: currentUnit.status,
          newStatus: unitState,
          reason: `Progress status KPR (Kanban): ${newStatus}`,
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
    details: { step: newStatus, source: "kanban_drag" },
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
// BAST KONSUMEN � APPROVE SERAH TERIMA (RULE 11, 12, 13)
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
      "Serah terima tidak dapat dilakukan. Booking belum berstatus completed (akad kredit belum selesai)."
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
      "Silakan unggah BAST terlebih dahulu di tab Berkas Konsumen."
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
  // "sold" no longer accepted � unit must go through the proper menunggu_serah_terima gate
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

    // If approved bank submission, update KPR status automatically
    if (parsed.status === "approved" || parsed.status === "offering") {
      await tx.update(kprProcesses).set({
        status: parsed.status === "offering" ? "offering" : "approved",
        updatedAt: new Date(),
      }).where(eq(kprProcesses.id, parsed.kprProcessId)).run();
    }
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
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(bankSubmissions).where(eq(bankSubmissions.id, id)).get();
    if (!existing) throw new Error("Pengajuan bank tidak ditemukan.");

    await tx.update(bankSubmissions).set({
      status: data.status,
      plafondAmount: data.plafondAmount !== undefined ? data.plafondAmount : existing.plafondAmount,
      interestRate: data.interestRate !== undefined ? data.interestRate : existing.interestRate,
      tenorYear: data.tenorYear !== undefined ? data.tenorYear : existing.tenorYear,
      rejectionReason: data.rejectionReason !== undefined ? data.rejectionReason : existing.rejectionReason,
    }).where(eq(bankSubmissions.id, id)).run();

    // Automatically transition the KPR process status if needed!
    const kpr = await tx.select().from(kprProcesses).where(eq(kprProcesses.id, existing.kprProcessId)).get();
    if (kpr) {
      if (data.status === "approved" && kpr.status !== "akad" && kpr.status !== "approved") {
        await tx.update(kprProcesses).set({
          status: "approved",
          updatedAt: new Date(),
        }).where(eq(kprProcesses.id, existing.kprProcessId)).run();
      } else if (data.status === "offering" && kpr.status !== "akad" && kpr.status !== "approved" && kpr.status !== "offering") {
        await tx.update(kprProcesses).set({
          status: "offering",
          updatedAt: new Date(),
        }).where(eq(kprProcesses.id, existing.kprProcessId)).run();
      }
    }
  });

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: id,
    entityType: "bank_submission",
    details: { status: data.status },
  });

  revalidatePath("/marketing/kpr");
  return { success: true };
}

export async function deleteBankSubmission(id: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(bankSubmissions).where(eq(bankSubmissions.id, id)).get();
    if (!existing) throw new Error("Pengajuan bank tidak ditemukan.");

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
  paymentType?: "booking_fee" | "dp"
) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) throw new Error("Booking tidak ditemukan.");
  if (booking.status === "cancelled") throw new Error("Booking sudah dibatalkan.");

  const attachmentId = crypto.randomUUID();
  await db.insert(attachments).values({
    id: attachmentId,
    entityId: bookingId,
    entityType: paymentType === "dp" ? "booking_dp" : "booking_bf",
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

  // Find unpaid invoices for this booking matching the specific type
  const unpaidInvoices = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.bookingId, bookingId),
        eq(invoices.status, "unpaid"),
        eq(invoices.type, paymentType || "booking_fee")
      )
    )
    .orderBy(desc(invoices.createdAt));

  // If there is an unpaid invoice, create a payment record in the payments table linked to that invoice!
  if (unpaidInvoices.length > 0) {
    const targetInvoice = unpaidInvoices[0];
    const paymentId = crypto.randomUUID();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    const paymentNumber = `PAY-AUTO-${dateStr}-${rand}`;

    await db.insert(payments).values({
      id: paymentId,
      invoiceId: targetInvoice.id,
      paymentNumber,
      projectId: booking.projectId,
      unitId: booking.unitId,
      customerId: booking.customerId,
      amount: targetInvoice.amount,
      paymentDate: new Date(),
      paymentMethod: "transfer",
      proofAttachmentId: attachmentId,
      status: "pending",
    });

    // Notify Admin Keuangan and Super Admin about new payment verification
    await notifyUsersWithRoles({
      roleNames: ["Admin Keuangan", "Super Admin"],
      type: "approval_pending",
      title: "Verifikasi Pembayaran Baru",
      message: `Pembayaran baru senilai Rp ${targetInvoice.amount.toLocaleString("id-ID")} dari konsumen memerlukan verifikasi keuangan.`,
      entityId: paymentId,
      entityType: "payment",
    });
  }

  revalidatePath(`/marketing/bookings/${bookingId}`);
  revalidatePath("/marketing/bookings");
  revalidatePath("/finance/payments");
  return { success: true, attachmentId };
}

export async function upgradeBookingToAkad(bookingId: string) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor"]);
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) throw new Error("Booking tidak ditemukan.");
  if (booking.status !== "active") throw new Error("Hanya booking aktif yang bisa diproses ke Akad.");

  const [unit] = await db.select().from(units).where(eq(units.id, booking.unitId));
  if (!unit) throw new Error("Unit tidak ditemukan.");
  if (unit.isReadyStock && (unit.constructionProgress || 0) < 100) {
    throw new Error("Unit Ready Stock belum selesai dibangun (Progress < 100%). Selesaikan pembangunan fisik di modul Produksi sebelum lanjut ke proses Akad Jual Beli.");
  }

  await db.transaction(async (tx) => {
    await tx.update(bookings).set({ status: "akad", updatedAt: new Date() }).where(eq(bookings.id, bookingId)).run();
    // Do NOT set unit to "sold" yet � unit stays at current status.
    // For non-KPR: unit reaches "menunggu_serah_terima" via triggerMenungguSerahTerima
    // after all invoices paid. For KPR: via realizeKprFunds.
    // Final "handover_complete" only via approveBastKonsumen.
    await tx.update(units).set({
      currentCustomerId: booking.customerId,
      currentBookingId: bookingId,
      updatedAt: new Date()
    }).where(eq(units.id, booking.unitId)).run();
    await tx.update(customers).set({ status: "buyer", updatedAt: new Date() }).where(eq(customers.id, booking.customerId)).run();
    await tx.insert(bookingStatusHistories).values({
      id: crypto.randomUUID(),
      bookingId,
      previousStatus: "active",
      newStatus: "akad",
      notes: "Proses Akad dimulai",
      changedBy: user.id,
      changedAt: new Date(),
    }).run();
  });

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: bookingId,
    entityType: "booking",
    details: { action: "upgrade_to_akad" },
  });

  revalidatePath(`/marketing/bookings/${bookingId}`);
  revalidatePath("/marketing/bookings");
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
    documentType: "ktp" | "npwp" | "slip_gaji" | "kk" | "spjb" | "kpr_doc" | "other";
    fileName: string;
    fileUrl: string;
    mimeType: string;
    fileSize: number;
    notes?: string;
  }
) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager", "Admin Keuangan"]);

  // Check if a document of this type already exists for this customer (excluding 'other')
  if (data.documentType !== "other") {
    const [existing] = await db
      .select()
      .from(customerDocuments)
      .where(
        and(
          eq(customerDocuments.customerId, data.customerId),
          eq(customerDocuments.documentType, data.documentType)
        )
      )
      .limit(1);

    if (existing) {
      const typeLabels: Record<string, string> = {
        ktp: "KTP",
        npwp: "NPWP",
        slip_gaji: "Slip Gaji",
        kk: "Kartu Keluarga",
        spjb: "SPJB",
        kpr_doc: "Dokumen KPR",
      };
      throw new Error(`Dokumen ${typeLabels[data.documentType] || data.documentType.toUpperCase()} sudah pernah diunggah untuk konsumen ini.`);
    }
  }

  // 1. Create attachment record
  const attachmentId = crypto.randomUUID();
  await db.insert(attachments).values({
    id: attachmentId,
    entityType: "customer_document",
    entityId: data.customerId,
    fileName: data.fileName,
    fileUrl: data.fileUrl,
    mimeType: data.mimeType,
    fileSize: data.fileSize,
    uploadedBy: user.id,
  });

  // 2. Create customer document record
  const docId = crypto.randomUUID();
  await db.insert(customerDocuments).values({
    id: docId,
    customerId: data.customerId,
    bookingId: data.bookingId || null,
    attachmentId,
    documentType: data.documentType,
    status: "uploaded",
    notes: data.notes || null,
    uploadedBy: user.id,
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

  // Send pending approval notification when all 4 mandatory files (ktp, npwp, slip_gaji, kk) are uploaded
  try {
    const existingDocs = await db.select().from(customerDocuments).where(eq(customerDocuments.customerId, data.customerId));
    const uploadedTypes = new Set<string>(existingDocs.map(d => d.documentType));
    uploadedTypes.add(data.documentType);

    const isMandatoryComplete = ["ktp", "npwp", "slip_gaji", "kk"].every(type => uploadedTypes.has(type));
    if (isMandatoryComplete) {
      const customer = await db.select().from(customers).where(eq(customers.id, data.customerId)).get();
      const customerName = customer?.name || "Konsumen";

      await notifyUsersWithRoles({
        roleNames: ["Super Admin", "Admin Kantor", "Admin Keuangan", "Direksi / Manager"],
        type: "approval_pending",
        title: "Pengecekan Berkas KPR Konsumen",
        message: `Seluruh berkas persyaratan KPR konsumen ${customerName} telah lengkap diunggah. Silakan lakukan pemeriksaan dan verifikasi berkas!`,
        entityId: data.bookingId || undefined,
        entityType: "booking",
      });
    }
  } catch (err) {
    console.warn("Failed to trigger mandatory document upload notification:", err);
  }

  return { success: true, id: docId, attachmentId };
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

  await db.transaction(async (tx) => {
    await tx.update(customerDocuments)
      .set({ status, notes: notes || null })
      .where(eq(customerDocuments.id, docId))
      .run();

    const docRecord = await tx.select().from(customerDocuments).where(eq(customerDocuments.id, docId)).get();
    if (docRecord) {
      await syncKprDocumentStatus(tx, docRecord.customerId, docRecord.bookingId);

      // Write document verification log to Booking Status History
      if (docRecord.bookingId) {
        const typeLabels: Record<string, string> = {
          ktp: "KTP",
          npwp: "NPWP",
          slip_gaji: "Slip Gaji",
          kk: "Kartu Keluarga",
          spjb: "SPJB",
          kpr_doc: "Dokumen KPR",
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
    }
  });

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: docId,
    entityType: "customer_document",
    details: { status, notes },
  });

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
          spjb: "SPJB",
          kpr_doc: "Dokumen KPR",
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
  if (unit.isReadyStock) {
    return;
  }

  // If unit is already in construction or sold status, do nothing
  if (["construction", "construction_done", "sold", "overdue"].includes(unit.status)) {
    return;
  }

  // Find invoices
  const bookingInvoices = await tx.select().from(invoices).where(eq(invoices.bookingId, bookingId)).all();

  // Booking fee must exist AND be paid (not absent)
  // If BF invoice was never created (bookingFee = 0), treat as not paid � require explicit payment
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
      reason: `Otomatis: Pembayaran DP Lunas & Analisis KPR disetujui (Skema: ${booking.paymentScheme === "kpr" ? "KPR" : booking.paymentScheme})`,
      changedBy: userId,
      changedAt: new Date(),
    }).run();

    // Create notification for the triggering user
    await createNotification({
      userId: userId,
      type: "info",
      title: "??? Unit Siap Pembangunan Fisik",
      message: `Unit ${unit.code} telah memenuhi seluruh syarat (Booking Fee & DP Lunas${booking.paymentScheme === "kpr" ? " � KPR Disetujui" : ""}). Status otomatis berubah menjadi Pembangunan Fisik. Silakan terbitkan SPK.`,
      entityId: unit.projectId,
      entityType: "unit_construction_ready",
    });

    // Broadcast to all authorized roles who can trigger manual construction start
    await notifyUsersWithRoles({
      roleNames: ["Super Admin", "Admin Kantor", "Marketing Manager"],
      type: "info",
      title: "??? Kavling Siap Dibangun",
      message: `Unit ${unit.code} telah memenuhi seluruh syarat pembangunan (Booking Fee & DP Lunas${booking.paymentScheme === "kpr" ? " � KPR Disetujui" : ""}). Buka Site Plan untuk menerbitkan SPK Konstruksi.`,
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

    if (!unit.currentBookingId) {
      throw new Error("Unit tidak memiliki data booking aktif.");
    }

    const booking = await tx.select().from(bookings).where(eq(bookings.id, unit.currentBookingId)).get();
    if (!booking) throw new Error("Data booking tidak ditemukan.");

    if (["construction", "construction_done", "sold", "overdue"].includes(unit.status)) {
      throw new Error("Unit sudah berada dalam tahap pembangunan fisik atau telah terjual.");
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
      reason: `Manual: Memulai pembangunan fisik (Skema: ${booking.paymentScheme === "kpr" ? "KPR" : booking.paymentScheme})`,
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
    .select({ id: attachments.id, entityType: attachments.entityType })
    .from(attachments)
    .where(eq(attachments.id, parsed.realizedAttachmentId))
    .get();
  if (!attachment) throw new Error("File memo pencairan tidak ditemukan. Silakan unggah ulang.");
  if (attachment.entityType !== "kpr_realization_memo") {
    throw new Error("File yang diunggah bukan bertipe memo pencairan KPR. Silakan unggah file yang benar.");
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
        reason: "Realisasi dana KPR dari bank partner � unit siap diserahterimakan",
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
      description: `Realisasi bersih dana KPR Unit ${unit.code} � ${account.name}`,
      amount: netReceived,
      transactionDate: parsed.realizedDate,
      paymentMethod: "transfer",
      approvalStatus: "not_required",
      attachmentId: parsed.realizedAttachmentId,
      createdBy: activeUser.id,
    }).run();
  });

  // 6. Audit Log
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

  // 7. Notifikasi Multi-Role
  try {
    await notifyUsersWithRoles({
      roleNames: ["Super Admin", "Admin Keuangan", "Direksi / Manager", "Admin Kantor", "Marketing Manager"],
      type: "handover_waiting",
      title: "Dana KPR Terealisasi � Unit Siap Serah Terima",
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



