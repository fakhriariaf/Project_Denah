"use server";

import { db } from "@/db";
import {
  invoices,
  payments,
  transactions,
  transactionApprovals,
  budgets,
  budgetLines,
} from "@/db/schema/finance";
import {
  financeAccounts,
  financeCategories,
  units,
  customers,
  projects,
  unitStatusHistories,
} from "@/db/schema/master";
import { user as userTable } from "@/db/schema/auth";
import { bookings } from "@/db/schema/marketing";
import { checkAndTransitionToConstruction } from "./marketing";
import { attachments, notifications } from "@/db/schema/system";
import { getCurrentUser, requireAuth, hasRole, getSessionRole } from "@/server/permissions";
import { eq, and, desc, sum, sql, inArray, lte, isNotNull, gte, count, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cachedQuery } from "@/lib/cache";
import { calculateOffset, validatePaginationParams, type PaginatedResult } from "@/lib/pagination";
import { writeAuditLog } from "./audit";
import { createNotification, notifyUsersWithRoles } from "./notification";
import { applyRateLimit } from "@/server/middleware/apply-rate-limit";
import {
  invoiceSchema,
  paymentSchema,
  expenseRequestSchema,
  budgetSchema,
} from "../validators/finance";

// ==========================================
// UTILITY: Compute Real Account Balance
// ==========================================
/**
 * Computes the real current balance of a finance account.
 * openingBalance = immutable seed balance (never mutated after creation).
 * currentBalance = openingBalance + sum(verified income) - sum(approved expenses)
 */
export async function computeCurrentBalance(accountId: string): Promise<number> {
  const [account] = await db
    .select({ openingBalance: financeAccounts.openingBalance })
    .from(financeAccounts)
    .where(eq(financeAccounts.id, accountId))
    .limit(1);

  if (!account) throw new Error("Akun kas/bank tidak ditemukan");

  const [incResult] = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(and(
      eq(transactions.accountId, accountId),
      eq(transactions.type, "income"),
      // BUG 5 AUDIT: All income inserts use approvalStatus = "not_required" by design.
      // Payment verifications (verifyPayment) and KPR realizations (realizeKpr) both set
      // approvalStatus = "not_required" for income transactions. This filter is intentional
      // and consistent with all income insert paths in finance.ts and marketing.ts.
      eq(transactions.approvalStatus, "not_required")
    ));

  const [expResult] = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(and(
      eq(transactions.accountId, accountId),
      eq(transactions.type, "expense"),
      eq(transactions.approvalStatus, "approved")
    ));

  return account.openingBalance + Number(incResult?.total ?? 0) - Number(expResult?.total ?? 0);
}

// ==========================================
// 1. INVOICES SERVICE LAYER
// ==========================================

export async function getInvoices(projectId?: string) {
  await requireAuth();

  const query = db
    .select({
      invoice: invoices,
      project: projects,
      unit: units,
      customer: customers,
      booking: bookings,
    })
    .from(invoices)
    .innerJoin(projects, eq(invoices.projectId, projects.id))
    .leftJoin(units, eq(invoices.unitId, units.id))
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(bookings, eq(invoices.bookingId, bookings.id))
    .orderBy(desc(invoices.createdAt));

  if (projectId) {
    return query.where(eq(invoices.projectId, projectId));
  }

  return query;
}

export async function getInvoice(invoiceId: string) {
  await requireAuth();

  const results = await db
    .select({
      invoice: invoices,
      project: projects,
      unit: units,
      customer: customers,
      booking: bookings,
    })
    .from(invoices)
    .innerJoin(projects, eq(invoices.projectId, projects.id))
    .leftJoin(units, eq(invoices.unitId, units.id))
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(bookings, eq(invoices.bookingId, bookings.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (results.length === 0) return null;

  const invoicePayments = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(desc(payments.createdAt));

  return {
    ...results[0],
    payments: invoicePayments,
  };
}

export async function createInvoice(data: unknown) {
  const activeUser = await requireAuth();
  applyRateLimit(activeUser.id);
  const parsed = invoiceSchema.parse(data);

  const invoiceId = crypto.randomUUID();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const invoiceNumber = `INV-${dateStr}-${rand}`;

  await db.insert(invoices).values({
    id: invoiceId,
    invoiceNumber,
    projectId: parsed.projectId,
    unitId: parsed.unitId || null,
    customerId: parsed.customerId || null,
    bookingId: parsed.bookingId || null,
    type: parsed.type,
    amount: parsed.amount,
    dueDate: parsed.dueDate || null,
    status: "unpaid",
    notes: parsed.notes || null,
  });

  await writeAuditLog({
    action: "create",
    module: "finance",
    entityId: invoiceId,
    entityType: "invoice",
    details: { invoiceNumber, amount: parsed.amount, type: parsed.type },
  });

  revalidatePath("/finance/payments");
  return { success: true, invoiceId };
}

// ==========================================
// 2. PAYMENTS SERVICE LAYER
// ==========================================

export async function getPayments(projectId?: string) {
  await requireAuth();

  const query = db
    .select({
      payment: payments,
      invoice: invoices,
      project: projects,
      unit: units,
      customer: customers,
    })
    .from(payments)
    .innerJoin(projects, eq(payments.projectId, projects.id))
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .leftJoin(units, eq(payments.unitId, units.id))
    .leftJoin(customers, eq(payments.customerId, customers.id))
    .orderBy(desc(payments.createdAt));

  if (projectId) {
    return query.where(eq(payments.projectId, projectId));
  }

  return query;
}

export async function createPayment(data: unknown) {
  const activeUser = await requireAuth();
  applyRateLimit(activeUser.id);
  const parsed = paymentSchema.parse(data);

  const paymentId = crypto.randomUUID();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const paymentNumber = `PAY-${dateStr}-${rand}`;

  await db.insert(payments).values({
    id: paymentId,
    invoiceId: parsed.invoiceId || null,
    paymentNumber,
    projectId: parsed.projectId,
    unitId: parsed.unitId || null,
    customerId: parsed.customerId || null,
    amount: parsed.amount,
    paymentDate: parsed.paymentDate,
    paymentMethod: parsed.paymentMethod,
    proofAttachmentId: parsed.proofAttachmentId || null,
    status: "pending",
  });

  await writeAuditLog({
    action: "create",
    module: "finance",
    entityId: paymentId,
    entityType: "payment",
    details: { paymentNumber, amount: parsed.amount },
  });

  // Notify Admin Keuangan and Super Admin about new payment verification
  await notifyUsersWithRoles({
    roleNames: ["Admin Keuangan", "Super Admin"],
    type: "approval_pending",
    title: "Verifikasi Pembayaran Baru",
    message: `Pembayaran baru senilai Rp ${parsed.amount.toLocaleString()} dari konsumen memerlukan verifikasi keuangan.`,
    entityId: paymentId,
    entityType: "payment",
  });

  revalidatePath("/finance/payments");
  revalidatePath("/dashboard");
  return { success: true, paymentId };
}

export async function verifyPayment(
  paymentId: string,
  isApproved: boolean,
  accountId: string,
  notes?: string
) {
  const activeUser = await requireAuth();

  // Validate authorization role: Keuangan, Direksi, or Super Admin
  const { isKeuangan: isFinance, isDireksi: isDirector, isSuperAdmin: isSuper } = await getSessionRole(activeUser.id);

  if (!isFinance && !isDirector && !isSuper) {
    throw new Error("Anda tidak memiliki akses untuk verifikasi pembayaran.");
  }

  let paymentNumber = "";
  let paymentAmount = 0;
  let shouldTransition = false;
  let bookingIdToTransition = "";
  // Sprint 2: Cash/Installment handover trigger
  let shouldTriggerHandoverWait = false;
  let handoverWaitUnitId = "";
  let handoverWaitBookingId = "";

  await db.transaction(async (tx) => {
    // 1. Get Payment details
    const paymentResults = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1)
      .all();

    if (paymentResults.length === 0) {
      throw new Error("Pembayaran tidak ditemukan");
    }

    const payment = paymentResults[0];
    paymentNumber = payment.paymentNumber;
    paymentAmount = payment.amount;
    if (payment.status !== "pending") {
      throw new Error("Pembayaran ini sudah diverifikasi sebelumnya");
    }

    const newStatus = isApproved ? "verified" : "rejected";

    // 2. Update payment status
    await tx
      .update(payments)
      .set({
        status: newStatus,
        verifiedBy: activeUser.id,
        verifiedAt: new Date(),
      })
      .where(eq(payments.id, paymentId))
      .run();

    if (isApproved) {
      // 3. Find target Account & check existence
      const accountResults = await tx
        .select()
        .from(financeAccounts)
        .where(eq(financeAccounts.id, accountId))
        .limit(1)
        .all();

      if (accountResults.length === 0) {
        throw new Error("Akun penampung kas tidak valid");
      }

      // 4. Find/Select target Finance Category for income
      const categoryResults = await tx
        .select()
        .from(financeCategories)
        .where(
          and(
            eq(financeCategories.type, "income"),
            sql`lower(${financeCategories.name}) LIKE '%pemasukan%' OR lower(${financeCategories.name}) LIKE '%booking%' OR lower(${financeCategories.name}) LIKE '%kpr%' OR lower(${financeCategories.name}) LIKE '%dp%'`
          )
        )
        .limit(1)
        .all();

      let categoryId = "";
      if (categoryResults.length > 0) {
        categoryId = categoryResults[0].id;
      } else {
        const fallbackResults = await tx
          .select()
          .from(financeCategories)
          .where(eq(financeCategories.type, "income"))
          .limit(1)
          .all();
        if (fallbackResults.length === 0) {
          throw new Error(
            "Kategori keuangan pemasukan belum dikonfigurasi. Harap buat kategori pemasukan di menu Master dahulu."
          );
        }
        categoryId = fallbackResults[0].id;
      }

      // 5. Generate Ledger Transaction record
      const trxId = crypto.randomUUID();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
      const transactionNumber = `TRX-IN-${dateStr}-${rand}`;

      await tx.insert(transactions).values({
        id: trxId,
        transactionNumber,
        projectId: payment.projectId,
        unitId: payment.unitId,
        customerId: payment.customerId,
        paymentId: payment.id,
        accountId: accountId,
        categoryId: categoryId,
        type: "income",
        description: `Pemasukan terverifikasi dari ${payment.paymentNumber} (${payment.paymentMethod})`,
        amount: payment.amount,
        transactionDate: new Date(),
        paymentMethod: payment.paymentMethod,
        approvalStatus: "not_required",
        attachmentId: payment.proofAttachmentId,
        createdBy: activeUser.id,
      }).run();

      // 6. Balance updated implicitly via the verified income transaction record.
      // currentBalance = openingBalance + sum(verified income) - sum(approved expenses)
      // No mutation of financeAccounts.openingBalance needed.

      // 7. Recalculate Invoice totals
      if (payment.invoiceId) {
        const invoiceResults = await tx
          .select()
          .from(invoices)
          .where(eq(invoices.id, payment.invoiceId))
          .limit(1)
          .all();

        if (invoiceResults.length > 0) {
          const invoice = invoiceResults[0];

          // Fetch sum of all verified payments for this invoice
          const sumPayments = await tx
            .select({ total: sum(payments.amount) })
            .from(payments)
            .where(
              and(
                eq(payments.invoiceId, payment.invoiceId),
                eq(payments.status, "verified")
              )
            )
            .all();

          const paidTotal = Number(sumPayments[0]?.total || 0);

          let newInvoiceStatus: "unpaid" | "partial" | "paid" = "unpaid";
          if (paidTotal >= invoice.amount) {
            newInvoiceStatus = "paid";
          } else if (paidTotal > 0) {
            newInvoiceStatus = "partial";
          }

          await tx
            .update(invoices)
            .set({
              status: newInvoiceStatus,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, payment.invoiceId))
            .run();

          if (newInvoiceStatus === "paid" && invoice.bookingId) {
            shouldTransition = true;
            bookingIdToTransition = invoice.bookingId;

            // ── Sprint 2: Cash/Installment lunas → menunggu_serah_terima ──
            // Check 5 conditions from Decision Record (2026-05-30)
            const bookingData = await tx
              .select({
                paymentScheme: bookings.paymentScheme,
                status: bookings.status,
                unitId: bookings.unitId,
              })
              .from(bookings)
              .where(eq(bookings.id, invoice.bookingId))
              .get();

            // Condition 1: paymentScheme ≠ kpr (KPR has its own path via realisasi)
            // Condition 2: booking.status ∈ {akad, completed}
            if (
              bookingData &&
              bookingData.paymentScheme !== "kpr" &&
              (bookingData.status === "akad" || bookingData.status === "completed") &&
              bookingData.unitId
            ) {
              // Condition 3: all invoices for this booking must be paid
              const unpaidInvoices = await tx
                .select({ id: invoices.id })
                .from(invoices)
                .where(
                  and(
                    eq(invoices.bookingId, invoice.bookingId),
                    inArray(invoices.status, ["unpaid", "partial"])
                  )
                )
                .all();

              if (unpaidInvoices.length === 0) {
                // Condition 4 & 5: unit not already in terminal handover status
                const unitData = await tx
                  .select({ status: units.status })
                  .from(units)
                  .where(eq(units.id, bookingData.unitId))
                  .get();

                if (
                  unitData &&
                  unitData.status !== "menunggu_serah_terima" &&
                  unitData.status !== "handover_complete"
                ) {
                  shouldTriggerHandoverWait = true;
                  handoverWaitUnitId = bookingData.unitId;
                  handoverWaitBookingId = invoice.bookingId;
                }
              }
            } else if (
              bookingData &&
              bookingData.paymentScheme !== "kpr" &&
              bookingData.status === "active"
            ) {
              // Anomaly: all invoices paid but booking still active — log and skip
              console.warn(
                `[verifyPayment] Anomali data: booking ${invoice.bookingId} (${bookingData.paymentScheme}) ` +
                `memiliki semua invoice lunas tetapi status masih 'active'. ` +
                `Auto-transition ke menunggu_serah_terima dibatalkan. Perlu investigasi.`
              );
            }
          }
        }
      }
    }
  });

  // Run transition outside transaction to avoid returning a promise from SQLite transaction
  if (shouldTransition && bookingIdToTransition) {
    await checkAndTransitionToConstruction(db, bookingIdToTransition, activeUser.id);
  }

  // Sprint 2: Cash/Installment lunas → menunggu_serah_terima
  if (shouldTriggerHandoverWait && handoverWaitUnitId && handoverWaitBookingId) {
    await triggerMenungguSerahTerima(handoverWaitUnitId, handoverWaitBookingId, activeUser.id);
  }

  // 8. Log activities outside transaction
  const newStatus = isApproved ? "verified" : "rejected";
  await writeAuditLog({
    action: isApproved ? "approve" : "reject",
    module: "finance",
    entityId: paymentId,
    entityType: "payment",
    details: {
      paymentNumber: paymentNumber,
      status: newStatus,
      notes: notes || null,
    },
  });

  // Find related booking and marketing PIC to send a targeted notification
  // BUG 2 FIX: Use single JOIN query instead of 3 chained N+1 queries post-transaction
  let marketingPicId: string | null = null;
  let unitCodeStr = "";
  let bookingNumStr = "";

  try {
    const notifData = await db
      .select({
        marketingId: bookings.marketingId,
        bookingNumber: bookings.bookingNumber,
        unitCode: units.code,
      })
      .from(payments)
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .leftJoin(bookings, eq(invoices.bookingId, bookings.id))
      .leftJoin(units, eq(invoices.unitId, units.id))
      .where(eq(payments.id, paymentId))
      .limit(1)
      .then((res) => res[0]);

    if (notifData) {
      marketingPicId = notifData.marketingId ?? null;
      bookingNumStr = notifData.bookingNumber ?? "";
      unitCodeStr = notifData.unitCode ?? "";
    }
  } catch (err) {
    console.error("[verifyPayment] Gagal mengambil data booking untuk notifikasi:", err);
  }

  // 1. Send targeted notification to the Marketing PIC who made the booking
  if (marketingPicId) {
    await createNotification({
      userId: marketingPicId,
      type: "info",
      title: isApproved ? "Pembayaran Booking Disetujui" : "Pembayaran Booking Ditolak",
      message: `Pembayaran ${paymentNumber} senilai Rp ${paymentAmount.toLocaleString("id-ID")} untuk Unit ${unitCodeStr || "kavling"} (Booking: ${bookingNumStr || "—"}) telah ${isApproved ? "disetujui" : "ditolak"} oleh Admin Keuangan.`,
      entityId: paymentId,
      entityType: "payment",
    });
  }

  // 2. Broadcast notification to Super Admin and Marketing Manager
  await notifyUsersWithRoles({
    roleNames: ["Super Admin", "Marketing Manager"],
    type: "info",
    title: isApproved ? "Pembayaran Diverifikasi" : "Pembayaran Ditolak",
    message: `Pembayaran ${paymentNumber} senilai Rp ${paymentAmount.toLocaleString("id-ID")} telah ${isApproved ? "diverifikasi sukses" : "ditolak"}.`,
    entityId: paymentId,
    entityType: "payment",
  });

  revalidatePath("/finance/payments");
  revalidatePath("/finance/transactions");
  revalidatePath("/dashboard");
  // Sprint 3: Return structured response so UI can show handover feedback
  return {
    success: true,
    handoverTriggered: shouldTriggerHandoverWait,
    unitId: shouldTriggerHandoverWait ? handoverWaitUnitId : null,
    unitCode: null, // resolved inside triggerMenungguSerahTerima — not accessible here
    bookingId: shouldTriggerHandoverWait ? handoverWaitBookingId : null,
    newUnitStatus: shouldTriggerHandoverWait ? "menunggu_serah_terima" : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPER: Cash/Installment Lunas → menunggu_serah_terima (Sprint 2)
// Dipanggil dari verifyPayment() saat semua 5 kondisi terpenuhi.
// Tidak diexport — hanya untuk internal finance module use.
// ─────────────────────────────────────────────────────────────────────────────
async function triggerMenungguSerahTerima(
  unitId: string,
  bookingId: string,
  changedById: string
) {
  const unit = await db
    .select({ id: units.id, code: units.code, status: units.status, isReadyStock: units.isReadyStock, constructionProgress: units.constructionProgress, currentSpkId: units.currentSpkId })
    .from(units)
    .where(eq(units.id, unitId))
    .get();
  if (!unit) return;

  // For non-ready-stock (indent) units: physical construction must be 100% complete
  if (!unit.isReadyStock && unit.constructionProgress < 100) {
    console.warn(
      `[triggerMenungguSerahTerima] Skip: unit ${unit.code} (indent) constructionProgress=${unit.constructionProgress}% < 100%. ` +
      `Pembayaran lunas tapi fisik belum selesai. Status tidak diubah.`
    );
    return;
  }

  // For indent units: SPK must also be officially completed (BAST Vendor uploaded)
  // This ensures the vendor → developer handover is formally closed before consumer handover
  if (!unit.isReadyStock && unit.currentSpkId) {
    const { spks } = await import("@/db/schema/production");
    const activeSpk = await db
      .select({ status: spks.status })
      .from(spks)
      .where(eq(spks.id, unit.currentSpkId))
      .get();

    // Only block if SPK is still in active/in-progress state (not yet completed)
    const SPK_NOT_DONE_STATUSES = ["active", "proses_konstruksi", "overdue"];
    if (activeSpk && SPK_NOT_DONE_STATUSES.includes(activeSpk.status)) {
      console.warn(
        `[triggerMenungguSerahTerima] Skip: unit ${unit.code} (indent) SPK status=${activeSpk.status}. ` +
        `SPK belum diselesaikan (BAST Vendor belum diupload). Status tidak diubah ke menunggu_serah_terima.`
      );
      return;
    }
  }

  const booking = await db
    .select({
      paymentScheme: bookings.paymentScheme,
      marketingId: bookings.marketingId,
      projectId: bookings.projectId,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .get();

  const oldStatus = unit.status;
  const schemeLabel = booking?.paymentScheme === "cash" ? "Cash" : "Installment";

  // Update unit status + history (in transaction)
  await db.transaction(async (tx) => {
    await tx.update(units).set({
      status: "menunggu_serah_terima",
      updatedAt: new Date(),
    }).where(eq(units.id, unitId)).run();

    await tx.insert(unitStatusHistories).values({
      id: crypto.randomUUID(),
      unitId,
      previousStatus: oldStatus,
      newStatus: "menunggu_serah_terima",
      reason: `Seluruh invoice ${schemeLabel} telah lunas — unit menunggu serah terima fisik kepada konsumen`,
      changedBy: changedById,
      changedAt: new Date(),
    }).run();
  });

  // Audit log
  await writeAuditLog({
    action: "update",
    module: "finance",
    entityId: unitId,
    entityType: "unit_handover_wait",
    details: {
      unitCode: unit.code,
      bookingId,
      oldStatus,
      newStatus: "menunggu_serah_terima",
      trigger: `${schemeLabel} invoice paid_full`,
    },
  });

  // Notifikasi ke role berwenang
  // Sprint 3: Gunakan type "handover_waiting" (bukan "info") agar routing notifikasi eksplisit
  // entityType "unit_handover_wait" + entityId bookingId → redirect ke /marketing/bookings/[id]
  try {
    await notifyUsersWithRoles({
      roleNames: ["Super Admin", "Admin Kantor", "Direksi / Manager", "Marketing Manager"],
      type: "handover_waiting",
      title: "Unit Siap Serah Terima",
      message: `Unit ${unit.code} — seluruh pembayaran ${schemeLabel} telah lunas. Unit siap untuk diserahterimakan kepada konsumen.`,
      entityId: bookingId,  // bookingId utk deep link ke /marketing/bookings/[id]
      entityType: "unit_handover_wait",
    });

    if (booking?.marketingId) {
      await createNotification({
        userId: booking.marketingId,
        type: "handover_waiting",
        title: "Unit Siap Serah Terima",
        message: `Unit ${unit.code} yang Anda tangani telah lunas dan siap diserahterimakan.`,
        entityId: bookingId,  // bookingId utk deep link ke /marketing/bookings/[id]
        entityType: "unit_handover_wait",
      });
    }
  } catch (err) {
    console.warn("[triggerMenungguSerahTerima] Gagal mengirim notifikasi:", err);
  }

  revalidatePath("/finance/payments");
  revalidatePath("/master/units");
  if (booking?.projectId) {
    revalidatePath(`/siteplan/${booking.projectId}`);
  }
  revalidatePath("/siteplan");
}

export async function deletePayment(paymentId: string) {
  const activeUser = await requireAuth();

  // Validate authorization role: Super Admin only
  const { isSuperAdmin } = await getSessionRole(activeUser.id);
  if (!isSuperAdmin) {
    throw new Error("Hanya Super Admin yang dapat menghapus pembayaran.");
  }

  // Fetch payment details first
  const paymentResults = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (paymentResults.length === 0) {
    throw new Error("Pembayaran tidak ditemukan");
  }

  const payment = paymentResults[0];

  // Delete the payment record
  await db.delete(payments).where(eq(payments.id, paymentId));

  // Write audit log
  await writeAuditLog({
    action: "delete",
    module: "finance",
    entityId: paymentId,
    entityType: "payment",
    details: {
      paymentNumber: payment.paymentNumber,
      amount: payment.amount,
    },
  });

  revalidatePath("/finance");
  revalidatePath("/finance/transactions");
  return { success: true };
}

// ==========================================
// 3. TRANSACTIONS / EXPENSE SERVICE LAYER
// ==========================================

export async function getTransactions(projectId?: string) {
  await requireAuth();

  const query = db
    .select({
      transaction: transactions,
      project: projects,
      account: financeAccounts,
      category: financeCategories,
      unit: units,
      customer: customers,
    })
    .from(transactions)
    .innerJoin(projects, eq(transactions.projectId, projects.id))
    .innerJoin(financeAccounts, eq(transactions.accountId, financeAccounts.id))
    .innerJoin(
      financeCategories,
      eq(transactions.categoryId, financeCategories.id)
    )
    .leftJoin(units, eq(transactions.unitId, units.id))
    .leftJoin(customers, eq(transactions.customerId, customers.id))
    .orderBy(desc(transactions.createdAt));

  if (projectId) {
    return query.where(eq(transactions.projectId, projectId));
  }

  return query;
}

/**
 * TransactionListItem — shape returned by server-side paginated transactions query.
 * Only includes columns needed for table display + filtering.
 */
export interface TransactionListItem {
  id: string;
  transactionNumber: string;
  projectId: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  transactionDate: Date;
  paymentMethod: "cash" | "transfer" | "giro" | "other";
  approvalStatus: "not_required" | "pending" | "approved" | "rejected" | "insufficient_balance";
  createdAt: Date;
  projectName: string;
  accountName: string;
  categoryName: string;
  categoryId: string;
  unitCode: string | null;
  customerName: string | null;
}

/**
 * Server-side paginated + filtered transactions query.
 * Eliminates N+1 by using JOINs and returns only the columns needed for the list view.
 */
export async function getTransactionsPaginated(params: {
  page: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  projectId?: string;
}): Promise<PaginatedResult<TransactionListItem>> {
  await requireAuth();

  const pageSize = params.pageSize || 20;

  // Build WHERE conditions
  const filterConditions: ReturnType<typeof eq>[] = [];

  // Project filter
  if (params.projectId) {
    filterConditions.push(eq(transactions.projectId, params.projectId));
  }

  // Category filter
  if (params.categoryId) {
    filterConditions.push(eq(transactions.categoryId, params.categoryId));
  }

  // Date range filter — start date (inclusive)
  if (params.startDate) {
    const start = new Date(params.startDate);
    filterConditions.push(gte(transactions.transactionDate, start));
  }

  // Date range filter — end date (inclusive, end of day)
  if (params.endDate) {
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);
    filterConditions.push(lte(transactions.transactionDate, end));
  }

  // Combine all conditions
  const whereClause = filterConditions.length > 0
    ? and(...filterConditions)
    : undefined;

  // Count query for pagination navigation (uses same JOINs for filter accuracy)
  const [countResult] = await db
    .select({ totalCount: count() })
    .from(transactions)
    .innerJoin(projects, eq(transactions.projectId, projects.id))
    .innerJoin(financeAccounts, eq(transactions.accountId, financeAccounts.id))
    .innerJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
    .leftJoin(units, eq(transactions.unitId, units.id))
    .leftJoin(customers, eq(transactions.customerId, customers.id))
    .where(whereClause);

  const totalCount = countResult?.totalCount ?? 0;

  // Validate and normalize pagination params
  const validatedParams = validatePaginationParams({ page: params.page, pageSize }, totalCount);
  const { limit, offset } = calculateOffset(validatedParams);
  const totalPages = Math.ceil(totalCount / validatedParams.pageSize);

  // Main data query with JOINs — specific columns only
  const results = await db
    .select({
      id: transactions.id,
      transactionNumber: transactions.transactionNumber,
      projectId: transactions.projectId,
      type: transactions.type,
      description: transactions.description,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
      paymentMethod: transactions.paymentMethod,
      approvalStatus: transactions.approvalStatus,
      createdAt: transactions.createdAt,
      projectName: projects.name,
      accountName: financeAccounts.name,
      categoryName: financeCategories.name,
      categoryId: transactions.categoryId,
      unitCode: units.code,
      customerName: customers.name,
    })
    .from(transactions)
    .innerJoin(projects, eq(transactions.projectId, projects.id))
    .innerJoin(financeAccounts, eq(transactions.accountId, financeAccounts.id))
    .innerJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
    .leftJoin(units, eq(transactions.unitId, units.id))
    .leftJoin(customers, eq(transactions.customerId, customers.id))
    .where(whereClause)
    .orderBy(desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data: results as TransactionListItem[],
    totalCount,
    page: validatedParams.page,
    pageSize: validatedParams.pageSize,
    totalPages,
  };
}

export async function createExpenseRequest(data: unknown) {
  const activeUser = await requireAuth();
  const parsed = expenseRequestSchema.parse(data);

  const trxId = crypto.randomUUID();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const transactionNumber = `TRX-OUT-${dateStr}-${rand}`;

  let approvalStatusResult: "pending" | "insufficient_balance" = "pending";

  await db.transaction(async (tx) => {
    // Check if account has sufficient balance
    const accountResults = await tx
      .select()
      .from(financeAccounts)
      .where(eq(financeAccounts.id, parsed.accountId))
      .limit(1)
      .all();

    if (accountResults.length === 0) {
      throw new Error("Akun kas/bank tidak ditemukan");
    }

    const account = accountResults[0];
    // Compute real current balance from all settled transactions
    const expCheckData = await tx.select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(and(eq(transactions.accountId, account.id), eq(transactions.type, "expense"), eq(transactions.approvalStatus, "approved")))
      .all();
    const incCheckData = await tx.select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(and(eq(transactions.accountId, account.id), eq(transactions.type, "income"), eq(transactions.approvalStatus, "not_required")))
      .all();
    const realExpenseBalance = account.openingBalance + Number(incCheckData[0]?.total ?? 0) - Number(expCheckData[0]?.total ?? 0);
    const hasSufficient = realExpenseBalance >= parsed.amount;
    const approvalStatus = hasSufficient ? "pending" : "insufficient_balance";
    approvalStatusResult = approvalStatus;

    await tx.insert(transactions).values({
      id: trxId,
      transactionNumber,
      projectId: parsed.projectId,
      accountId: parsed.accountId,
      categoryId: parsed.categoryId,
      type: "expense",
      description: parsed.description,
      amount: parsed.amount,
      transactionDate: parsed.transactionDate,
      paymentMethod: parsed.paymentMethod,
      approvalStatus,
      attachmentId: parsed.attachmentId || null,
      createdBy: activeUser.id,
    }).run();

    const expenseInvoiceId = crypto.randomUUID();
    const expenseInvoiceNumber = `INV-EXP-${dateStr}-${rand}`;

    await tx.insert(invoices).values({
      id: expenseInvoiceId,
      invoiceNumber: expenseInvoiceNumber,
      projectId: parsed.projectId,
      unitId: null,
      customerId: null,
      bookingId: null,
      type: "other",
      amount: parsed.amount,
      dueDate: parsed.transactionDate,
      status: "unpaid",
      notes: `trxId:${trxId}`,
    }).run();
  });

  await writeAuditLog({
    action: "create",
    module: "finance",
    entityId: trxId,
    entityType: "transaction",
    details: {
      transactionNumber,
      amount: parsed.amount,
      approvalStatus: approvalStatusResult,
    },
  });

  // Notify Direksi / Manager and Super Admin
  await notifyUsersWithRoles({
    roleNames: ["Direksi / Manager", "Super Admin"],
    type: "approval_pending",
    title: "Pengajuan Kas Keluar Baru",
    message: `Pengajuan kas keluar senilai Rp ${parsed.amount.toLocaleString()} untuk ${parsed.description} memerlukan persetujuan Anda.`,
    entityId: trxId,
    entityType: "transaction",
  });

  revalidatePath("/finance/transactions");
  revalidatePath("/finance/approvals");
  revalidatePath("/dashboard");
  return { success: true, transactionId: trxId };
}

export async function approveExpense(transactionId: string, notes?: string) {
  const activeUser = await requireAuth();

  // Verify Director/Manager role
  const { isDireksi: isDirector, isSuperAdmin: isSuper } = await getSessionRole(activeUser.id);

  if (!isDirector && !isSuper) {
    throw new Error("Hanya Direktur atau Manager yang dapat memberikan persetujuan.");
  }

  let transactionNumber = "";
  let transactionAmount = 0;

  await db.transaction(async (tx) => {
    // 1. Fetch transaction
    const trxResults = await tx
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1)
      .all();

    if (trxResults.length === 0) {
      throw new Error("Transaksi pengeluaran tidak ditemukan");
    }

    const transaction = trxResults[0];
    transactionNumber = transaction.transactionNumber;
    transactionAmount = transaction.amount;
    if (transaction.type !== "expense") {
      throw new Error("Transaksi ini bukan pengeluaran");
    }

    if (transaction.approvalStatus === "approved") {
      throw new Error("Pengeluaran ini sudah disetujui sebelumnya");
    }

    // 2. Query target account
    const accountResults = await tx
      .select()
      .from(financeAccounts)
      .where(eq(financeAccounts.id, transaction.accountId))
      .limit(1)
      .all();

    if (accountResults.length === 0) {
      throw new Error("Akun kas tidak ditemukan");
    }

    const account = accountResults[0];
    // Compute real current balance from all settled transactions
    const expBalResult = await tx
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(and(
        eq(transactions.accountId, account.id),
        eq(transactions.type, "expense"),
        eq(transactions.approvalStatus, "approved")
      ))
      .all();
    const incBalResult = await tx
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(and(
        eq(transactions.accountId, account.id),
        eq(transactions.type, "income"),
        eq(transactions.approvalStatus, "not_required")
      ))
      .all();
    const currentAccountBalance = account.openingBalance + Number(incBalResult[0]?.total ?? 0) - Number(expBalResult[0]?.total ?? 0);

    if (currentAccountBalance < transaction.amount) {
      // Mark as insufficient balance and block approval
      await tx
        .update(transactions)
        .set({
          approvalStatus: "insufficient_balance",
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, transactionId))
        .run();

      throw new Error(
        `Saldo kas/bank (${account.name}) saat ini tidak mencukupi untuk menyetujui transaksi senilai Rp ${transaction.amount.toLocaleString()}. Saldo tersedia: Rp ${currentAccountBalance.toLocaleString()}`
      );
    }

    // 3. Balance is implicitly reduced by the approved expense transaction record.
    // No mutation of financeAccounts.openingBalance needed.

    // 4. Update transaction status
    await tx
      .update(transactions)
      .set({
        approvalStatus: "approved",
        approvedBy: activeUser.id,
        approvalNotes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, transactionId))
      .run();

    // 4b. Update corresponding auto-generated invoice status to paid
    await tx
      .update(invoices)
      .set({
        status: "paid",
        updatedAt: new Date(),
      })
      .where(eq(invoices.notes, `trxId:${transactionId}`))
      .run();

    // 5. Log approval record
    await tx.insert(transactionApprovals).values({
      id: crypto.randomUUID(),
      transactionId,
      approverId: activeUser.id,
      level: 1,
      status: "approved",
      notes: notes || null,
      actedAt: new Date(),
    }).run();

    // 6. Check for project active budget, deduct if linked to a category in budget lines
    const activeBudgetResults = await tx
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.projectId, transaction.projectId),
          eq(budgets.status, "active")
        )
      )
      .limit(1)
      .all();

    if (activeBudgetResults.length > 0) {
      const activeBudget = activeBudgetResults[0];
      const budgetLineResults = await tx
        .select()
        .from(budgetLines)
        .where(
          and(
            eq(budgetLines.budgetId, activeBudget.id),
            eq(budgetLines.categoryId, transaction.categoryId)
          )
        )
        .limit(1)
        .all();

      if (budgetLineResults.length > 0) {
        const line = budgetLineResults[0];
        const newUsed = line.usedAmount + transaction.amount;
        const newRemaining = line.allocatedAmount - newUsed;

        await tx
          .update(budgetLines)
          .set({
            usedAmount: newUsed,
            remainingAmount: newRemaining,
          })
          .where(eq(budgetLines.id, line.id))
          .run();
      }
    }
  });

  // 7. Write Audit Log outside transaction
  await writeAuditLog({
    action: "approve",
    module: "finance",
    entityId: transactionId,
    entityType: "transaction",
    details: {
      transactionNumber,
      amount: transactionAmount,
    },
  });

  // Notify requester
  const finalTrx = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (finalTrx.length > 0 && finalTrx[0].createdBy) {
    await createNotification({
      userId: finalTrx[0].createdBy,
      type: "info",
      title: "Pengajuan Kas Keluar Disetujui",
      message: `Pengajuan kas keluar Anda senilai Rp ${finalTrx[0].amount.toLocaleString()} untuk "${finalTrx[0].description}" telah disetujui.`,
      entityId: transactionId,
      entityType: "transaction",
    });
  }

  revalidatePath("/finance/transactions");
  revalidatePath("/finance/approvals");
  revalidatePath("/finance/budgets");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function rejectExpense(transactionId: string, notes: string) {
  const activeUser = await requireAuth();

  if (!notes || notes.trim().length === 0) {
    throw new Error("Catatan penolakan wajib diisi");
  }

  const { isDireksi: isDirector, isSuperAdmin: isSuper } = await getSessionRole(activeUser.id);

  if (!isDirector && !isSuper) {
    throw new Error("Hanya Direktur atau Manager yang dapat menolak transaksi.");
  }

  let transactionNumber = "";
  let transactionAmount = 0;

  await db.transaction(async (tx) => {
    // 1. Fetch transaction
    const trxResults = await tx
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1)
      .all();

    if (trxResults.length === 0) {
      throw new Error("Transaksi pengeluaran tidak ditemukan");
    }

    const transaction = trxResults[0];
    transactionNumber = transaction.transactionNumber;
    transactionAmount = transaction.amount;
    if (transaction.type !== "expense") {
      throw new Error("Transaksi ini bukan pengeluaran");
    }

    // 2. Update status to rejected
    await tx
      .update(transactions)
      .set({
        approvalStatus: "rejected",
        approvalNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, transactionId))
      .run();

    // 2b. Update corresponding auto-generated invoice status to cancelled
    await tx
      .update(invoices)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(invoices.notes, `trxId:${transactionId}`))
      .run();

    // 3. Log approval action
    await tx.insert(transactionApprovals).values({
      id: crypto.randomUUID(),
      transactionId,
      approverId: activeUser.id,
      level: 1,
      status: "rejected",
      notes,
      actedAt: new Date(),
    }).run();
  });

  // 4. Write Audit Log outside transaction
  await writeAuditLog({
    action: "reject",
    module: "finance",
    entityId: transactionId,
    entityType: "transaction",
    details: {
      transactionNumber,
      amount: transactionAmount,
      reason: notes,
    },
  });

  // Notify requester
  const finalTrx = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (finalTrx.length > 0 && finalTrx[0].createdBy) {
    await createNotification({
      userId: finalTrx[0].createdBy,
      type: "info",
      title: "Pengajuan Kas Keluar Ditolak",
      message: `Pengajuan kas keluar Anda senilai Rp ${finalTrx[0].amount.toLocaleString()} untuk "${finalTrx[0].description}" ditolak. Catatan: ${notes}`,
      entityId: transactionId,
      entityType: "transaction",
    });
  }

  revalidatePath("/finance/transactions");
  revalidatePath("/finance/approvals");
  return { success: true };
}

// ==========================================
// 4. BUDGETING SERVICE LAYER
// ==========================================

export async function getBudgets(projectId: string) {
  await requireAuth();

  return db
    .select({
      budget: budgets,
      project: projects,
    })
    .from(budgets)
    .innerJoin(projects, eq(budgets.projectId, projects.id))
    .where(eq(budgets.projectId, projectId))
    .orderBy(desc(budgets.createdAt));
}

export async function getBudgetDetails(budgetId: string) {
  await requireAuth();

  const results = await db
    .select({
      budget: budgets,
      project: projects,
    })
    .from(budgets)
    .innerJoin(projects, eq(budgets.projectId, projects.id))
    .where(eq(budgets.id, budgetId))
    .limit(1);

  if (results.length === 0) return null;

  const lines = await db
    .select({
      line: budgetLines,
      category: financeCategories,
    })
    .from(budgetLines)
    .innerJoin(financeCategories, eq(budgetLines.categoryId, financeCategories.id))
    .where(eq(budgetLines.budgetId, budgetId));

  return {
    ...results[0],
    lines,
  };
}

export async function createBudget(data: unknown) {
  const activeUser = await requireAuth();
  const parsed = budgetSchema.parse(data);

  const budgetId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    // 1. Insert Budget Header
    await tx.insert(budgets).values({
      id: budgetId,
      projectId: parsed.projectId,
      name: parsed.name,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      totalAmount: parsed.totalAmount,
      status: "draft",
      createdBy: activeUser.id,
    }).run();

    // 2. Insert Budget Lines
    for (const line of parsed.lines) {
      await tx.insert(budgetLines).values({
        id: crypto.randomUUID(),
        budgetId,
        categoryId: line.categoryId,
        allocatedAmount: line.allocatedAmount,
        usedAmount: 0,
        remainingAmount: line.allocatedAmount,
      }).run();
    }
  });

  // 3. Audit Log outside transaction
  await writeAuditLog({
    action: "create",
    module: "finance",
    entityId: budgetId,
    entityType: "budget",
    details: { name: parsed.name, totalAmount: parsed.totalAmount },
  });

  revalidatePath("/finance/budgets");
  return { success: true, budgetId };
}

// ==========================================
// 5. FINANCIAL STATEMENTS & REPORTING
// ==========================================

export async function getFinancialReport(projectId: string) {
  await requireAuth();

  // Incomes (approved / no approval needed)
  const incomeConditions = [eq(transactions.type, "income")];
  if (projectId && projectId !== "all") {
    incomeConditions.push(eq(transactions.projectId, projectId));
  }
  const incomeTrxs = await db
    .select()
    .from(transactions)
    .where(and(...incomeConditions));

  // Expenses (must be approved)
  const expenseConditions = [
    eq(transactions.type, "expense"),
    eq(transactions.approvalStatus, "approved")
  ];
  if (projectId && projectId !== "all") {
    expenseConditions.push(eq(transactions.projectId, projectId));
  }
  const expenseTrxs = await db
    .select()
    .from(transactions)
    .where(and(...expenseConditions));

  const totalIncome = incomeTrxs.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = expenseTrxs.reduce((sum, item) => sum + item.amount, 0);

  // Get all finance accounts with computed current balances
  const accountsList = await db.select().from(financeAccounts);

  // Aggregate settled transaction amounts per account and type in one query
  const balanceSums = await db
    .select({
      accountId: transactions.accountId,
      type: transactions.type,
      total: sum(transactions.amount),
    })
    .from(transactions)
    .where(
      sql`(
        (${transactions.type} = 'income' AND ${transactions.approvalStatus} = 'not_required') OR
        (${transactions.type} = 'expense' AND ${transactions.approvalStatus} = 'approved')
      )`
    )
    .groupBy(transactions.accountId, transactions.type);

  const accountsWithBalance = accountsList.map((acc) => {
    const incomeTotal = balanceSums
      .filter((s) => s.accountId === acc.id && s.type === "income")
      .reduce((t, s) => t + Number(s.total ?? 0), 0);
    const expenseTotal = balanceSums
      .filter((s) => s.accountId === acc.id && s.type === "expense")
      .reduce((t, s) => t + Number(s.total ?? 0), 0);
    return { ...acc, currentBalance: acc.openingBalance + incomeTotal - expenseTotal };
  });

  // Get budgets status
  const budgetList = await db
    .select({ budget: budgets })
    .from(budgets)
    .where(projectId && projectId !== "all" ? eq(budgets.projectId, projectId) : undefined);

  // Category wise expenses
  const categoryConditions = [
    eq(transactions.type, "expense"),
    eq(transactions.approvalStatus, "approved")
  ];
  if (projectId && projectId !== "all") {
    categoryConditions.push(eq(transactions.projectId, projectId));
  }
  const categoryExpenses = await db
    .select({
      categoryName: financeCategories.name,
      categoryId: transactions.categoryId,
      totalAmount: sum(transactions.amount),
    })
    .from(transactions)
    .innerJoin(
      financeCategories,
      eq(transactions.categoryId, financeCategories.id)
    )
    .where(and(...categoryConditions))
    .groupBy(transactions.categoryId, financeCategories.name);

  return {
    totalIncome,
    totalExpense,
    netCashFlow: totalIncome - totalExpense,
    accounts: accountsWithBalance,
    budgetsCount: budgetList.length,
    categoryExpenses: categoryExpenses.map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      amount: Number(c.totalAmount || 0),
    })),
    recentTransactions: [...incomeTrxs, ...expenseTrxs]
      .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime())
      .slice(0, 10),
  };
}

export async function checkPaymentReminders() {
  const now = new Date();

  const overdueInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      amount: invoices.amount,
      dueDate: invoices.dueDate,
      customerId: invoices.customerId,
      customerName: customers.name,
      assignedMarketingId: customers.assignedMarketingId,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(
      and(
        inArray(invoices.status, ["unpaid", "partial"]),
        isNotNull(invoices.dueDate),
        lte(invoices.dueDate, now)
      )
    );

  let notifiedCount = 0;

  for (const inv of overdueInvoices) {
    // Check if notification already sent for this invoice
    const exists = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.entityId, inv.id),
          eq(notifications.entityType, "payment_reminder")
        )
      )
      .limit(1);

    if (exists.length > 0) continue;

    // 1. Notify the assigned marketing agent (if any)
    if (inv.assignedMarketingId) {
      await createNotification({
        userId: inv.assignedMarketingId,
        type: "info",
        title: "Tagihan Konsumen Overdue",
        message: `Tagihan ${inv.invoiceNumber} senilai Rp ${inv.amount.toLocaleString("id-ID")} untuk konsumen "${inv.customerName}" telah jatuh tempo pada ${new Date(inv.dueDate!).toLocaleDateString("id-ID")}.`,
        entityId: inv.id,
        entityType: "payment_reminder",
      });
    }

    // 2. Notify Keuangan & Direksi
    await notifyUsersWithRoles({
      roleNames: ["Admin Keuangan", "Direksi / Manager", "Super Admin"],
      type: "info",
      title: "Invoice Overdue",
      message: `Invoice ${inv.invoiceNumber} senilai Rp ${inv.amount.toLocaleString("id-ID")} untuk konsumen "${inv.customerName}" telah melewati batas tanggal jatuh tempo.`,
      entityId: inv.id,
      entityType: "payment_reminder",
    });

    notifiedCount++;
  }

  return { success: true, notifiedCount };
}

export async function deleteInvoice(invoiceId: string) {
  const activeUser = await requireAuth();

  // Validate authorization role: Super Admin or Admin Keuangan or Admin Kantor
  const { isSuperAdmin, isKeuangan, isAdminKantor } = await getSessionRole(activeUser.id);
  
  if (!isSuperAdmin && !isKeuangan && !isAdminKantor) {
    throw new Error("Anda tidak memiliki akses untuk menghapus invoice.");
  }

  // 1. Get Invoice details first
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) {
    throw new Error("Invoice tidak ditemukan.");
  }

  // 2. Check if invoice has any payments linked (verified or unverified)
  const linkedPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .limit(1);

  if (linkedPayments.length > 0) {
    throw new Error("Invoice tidak dapat dihapus karena sudah memiliki data pembayaran.");
  }

  // 3. Delete the invoice record
  await db.delete(invoices).where(eq(invoices.id, invoiceId));

  // 4. Write audit log
  await writeAuditLog({
    action: "delete",
    module: "finance",
    entityId: invoiceId,
    entityType: "invoice",
    details: {
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      type: invoice.type,
    },
  });

  revalidatePath("/finance");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared page data loader — used by finance/page.tsx and finance/approvals/page.tsx
// Centralizes all DB queries + in-memory enrichment in one place.
// ─────────────────────────────────────────────────────────────────────────────
export async function getFinancePageData() {
  const [
    projectsList,
    unitsList,
    customersList,
    accountsList,
    categoriesList,
    invoicesList,
    paymentsList,
    transactionsList,
    budgetsList,
    usersList,
  ] = await Promise.all([
    cachedQuery(
      () => db.select().from(projects),
      ["projects", "list"],
      { tags: ["projects"], revalidate: 300, fallback: [] }
    ),
    cachedQuery(
      () => db.select().from(units),
      ["units", "all"],
      { tags: ["units"], revalidate: 300, fallback: [] }
    ),
    cachedQuery(
      () => db.select().from(customers),
      ["customers", "all"],
      { tags: ["customers"], revalidate: 300, fallback: [] }
    ),
    db.select().from(financeAccounts),
    db.select().from(financeCategories),

    // Invoices with project and customer joins
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        projectId: invoices.projectId,
        unitId: invoices.unitId,
        customerId: invoices.customerId,
        bookingId: invoices.bookingId,
        type: invoices.type,
        amount: invoices.amount,
        dueDate: invoices.dueDate,
        status: invoices.status,
        notes: invoices.notes,
        createdAt: invoices.createdAt,
        projectName: projects.name,
        customerName: customers.name,
        unitCode: units.code,
      })
      .from(invoices)
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(units, eq(invoices.unitId, units.id))
      .orderBy(desc(invoices.createdAt)),

    // Payments with joined details
    db
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        paymentNumber: payments.paymentNumber,
        projectId: payments.projectId,
        unitId: payments.unitId,
        customerId: payments.customerId,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
        paymentMethod: payments.paymentMethod,
        proofAttachmentId: payments.proofAttachmentId,
        proofFileUrl: attachments.fileUrl,
        status: payments.status,
        verifiedBy: payments.verifiedBy,
        verifiedAt: payments.verifiedAt,
        createdAt: payments.createdAt,
        projectName: projects.name,
        customerName: customers.name,
        unitCode: units.code,
        invoiceNumber: invoices.invoiceNumber,
      })
      .from(payments)
      .innerJoin(projects, eq(payments.projectId, projects.id))
      .leftJoin(customers, eq(payments.customerId, customers.id))
      .leftJoin(units, eq(payments.unitId, units.id))
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .leftJoin(attachments, eq(payments.proofAttachmentId, attachments.id))
      .orderBy(desc(payments.createdAt)),

    // Ledger Transactions
    db
      .select({
        id: transactions.id,
        transactionNumber: transactions.transactionNumber,
        projectId: transactions.projectId,
        unitId: transactions.unitId,
        customerId: transactions.customerId,
        paymentId: transactions.paymentId,
        accountId: transactions.accountId,
        categoryId: transactions.categoryId,
        type: transactions.type,
        description: transactions.description,
        amount: transactions.amount,
        transactionDate: transactions.transactionDate,
        paymentMethod: transactions.paymentMethod,
        approvalStatus: transactions.approvalStatus,
        approvedBy: transactions.approvedBy,
        approvalNotes: transactions.approvalNotes,
        attachmentId: transactions.attachmentId,
        createdBy: transactions.createdBy,
        createdAt: transactions.createdAt,
        projectName: projects.name,
        accountName: financeAccounts.name,
        categoryName: financeCategories.name,
        unitCode: units.code,
        customerName: customers.name,
      })
      .from(transactions)
      .innerJoin(projects, eq(transactions.projectId, projects.id))
      .innerJoin(financeAccounts, eq(transactions.accountId, financeAccounts.id))
      .innerJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
      .leftJoin(units, eq(transactions.unitId, units.id))
      .leftJoin(customers, eq(transactions.customerId, customers.id))
      .orderBy(desc(transactions.createdAt)),

    // Budgets
    db
      .select({
        id: budgets.id,
        projectId: budgets.projectId,
        name: budgets.name,
        periodStart: budgets.periodStart,
        periodEnd: budgets.periodEnd,
        totalAmount: budgets.totalAmount,
        status: budgets.status,
        createdAt: budgets.createdAt,
        projectName: projects.name,
      })
      .from(budgets)
      .innerJoin(projects, eq(budgets.projectId, projects.id))
      .orderBy(desc(budgets.createdAt)),

    // Users
    db.select({ id: userTable.id, name: userTable.name }).from(userTable),
  ]);

  // Enrich transactions: resolve approver/verifier names + link to invoice
  const enrichedTransactions = transactionsList.map((trx) => {
    let resolvedApproverName = null;

    if (trx.type === "income" && trx.paymentId) {
      const payment = paymentsList.find((p) => p.id === trx.paymentId);
      if (payment?.verifiedBy) {
        const verifier = usersList.find((u) => u.id === payment.verifiedBy);
        if (verifier) resolvedApproverName = verifier.name;
      }
    }
    if (trx.type === "expense" && trx.approvedBy) {
      const approver = usersList.find((u) => u.id === trx.approvedBy);
      if (approver) resolvedApproverName = approver.name;
    }

    let invoiceNumber = null;
    let invoiceId = null;
    if (trx.paymentId) {
      const payment = paymentsList.find((p) => p.id === trx.paymentId);
      if (payment?.invoiceId) {
        const invoice = invoicesList.find((i) => i.id === payment.invoiceId);
        if (invoice) { invoiceNumber = invoice.invoiceNumber; invoiceId = invoice.id; }
      }
    } else {
      const matchInvoice = invoicesList.find((i) => i.notes === `trxId:${trx.id}`);
      if (matchInvoice) { invoiceNumber = matchInvoice.invoiceNumber; invoiceId = matchInvoice.id; }
    }

    return { ...trx, invoiceNumber, invoiceId, resolvedApproverName };
  });

  // Compute balance per account — only approved transactions count
  const balanceMap: Record<string, number> = {};
  for (const acc of accountsList) {
    balanceMap[acc.id] = acc.openingBalance ?? 0;
  }
  for (const trx of transactionsList) {
    if (!(trx.accountId in balanceMap)) balanceMap[trx.accountId] = 0;
    if (trx.type === "income" && (trx.approvalStatus === "approved" || trx.approvalStatus === "not_required")) {
      balanceMap[trx.accountId] += trx.amount;
    } else if (trx.type === "expense" && trx.approvalStatus === "approved") {
      balanceMap[trx.accountId] -= trx.amount;
    }
  }

  const enrichedAccounts = accountsList.map((acc) => ({
    ...acc,
    currentBalance: balanceMap[acc.id] ?? acc.openingBalance ?? 0,
  }));

  return {
    projects: projectsList,
    units: unitsList,
    customers: customersList,
    accounts: enrichedAccounts,
    categories: categoriesList,
    invoices: invoicesList,
    payments: paymentsList,
    transactions: enrichedTransactions,
    budgets: budgetsList,
  };
}
