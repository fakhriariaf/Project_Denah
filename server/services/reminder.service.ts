/**
 * Reminder / scanner service — INTERNAL ONLY.
 *
 * SECURITY BOUNDARY (P0):
 * This module deliberately has NO "use server" directive.
 *
 * The three scans below previously lived directly in `"use server"` action files
 * and were therefore browser-callable RPC endpoints. `checkFollowupReminders`
 * and `checkOverdueSpks` had NO auth guard at all, so an anonymous caller could
 * repeatedly trigger full-table scans plus mass notification inserts (and, for
 * the SPK scan, real status mutations on SPK + unit rows).
 *
 * The scan payloads are derived from DB state, not from caller input, so this is
 * a trigger/abuse problem rather than content injection — but it still allowed
 * unauthenticated writes and notification spam.
 *
 * Callers:
 *   - Guarded server-action wrappers (manual "run scan" buttons in the UI).
 *   - `app/api/cron/overdue-scanner/route.ts`, which authenticates with
 *     CRON_SECRET via timing-safe comparison and has no user session.
 */

import { db } from "@/db";
import { invoices } from "@/db/schema/finance";
import { notifications } from "@/db/schema/system";
import { customers, units, unitStatusHistories } from "@/db/schema/master";
import { customerFollowups, leads, kprProcesses, bookings } from "@/db/schema/marketing";
import { spks } from "@/db/schema/production";
import { and, eq, or, lt, lte, inArray, isNotNull, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/permissions";
import { createNotification, notifyUsersWithRoles } from "./notification.service";
import { writeAuditLog } from "./audit.service";
import { SLA_TERMINAL_STAGES } from "./kpr-sla/resolver";
import { resolveCutoverState } from "./kpr-sla/config";
import {
  getOverdueActiveVisitsWithContext,
  getKprIdsWithActiveVisit,
} from "./kpr-sla/queries";
import { checkAndNotifyOverdueVisits } from "./kpr-sla/notifications";

/**
 * Scans unpaid/partial invoices past their due date and notifies the assigned
 * marketing agent plus finance/management. Idempotent per invoice: a reminder is
 * skipped when a `payment_reminder` notification already exists for it.
 */
export async function runPaymentReminderScan() {
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

  return { success: true as const, notifiedCount };
}

/**
 * Scans follow-up schedules whose `nextFollowupAt` has passed and notifies the
 * responsible marketing user. Idempotent per follow-up via existing
 * `followup_reminder` notifications.
 */
export async function runFollowupReminderScan() {
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
    return { success: true as const, notifiedCount: 0 };
  }

  const followupIds = overdueFollowups.map((item) => item.id);

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
      .map((n) => n.entityId)
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

  return { success: true as const, notifiedCount: batchValues.length };
}

/**
 * Flags SPKs (and their units, unless ready-stock) as `overdue` when the target
 * end date has passed and progress is below 100%.
 *
 * Uses `getCurrentUser()` (non-redirecting) so it works in both contexts:
 *   - manual admin trigger (session present → real actor id)
 *   - cron job (no session → attributed to "system-cron")
 */
export async function runOverdueSpkScan() {
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
          reason: `Target penyelesaian SPK ${item.spk.spkNumber} terlewati (${new Date(item.spk.targetEndDate!).toLocaleDateString()}) dengan progress ${item.spk.progressPct}%`,
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
        message: `Pekerjaan SPK ${item.spk.spkNumber} untuk unit kavling ${item.unit.code} mengalami keterlambatan (target: ${new Date(item.spk.targetEndDate!).toLocaleDateString("id-ID")}).`,
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
  return { success: true as const, updatedCount };
}

/** Counters audited separately per scan path (tracking vs legacy). */
export interface KprSlaScanCounters {
  /** Rows considered by the path (input size). */
  evaluated: number;
  /** Notifications successfully created. */
  created: number;
  /** Rows skipped (dedup, not overdue, terminal). */
  skipped: number;
  /** Rows that failed (logged, never thrown). */
  failed: number;
}

export type KprSlaScanResult =
  | {
      success: true;
      /** `dual_read` = tracking + filtered legacy. `tracking_only` = post-cutover. */
      mode: "dual_read" | "tracking_only";
      tracking: KprSlaScanCounters;
      legacy: KprSlaScanCounters;
    }
  | {
      success: false;
      reason: "cutover_unavailable";
      error: string;
    };

function emptyCounters(): KprSlaScanCounters {
  return { evaluated: 0, created: 0, skipped: 0, failed: 0 };
}

/**
 * Legacy KPR SLA scanner (pre-cutover only).
 *
 * Scans KPR processes whose legacy `slaDeadlineAt` has passed and notifies
 * marketing/management with a `kpr_sla` notification. Idempotent per KPR:
 * skipped when a `kpr_sla` notification already exists for that KPR id.
 *
 * Terminal SLA stages (`rejected`, `akad`, `realisasi`) are excluded — SLA
 * stops being measured once a KPR enters one of them. `approved` is NOT
 * excluded and remains scannable while overdue.
 *
 * `excludedKprIds` carries the KPR ids already owned by Tracking_SLA (they have
 * an active stage visit). Those are skipped here so a single SLA context never
 * produces two notifications during dual-read.
 */
async function runLegacyKprSlaOverdueScan(
  now: Date,
  excludedKprIds: Set<string>,
): Promise<KprSlaScanCounters> {
  const counters = emptyCounters();

  const conditions = [
    isNotNull(kprProcesses.slaDeadlineAt),
    lt(kprProcesses.slaDeadlineAt, now),
    notInArray(kprProcesses.status, [...SLA_TERMINAL_STAGES]),
  ];

  // `notInArray` with an empty list is invalid SQL in drizzle — only add the
  // exclusion when there is at least one tracked KPR.
  if (excludedKprIds.size > 0) {
    conditions.push(notInArray(kprProcesses.id, [...excludedKprIds]));
  }

  // Fetch overdue, non-terminal KPR with the display fields needed for the
  // notification message. Single batched join — no N+1.
  const overdueKpr = await db
    .select({
      kprId: kprProcesses.id,
      status: kprProcesses.status,
      slaDeadlineAt: kprProcesses.slaDeadlineAt,
      unitCode: units.code,
      customerName: customers.name,
    })
    .from(kprProcesses)
    .innerJoin(bookings, eq(kprProcesses.bookingId, bookings.id))
    .innerJoin(units, eq(bookings.unitId, units.id))
    .leftJoin(customers, eq(bookings.customerId, customers.id))
    .where(and(...conditions));

  counters.evaluated = overdueKpr.length;

  for (const item of overdueKpr) {
    try {
      // Idempotency: skip if a kpr_sla notification already exists for this KPR.
      const existing = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.entityId, item.kprId),
            eq(notifications.type, "kpr_sla"),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        counters.skipped++;
        continue;
      }

      await notifyUsersWithRoles({
        roleNames: ["Marketing", "Super Admin", "Admin Kantor"],
        type: "kpr_sla",
        title: "Pemberkasan KPR Melebihi SLA",
        // Wording sengaja tidak menyebut angka hari tetap; tenggat dapat
        // berasal dari target yang dikonfigurasi per tahap/perumahan.
        message: `Pengajuan KPR kavling ${item.unitCode} oleh konsumen ${item.customerName ?? "-"} telah melewati tenggat SLA yang ditetapkan.`,
        entityId: item.kprId,
        entityType: "kpr_process",
      });
      counters.created++;
    } catch (err) {
      counters.failed++;
      console.warn(
        JSON.stringify({
          event: "kpr_sla_scan_error",
          kprId: item.kprId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  return counters;
}

/**
 * KPR SLA overdue scanner — per-visit tracking first, legacy only as dual-read.
 *
 * Flow:
 * 1. Resolve cutover state. `unavailable` → fail-closed: the scan is skipped
 *    entirely instead of silently falling back to the legacy scanner (Req 25.11).
 * 2. Scan overdue ACTIVE stage visits (`kpr_stage_visits`) in one batched query
 *    and hand them to `checkAndNotifyOverdueVisits`, which owns all dedup /
 *    terminal / overdue / recipient / payload logic (per-visit identity
 *    `${kprProcessId}:visit:${visitSeq}`, so a backward transition that opens a
 *    new visit is allowed to notify again — Req 23).
 * 3. Pre-cutover (`inactive`) → dual-read: the legacy scanner still runs, but
 *    only for KPR WITHOUT an active tracking visit.
 * 4. Post-cutover (`active`) → tracking only, legacy scanner is not run at all.
 *
 * Read-only with respect to tracking data: nothing here mutates visits.
 *
 * **Validates: Requirements 23.1–23.9, 25.5, 25.6, 25.11**
 */
export async function runKprSlaOverdueScan(): Promise<KprSlaScanResult> {
  const now = new Date();
  const cutoverState = await resolveCutoverState();

  if (cutoverState.status === "unavailable") {
    // Fail-closed: never run the legacy scanner behind the user's back when we
    // cannot tell whether cutover already happened (Req 25.11).
    console.error(
      JSON.stringify({
        event: "kpr_sla_scan_skipped",
        reason: "cutover_unavailable",
        error: cutoverState.error,
      }),
    );
    return {
      success: false as const,
      reason: "cutover_unavailable" as const,
      error: cutoverState.error,
    };
  }

  // ---- Tracking path (always runs) ------------------------------------------
  const tracking = emptyCounters();
  const activeVisits = await getOverdueActiveVisitsWithContext(now);
  tracking.evaluated = activeVisits.length;

  const trackingOutcome = await checkAndNotifyOverdueVisits(activeVisits, now);
  tracking.created = trackingOutcome.created;
  tracking.skipped = trackingOutcome.skipped;
  tracking.failed = trackingOutcome.failed;

  // ---- Legacy path (pre-cutover dual-read only) -----------------------------
  let legacy = emptyCounters();

  if (cutoverState.status === "inactive") {
    const trackedKprIds = await getKprIdsWithActiveVisit();
    legacy = await runLegacyKprSlaOverdueScan(now, trackedKprIds);
  }

  return {
    success: true as const,
    mode: cutoverState.status === "active" ? ("tracking_only" as const) : ("dual_read" as const),
    tracking,
    legacy,
  };
}
