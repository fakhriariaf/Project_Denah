/**
 * KPR Stage SLA — Orchestrator (transaksional)
 *
 * Entry point pencatatan SLA. Dipanggil di dalam transaksi caller (tx) —
 * BUKAN pada transaksi terpisah — sehingga kegagalan pencatatan menyebabkan
 * rollback atomik terhadap seluruh operasi mutasi status.
 *
 * Orchestrator tidak melakukan validasi gate bisnis; ia hanya menutup
 * kunjungan lama dan membuka kunjungan baru berdasarkan fromStatus/toStatus
 * yang sudah lolos gate caller.
 *
 * Referensi:
 * - design.md > "Components and Interfaces" > "1. Service Layer" > orchestrator.ts
 * - requirements.md: Req 5, 6, 7, 8, 9, 10.2, 18.6, 18.7, 19
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.6, 5.7, 6.5, 6.6, 7.1, 9.1, 9.2,
 * 9.4, 10.2, 18.6, 18.7, 19.2, 19.4, 19.6**
 */

import type { DbOrTx } from "@/server/types";
import { kprStageVisits, kprSlaConfigs, kprProcesses } from "@/db/schema/marketing";
import { appSettings } from "@/db/schema/system";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  resolveEffectiveSla,
  isMeasuredStage,
  isSlaTerminalStage,
  type MeasuredStage,
} from "./resolver";
import { computeWorkingDayDeadline } from "./working-days";

/**
 * Membuka kunjungan pertama `bi_checking` saat KPR dibuat (Req 6.5/6.6).
 *
 * Dipanggil di dalam transaksi `createBooking` / `updateBooking` SETELAH
 * row `kprProcesses` di-insert dengan status `bi_checking`.
 *
 * Jika resolusi SLA atau pembuatan snapshot gagal, error dilempar dan
 * transaksi caller wajib rollback — KPR tidak boleh dibuat tanpa snapshot
 * awal (Req 6.6).
 */
export async function openInitialStageVisit(
  tx: DbOrTx,
  input: {
    kprProcessId: string;
    projectId: string;
    enteredAt: Date;
    actorId: string;
    /**
     * Whether to sync legacy fields (sla_start_at, sla_deadline_at).
     * Defaults to true (pre-cutover). Set to false after cutover.
     */
    syncLegacy?: boolean;
  },
): Promise<void> {
  const { kprProcessId, projectId, enteredAt, actorId, syncLegacy } = input;
  const shouldSyncLegacy = syncLegacy !== false;
  const stage: MeasuredStage = "bi_checking";

  // 1. Resolve effective SLA for bi_checking
  const activeConfigs = await tx
    .select({
      id: kprSlaConfigs.id,
      scope: kprSlaConfigs.scope,
      projectId: kprSlaConfigs.projectId,
      stage: kprSlaConfigs.stage,
      workingDays: kprSlaConfigs.workingDays,
      isActive: kprSlaConfigs.isActive,
    })
    .from(kprSlaConfigs)
    .where(
      and(
        eq(kprSlaConfigs.isActive, true),
        eq(kprSlaConfigs.stage, stage),
        sql`(${kprSlaConfigs.projectId} = ${projectId} OR ${kprSlaConfigs.scope} = 'global')`,
      ),
    );

  // Get legacy kpr_sla_days from app_settings
  const legacySetting = await tx
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, "kpr_sla_days"))
    .then((rows) => rows[0]?.value ?? null);

  const resolved = resolveEffectiveSla({
    projectId,
    stage,
    activeConfigs: activeConfigs as Array<{
      id: string;
      scope: "global" | "perumahan";
      projectId: string | null;
      stage: MeasuredStage;
      workingDays: number;
      isActive: boolean;
    }>,
    legacyDays: legacySetting,
  });

  // 2. Compute deadline
  const deadline = computeWorkingDayDeadline(enteredAt, resolved.workingDays);

  // 3. Create initial stage visit (visitSeq = 1 for new KPR)
  const visitId = crypto.randomUUID();

  await tx.insert(kprStageVisits).values({
    id: visitId,
    kprProcessId,
    projectId,
    stage,
    visitSeq: 1,
    status: "active",
    previousStage: null,
    nextStage: null,
    enteredAt,
    exitedAt: null,
    targetWorkingDays: resolved.workingDays,
    slaSource: resolved.source,
    configId: resolved.configId,
    slaStartAt: enteredAt,
    slaDeadlineAt: deadline,
    slaResult: null,
    transitionActorId: actorId,
    revisionNotes: null,
    dataQuality: "normal",
    createdAt: new Date(),
  });

  // 4. Sync legacy fields on kprProcesses (Req 10.2) — only if pre-cutover
  if (shouldSyncLegacy) {
    await tx
      .update(kprProcesses)
      .set({
        slaStartAt: enteredAt,
        slaDeadlineAt: deadline,
        updatedAt: new Date(),
      })
      .where(eq(kprProcesses.id, kprProcessId));
  }
}

export interface StageTransitionInput {
  kprProcessId: string;
  projectId: string;
  fromStatus: string;
  toStatus: string;
  at: Date;
  actorId: string;
  revisionNotes?: string | null;
  /**
   * Whether to sync legacy fields (sla_start_at, sla_deadline_at) on kpr_processes.
   * - true (default, pre-cutover): syncs legacy fields alongside tracking writes
   * - false (post-cutover): stops syncing legacy fields (they become read-only archive)
   *
   * Callers should pass `!cutoverActive` to disable legacy sync after cutover.
   */
  syncLegacy?: boolean;
}

/**
 * Satu-satunya entry pencatatan SLA untuk transisi antar-tahap.
 * Dipanggil di dalam transaksi caller SETELAH update status berhasil.
 *
 * - fromStatus == toStatus → no-op (Req 5.6)
 * - toStatus terminal (rejected/akad/realisasi) → tutup kunjungan aktif,
 *   tanpa snapshot baru (Req 9)
 * - toStatus terukur → tutup kunjungan aktif (bila ada) + buka kunjungan
 *   baru (Req 7)
 *
 * Selalu menyinkronkan field legacy (Req 10.2/10.3).
 */
export async function applyStageTransitionTracking(
  tx: DbOrTx,
  input: StageTransitionInput,
): Promise<void> {
  const { kprProcessId, projectId, fromStatus, toStatus, at, actorId, revisionNotes, syncLegacy } = input;

  // Default syncLegacy to true (pre-cutover behavior) if not specified
  const shouldSyncLegacy = syncLegacy !== false;

  // No-op jika status tidak berubah (Req 5.6)
  if (fromStatus === toStatus) {
    return;
  }

  // Close active visit if exists
  const activeVisit = await tx
    .select()
    .from(kprStageVisits)
    .where(
      and(
        eq(kprStageVisits.kprProcessId, kprProcessId),
        eq(kprStageVisits.status, "active"),
      ),
    )
    .then((rows) => rows[0] ?? null);

  if (activeVisit) {
    // Determine SLA result
    const slaResult = at.getTime() <= activeVisit.slaDeadlineAt.getTime()
      ? "selesai_tepat_waktu" as const
      : "selesai_terlambat" as const;

    await tx
      .update(kprStageVisits)
      .set({
        status: "closed",
        exitedAt: at,
        nextStage: toStatus,
        slaResult,
        transitionActorId: actorId,
        revisionNotes: revisionNotes ?? null,
      })
      .where(eq(kprStageVisits.id, activeVisit.id));
  }

  // If toStatus is terminal SLA, don't create new snapshot (Req 9.2, 9.4)
  if (isSlaTerminalStage(toStatus)) {
    // Preserve last legacy field values for historical compatibility (Req 10.3)
    return;
  }

  // If toStatus is measured, create new visit
  if (isMeasuredStage(toStatus)) {
    // Get next visitSeq
    const maxSeqRow = await tx
      .select({ maxSeq: sql<number>`COALESCE(MAX(${kprStageVisits.visitSeq}), 0)` })
      .from(kprStageVisits)
      .where(eq(kprStageVisits.kprProcessId, kprProcessId))
      .then((rows) => rows[0]);

    const nextSeq = (maxSeqRow?.maxSeq ?? 0) + 1;

    // Resolve SLA for target stage
    const activeConfigs = await tx
      .select({
        id: kprSlaConfigs.id,
        scope: kprSlaConfigs.scope,
        projectId: kprSlaConfigs.projectId,
        stage: kprSlaConfigs.stage,
        workingDays: kprSlaConfigs.workingDays,
        isActive: kprSlaConfigs.isActive,
      })
      .from(kprSlaConfigs)
      .where(
        and(
          eq(kprSlaConfigs.isActive, true),
          eq(kprSlaConfigs.stage, toStatus as MeasuredStage),
          sql`(${kprSlaConfigs.projectId} = ${projectId} OR ${kprSlaConfigs.scope} = 'global')`,
        ),
      );

    const legacySetting = await tx
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, "kpr_sla_days"))
      .then((rows) => rows[0]?.value ?? null);

    const resolved = resolveEffectiveSla({
      projectId,
      stage: toStatus as MeasuredStage,
      activeConfigs: activeConfigs as Array<{
        id: string;
        scope: "global" | "perumahan";
        projectId: string | null;
        stage: MeasuredStage;
        workingDays: number;
        isActive: boolean;
      }>,
      legacyDays: legacySetting,
    });

    const deadline = computeWorkingDayDeadline(at, resolved.workingDays);
    const visitId = crypto.randomUUID();

    await tx.insert(kprStageVisits).values({
      id: visitId,
      kprProcessId,
      projectId,
      stage: toStatus as MeasuredStage,
      visitSeq: nextSeq,
      status: "active",
      previousStage: fromStatus,
      nextStage: null,
      enteredAt: at,
      exitedAt: null,
      targetWorkingDays: resolved.workingDays,
      slaSource: resolved.source,
      configId: resolved.configId,
      slaStartAt: at,
      slaDeadlineAt: deadline,
      slaResult: null,
      transitionActorId: actorId,
      revisionNotes: null,
      dataQuality: "normal",
      createdAt: new Date(),
    });

    // Sync legacy fields (Req 10.2) — only if pre-cutover
    if (shouldSyncLegacy) {
      await tx
        .update(kprProcesses)
        .set({
          slaStartAt: at,
          slaDeadlineAt: deadline,
          updatedAt: new Date(),
        })
        .where(eq(kprProcesses.id, kprProcessId));
    }
  }
}
