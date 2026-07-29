"use server";

/**
 * KPR Stage SLA — Server Actions (Master SLA)
 *
 * CRUD actions untuk Master_SLA config. Mutations guarded dengan
 * `requireRole("Super Admin")`. Read guarded dengan `requireAuth`.
 *
 * Audit record ditulis atomik di dalam transaction yang sama (bukan
 * fire-and-forget). Kegagalan audit → rollback mutation.
 *
 * **Validates: Requirements 1.1, 1.4, 1.5, 1.6, 2.1, 2.4, 2.5, 2.6, 2.7,
 *   17.1, 17.6, 17.7, 17.8, 17.11, 18.1, 18.8**
 */

import { db } from "@/db";
import { kprSlaConfigs } from "@/db/schema/marketing";
import { auditLogs } from "@/db/schema/system";
import { projects } from "@/db/schema/master";
import { user as userTable } from "@/db/schema/auth";
import { requireAuth, requireRole } from "@/server/permissions";
import { kprSlaConfigSchema } from "@/server/validators/kpr-sla";
import { eq, and, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { parseServerError } from "@/lib/error-parser";

import {
  getKprSlaConfigsList,
  type KprSlaConfigFilter,
  type KprSlaConfigRow,
} from "@/server/services/kpr-sla/queries";

// Stage type matching the schema column type
type ConfigStage = "bi_checking" | "pemberkasan" | "proses_bank" | "offering" | "approved";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

// ─── READ ───────────────────────────────────────────────────────────────────

/**
 * Ambil daftar Master_SLA configs. Semua pengguna terautentikasi yang memiliki
 * akses KPR dapat membaca — tidak perlu Super Admin.
 */
export async function getKprSlaConfigs(
  filter?: KprSlaConfigFilter,
): Promise<ActionResult<KprSlaConfigRow[]>> {
  await requireAuth();

  try {
    const configs = await getKprSlaConfigsList(filter);
    return { success: true, data: configs };
  } catch (err) {
    return {
      success: false,
      error: parseServerError(
        err,
        "Sistem tetap menggunakan SLA legacy. Coba lagi atau hubungi administrator.",
      ),
    };
  }
}

// ─── CREATE ─────────────────────────────────────────────────────────────────

/**
 * Buat Master_SLA config baru. Super Admin only.
 * Duplicate guard di level aplikasi + DB constraint sebagai perlindungan concurrency.
 */
export async function createKprSlaConfig(
  data: unknown,
): Promise<ActionResult<{ id: string }>> {
  const activeUser = await requireRole("Super Admin");

  // Validate input
  const parsed = kprSlaConfigSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { success: false, error: firstIssue?.message ?? "Data tidak valid" };
  }

  const input = parsed.data;

  // Application-level duplicate guard (friendly message)
  const duplicateError = await checkDuplicate(input.scope, input.projectId ?? null, input.stage);
  if (duplicateError) {
    return { success: false, error: duplicateError };
  }

  const id = crypto.randomUUID();
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      // Insert config
      await tx.insert(kprSlaConfigs).values({
        id,
        scope: input.scope,
        projectId: input.projectId ?? null,
        stage: input.stage as ConfigStage,
        workingDays: input.workingDays,
        isActive: input.isActive,
        createdBy: activeUser.id,
        updatedBy: activeUser.id,
        createdAt: now,
        updatedAt: now,
      });

      // Audit record — atomik di dalam tx yang sama
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        userId: activeUser.id,
        action: "create_kpr_sla_config",
        module: "kpr_sla",
        entityId: id,
        entityType: "kpr_sla_config",
        details: {
          scope: input.scope,
          projectId: input.projectId,
          stage: input.stage,
          workingDays: input.workingDays,
          isActive: input.isActive,
        },
        createdAt: now,
      });
    });

    revalidatePath("/master/kpr-sla");
    return { success: true, data: { id } };
  } catch (err) {
    // Handle DB unique constraint violation (concurrency race)
    if (isUniqueViolation(err)) {
      const friendlyMsg = getFriendlyDuplicateMessage(input.scope);
      return { success: false, error: friendlyMsg };
    }
    return {
      success: false,
      error: parseServerError(err, "Gagal membuat konfigurasi SLA. Silakan coba lagi."),
    };
  }
}

// ─── UPDATE ─────────────────────────────────────────────────────────────────

/**
 * Update Master_SLA config yang sudah ada. Super Admin only.
 */
export async function updateKprSlaConfig(
  id: string,
  data: unknown,
): Promise<ActionResult> {
  const activeUser = await requireRole("Super Admin");

  if (!id || typeof id !== "string") {
    return { success: false, error: "ID konfigurasi tidak valid" };
  }

  // Validate input
  const parsed = kprSlaConfigSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { success: false, error: firstIssue?.message ?? "Data tidak valid" };
  }

  const input = parsed.data;
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      // Fetch existing config
      const existing = await tx
        .select()
        .from(kprSlaConfigs)
        .where(eq(kprSlaConfigs.id, id))
        .limit(1);

      if (existing.length === 0) {
        throw new Error("Konfigurasi SLA tidak ditemukan");
      }

      const oldConfig = existing[0];

      // If changing scope+stage+projectId to a combination that already has an active config,
      // check for duplicates (only if the config is active)
      if (input.isActive) {
        const isSameCombination =
          oldConfig.scope === input.scope &&
          oldConfig.projectId === (input.projectId ?? null) &&
          oldConfig.stage === input.stage;

        if (!isSameCombination) {
          const dupError = await checkDuplicate(
            input.scope,
            input.projectId ?? null,
            input.stage,
            id,
          );
          if (dupError) {
            throw new Error(dupError);
          }
        }
      }

      // Update
      await tx
        .update(kprSlaConfigs)
        .set({
          scope: input.scope,
          projectId: input.projectId ?? null,
          stage: input.stage as ConfigStage,
          workingDays: input.workingDays,
          isActive: input.isActive,
          updatedBy: activeUser.id,
          updatedAt: now,
        })
        .where(eq(kprSlaConfigs.id, id));

      // Audit record — atomik
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        userId: activeUser.id,
        action: "update_kpr_sla_config",
        module: "kpr_sla",
        entityId: id,
        entityType: "kpr_sla_config",
        details: {
          before: {
            scope: oldConfig.scope,
            projectId: oldConfig.projectId,
            stage: oldConfig.stage,
            workingDays: oldConfig.workingDays,
            isActive: oldConfig.isActive,
          },
          after: {
            scope: input.scope,
            projectId: input.projectId,
            stage: input.stage,
            workingDays: input.workingDays,
            isActive: input.isActive,
          },
        },
        createdAt: now,
      });
    });

    revalidatePath("/master/kpr-sla");
    return { success: true };
  } catch (err) {
    if (isUniqueViolation(err)) {
      const friendlyMsg = getFriendlyDuplicateMessage(input.scope);
      return { success: false, error: friendlyMsg };
    }
    return {
      success: false,
      error: parseServerError(err, "Gagal memperbarui konfigurasi SLA. Silakan coba lagi."),
    };
  }
}

// ─── SET ACTIVE ─────────────────────────────────────────────────────────────

/**
 * Aktifkan/nonaktifkan Master_SLA config. Super Admin only.
 */
export async function setKprSlaConfigActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const activeUser = await requireRole("Super Admin");

  if (!id || typeof id !== "string") {
    return { success: false, error: "ID konfigurasi tidak valid" };
  }

  if (typeof isActive !== "boolean") {
    return { success: false, error: "Status aktif tidak valid" };
  }

  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      // Fetch existing config
      const existing = await tx
        .select()
        .from(kprSlaConfigs)
        .where(eq(kprSlaConfigs.id, id))
        .limit(1);

      if (existing.length === 0) {
        throw new Error("Konfigurasi SLA tidak ditemukan");
      }

      const oldConfig = existing[0];

      // If activating, check for duplicate active config
      if (isActive && !oldConfig.isActive) {
        const dupError = await checkDuplicate(
          oldConfig.scope,
          oldConfig.projectId,
          oldConfig.stage,
          id,
        );
        if (dupError) {
          throw new Error(dupError);
        }
      }

      // Update active status
      await tx
        .update(kprSlaConfigs)
        .set({
          isActive,
          updatedBy: activeUser.id,
          updatedAt: now,
        })
        .where(eq(kprSlaConfigs.id, id));

      // Audit record — atomik
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        userId: activeUser.id,
        action: "set_kpr_sla_config_active",
        module: "kpr_sla",
        entityId: id,
        entityType: "kpr_sla_config",
        details: {
          scope: oldConfig.scope,
          projectId: oldConfig.projectId,
          stage: oldConfig.stage,
          previousActive: oldConfig.isActive,
          newActive: isActive,
        },
        createdAt: now,
      });
    });

    revalidatePath("/master/kpr-sla");
    return { success: true };
  } catch (err) {
    if (isUniqueViolation(err)) {
      const friendlyMsg = getFriendlyDuplicateMessage("global");
      return { success: false, error: friendlyMsg };
    }
    return {
      success: false,
      error: parseServerError(err, "Gagal mengubah status konfigurasi SLA. Silakan coba lagi."),
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check for duplicate active config at application level.
 * Returns friendly Indonesian error message, or null if no duplicate.
 */
async function checkDuplicate(
  scope: "global" | "perumahan",
  projectId: string | null,
  stage: string,
  excludeId?: string,
): Promise<string | null> {
  const conditions = [
    eq(kprSlaConfigs.scope, scope),
    eq(kprSlaConfigs.stage, stage as ConfigStage),
    eq(kprSlaConfigs.isActive, true),
  ];

  if (scope === "perumahan" && projectId) {
    conditions.push(eq(kprSlaConfigs.projectId, projectId));
  }

  const existing = await db
    .select({ id: kprSlaConfigs.id })
    .from(kprSlaConfigs)
    .where(and(...conditions))
    .limit(1);

  if (existing.length > 0 && existing[0].id !== excludeId) {
    return getFriendlyDuplicateMessage(scope);
  }

  return null;
}

function getFriendlyDuplicateMessage(scope: "global" | "perumahan"): string {
  return scope === "global"
    ? "SLA global untuk tahap ini sudah tersedia"
    : "SLA perumahan untuk tahap ini sudah tersedia";
}

/**
 * Check if error is a PostgreSQL unique constraint violation (code 23505).
 */
function isUniqueViolation(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code: string }).code === "23505";
  }
  return false;
}

// ─── RECONCILIATION ──────────────────────────────────────────────────────────

import {
  reconcileHistoricalKpr,
  type ReconciliationOptions,
  type ReconciliationResult,
} from "@/server/services/kpr-sla/reconciliation";

/**
 * Rekonsiliasi KPR historis — admin action eksplisit.
 *
 * Hanya Super Admin yang dapat menjalankan rekonsiliasi.
 * Tidak pernah dipanggil oleh read Kanban/Detail atau migration.
 *
 * @param options.dryRun - true: hanya menghitung tanpa persist
 * @param options.kprIds - optional: filter KPR tertentu
 *
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8**
 */
export async function reconcileKprSla(
  options: ReconciliationOptions,
): Promise<ActionResult<ReconciliationResult>> {
  const activeUser = await requireRole("Super Admin");

  try {
    const result = await reconcileHistoricalKpr(options);

    // Audit the reconciliation execution
    const now = new Date();
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId: activeUser.id,
      action: options.dryRun
        ? "reconcile_kpr_sla_dry_run"
        : "reconcile_kpr_sla_execute",
      module: "kpr_sla",
      entityId: null,
      entityType: "kpr_sla_reconciliation",
      details: {
        dryRun: options.dryRun,
        kprIds: options.kprIds ?? null,
        result: {
          created: result.created,
          skipped: result.skipped,
          failed: result.failed,
          unreconciled: result.unreconciled,
        },
      },
      createdAt: now,
    });

    return { success: true, data: result };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal menjalankan rekonsiliasi SLA";
    console.error(
      JSON.stringify({
        event: "kpr_sla_reconciliation_action_error",
        dryRun: options.dryRun,
        error: message,
      }),
    );
    return { success: false, error: message };
  }
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────

import {
  getStageVisitsTimeline,
  type StageVisitRow,
} from "@/server/services/kpr-sla/queries";

export interface TimelineVisitRow extends StageVisitRow {
  actorName: string | null;
}

/**
 * Ambil timeline SLA untuk satu KPR process (urut terbaru→terlama).
 * Digunakan oleh Detail_KPR / Timeline_SLA client component.
 * Semua pengguna terautentikasi yang memiliki akses KPR dapat membaca.
 *
 * **Validates: Requirements 15.1, 15.2, 15.4**
 */
export async function getKprSlaTimeline(
  kprProcessId: string,
): Promise<ActionResult<TimelineVisitRow[]>> {
  try {
    await requireAuth();
  } catch {
    return { success: false, error: "Sesi berakhir. Silakan login kembali." };
  }

  if (!kprProcessId || typeof kprProcessId !== "string") {
    return { success: false, error: "ID proses KPR tidak valid." };
  }

  try {
    const visits = await getStageVisitsTimeline(kprProcessId);

    // Batch-fetch actor names for all unique actor IDs
    const actorIds = [
      ...new Set(
        visits
          .map((v) => v.transitionActorId)
          .filter((id): id is string => id !== null),
      ),
    ];

    let actorMap = new Map<string, string>();
    if (actorIds.length > 0) {
      const actors = await db
        .select({ id: userTable.id, name: userTable.name })
        .from(userTable)
        .where(inArray(userTable.id, actorIds));
      actorMap = new Map(actors.map((a) => [a.id, a.name]));
    }

    const data: TimelineVisitRow[] = visits.map((v) => ({
      ...v,
      actorName: v.transitionActorId
        ? actorMap.get(v.transitionActorId) ?? null
        : null,
    }));

    return { success: true, data };
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "sla_timeline_fetch_error",
        kprProcessId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { success: false, error: "Gagal memuat timeline SLA." };
  }
}
