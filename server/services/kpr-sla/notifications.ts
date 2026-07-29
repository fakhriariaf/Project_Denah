/**
 * KPR Stage SLA — Notifikasi per Kunjungan Tahap (Fase 6)
 *
 * Service fire-and-forget untuk notifikasi keterlambatan SLA per visit.
 * Kegagalan notifikasi hanya log terstruktur, tidak mengubah status/tracking.
 *
 * Identitas idempotensi: `kprProcessId + visitSeq` (composite entityId).
 * Membuat maksimal satu notifikasi saat visit aktif pertama menjadi terlambat.
 *
 * **Validates: Requirements 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.9**
 */

import { db } from "@/db";
import { notifications } from "@/db/schema/system";
import { and, eq } from "drizzle-orm";
import { notifyUsersWithRoles } from "@/server/services/notification.service";
import { isSlaTerminalStage } from "./resolver";
import { getMeasuredStageLabel } from "@/lib/label-helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Active visit with enriched context for notification rendering.
 * The caller (scanner/cron) is responsible for joining the necessary data.
 */
export interface ActiveVisitWithContext {
  kprProcessId: string;
  visitSeq: number;
  stage: string;
  slaDeadlineAt: Date;
  /** Current KPR process status — used to detect terminal SLA. */
  currentKprStatus: string;
  /** Consumer/customer name for message content. */
  customerName: string;
  /** Unit code (kavling) for message content. */
  unitCode: string;
  /** Project/perumahan name for message content. */
  projectName: string;
}

export interface NotificationResult {
  /** Number of notifications successfully created. */
  created: number;
  /** Number of visits skipped (dedup, not overdue, terminal). */
  skipped: number;
  /** Number of failed notification attempts (logged, not thrown). */
  failed: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Notification type for per-visit SLA overdue. */
const NOTIFICATION_TYPE = "kpr_sla";

/** Entity type for per-visit dedup — distinct from legacy "kpr_process". */
const ENTITY_TYPE = "kpr_stage_visit";

/** Recipient roles (same as legacy scanner — Req 23.3). */
const RECIPIENT_ROLES = ["Marketing", "Super Admin", "Admin Kantor"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the composite entityId for per-visit dedup.
 * Format: `${kprProcessId}:visit:${visitSeq}`
 *
 * This ensures:
 * - Different visitSeq for same kprProcessId → unique identity (new notification allowed)
 * - Same kprProcessId + visitSeq → same identity (dedup prevents duplicates)
 */
export function buildVisitEntityId(kprProcessId: string, visitSeq: number): string {
  return `${kprProcessId}:visit:${visitSeq}`;
}

/**
 * Calculate overdue duration in calendar days (for human-readable message).
 */
function calculateOverdueDays(deadline: Date, now: Date): number {
  const diffMs = now.getTime() - deadline.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Format deadline date for Indonesian notification message.
 */
function formatDeadlineDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

// ---------------------------------------------------------------------------
// Main Service Function
// ---------------------------------------------------------------------------

/**
 * Check active visits and create overdue notifications where needed.
 *
 * For each active visit that is "terlambat" (deadline passed):
 * 1. Skip if KPR is in terminal SLA status (Req 23.6)
 * 2. Skip if visit is NOT overdue (deadline in future) (Req 23.5)
 * 3. Check dedup: query notifications for existing with composite entityId (Req 23.8)
 * 4. If no existing: create ONE notification with full context (Req 23.1, 23.2)
 *
 * Failures are logged structurally and never thrown (Req 23.7).
 * Does NOT modify status or tracking data.
 */
export async function checkAndNotifyOverdueVisits(
  visits: ActiveVisitWithContext[],
  now?: Date,
): Promise<NotificationResult> {
  const evaluationTime = now ?? new Date();
  const result: NotificationResult = { created: 0, skipped: 0, failed: 0 };

  for (const visit of visits) {
    try {
      // 1. Terminal SLA check — stop trigger (Req 23.6)
      if (isSlaTerminalStage(visit.currentKprStatus)) {
        result.skipped++;
        continue;
      }

      // 2. Not overdue check — skip if deadline not passed (Req 23.5)
      if (evaluationTime.getTime() <= visit.slaDeadlineAt.getTime()) {
        result.skipped++;
        continue;
      }

      // 3. Dedup check — per-visit identity (Req 23.8)
      const entityId = buildVisitEntityId(visit.kprProcessId, visit.visitSeq);

      const existing = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.entityId, entityId),
            eq(notifications.type, NOTIFICATION_TYPE),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        result.skipped++;
        continue;
      }

      // 4. Create notification (Req 23.1, 23.2, 23.3)
      const stageLabel = getMeasuredStageLabel(visit.stage);
      const deadlineFormatted = formatDeadlineDate(visit.slaDeadlineAt);
      const overdueDays = calculateOverdueDays(visit.slaDeadlineAt, evaluationTime);

      const title = "SLA KPR Melebihi Tenggat";
      const message =
        `Tahap "${stageLabel}" untuk KPR kavling ${visit.unitCode} ` +
        `oleh konsumen ${visit.customerName} di ${visit.projectName} ` +
        `telah melewati tenggat ${deadlineFormatted} ` +
        `(terlambat ${overdueDays} hari).`;

      const notifyResult = await notifyUsersWithRoles({
        roleNames: RECIPIENT_ROLES,
        type: NOTIFICATION_TYPE,
        title,
        message,
        entityId,
        entityType: ENTITY_TYPE,
      });

      if (notifyResult.success) {
        result.created++;
      } else {
        // Notification insert failed — log structured, don't throw (Req 23.7)
        console.error(
          JSON.stringify({
            event: "kpr_sla_visit_notification_failed",
            kprProcessId: visit.kprProcessId,
            visitSeq: visit.visitSeq,
            stage: visit.stage,
            reason: "notify_insert_failed",
          }),
        );
        result.failed++;
      }
    } catch (err) {
      // Catch-all: log structured error, never throw (Req 23.7)
      console.error(
        JSON.stringify({
          event: "kpr_sla_visit_notification_error",
          kprProcessId: visit.kprProcessId,
          visitSeq: visit.visitSeq,
          stage: visit.stage,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      result.failed++;
    }
  }

  return result;
}
