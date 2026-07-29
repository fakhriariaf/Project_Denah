/**
 * KPR Stage SLA — Query Layer (Master SLA + Tracking)
 *
 * Menyediakan query untuk list/filter Master_SLA configs, resolusi config aktif,
 * batch active visits (Kanban), dan timeline stage visits (Detail).
 * Semua query dirancang batch-friendly — tidak ada N+1 per-card.
 *
 * **Validates: Requirements 1.1, 2.1, 10.5, 10.6, 10.7, 21.8, 21.9, 21.10, 22.1, 22.2, 22.4**
 */

import { db } from "@/db";
import {
  kprSlaConfigs,
  kprStageVisits,
  kprProcesses,
  bookings,
} from "@/db/schema/marketing";
import { projects, units, customers } from "@/db/schema/master";
import { user } from "@/db/schema/auth";
import { eq, and, inArray, notInArray, lt, desc, SQL, sql } from "drizzle-orm";
import type { MeasuredStage } from "./resolver";
import { SLA_TERMINAL_STAGES } from "./resolver";
import type { ActiveVisitWithContext } from "./notifications";

type ConfigStage = "bi_checking" | "pemberkasan" | "proses_bank" | "offering" | "approved";

export interface KprSlaConfigRow {
  id: string;
  scope: "global" | "perumahan";
  projectId: string | null;
  projectName: string | null;
  stage: string;
  workingDays: number;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KprSlaConfigFilter {
  scope?: "global" | "perumahan";
  stage?: string;
  isActive?: boolean;
}

/**
 * Ambil daftar Master_SLA configs dengan filter opsional.
 * Join projects dan user untuk nama display. Tidak N+1.
 */
export async function getKprSlaConfigsList(
  filter?: KprSlaConfigFilter,
): Promise<KprSlaConfigRow[]> {
  const conditions: SQL[] = [];

  if (filter?.scope) {
    conditions.push(eq(kprSlaConfigs.scope, filter.scope));
  }
  if (filter?.stage) {
    conditions.push(eq(kprSlaConfigs.stage, filter.stage as ConfigStage));
  }
  if (filter?.isActive !== undefined) {
    conditions.push(eq(kprSlaConfigs.isActive, filter.isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: kprSlaConfigs.id,
      scope: kprSlaConfigs.scope,
      projectId: kprSlaConfigs.projectId,
      projectName: projects.name,
      stage: kprSlaConfigs.stage,
      workingDays: kprSlaConfigs.workingDays,
      isActive: kprSlaConfigs.isActive,
      createdBy: kprSlaConfigs.createdBy,
      updatedBy: kprSlaConfigs.updatedBy,
      updatedByName: user.name,
      createdAt: kprSlaConfigs.createdAt,
      updatedAt: kprSlaConfigs.updatedAt,
    })
    .from(kprSlaConfigs)
    .leftJoin(projects, eq(kprSlaConfigs.projectId, projects.id))
    .leftJoin(user, eq(kprSlaConfigs.updatedBy, user.id))
    .where(whereClause)
    .orderBy(kprSlaConfigs.updatedAt);

  return rows;
}

/**
 * Ambil config aktif untuk resolusi SLA. Batch query untuk satu projectId+stage
 * atau seluruh config aktif.
 */
export async function getActiveConfigsForResolution(
  projectId: string,
  stage: MeasuredStage,
): Promise<Array<{
  id: string;
  scope: "global" | "perumahan";
  projectId: string | null;
  stage: MeasuredStage;
  workingDays: number;
  isActive: boolean;
}>> {
  const rows = await db
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

  return rows as Array<{
    id: string;
    scope: "global" | "perumahan";
    projectId: string | null;
    stage: MeasuredStage;
    workingDays: number;
    isActive: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Active Visits Batch Query (Kanban)
// ---------------------------------------------------------------------------

/**
 * Row shape returned by getActiveVisitsByKprIds — the active visit for a
 * single KPR process. Contains all columns needed to derive SLA card status
 * and display badge information without additional round-trips.
 */
export interface ActiveVisitRow {
  id: string;
  kprProcessId: string;
  projectId: string;
  stage: string;
  visitSeq: number;
  enteredAt: Date;
  targetWorkingDays: number;
  slaSource: "perumahan" | "global" | "legacy";
  configId: string | null;
  slaStartAt: Date;
  slaDeadlineAt: Date;
}

/**
 * Row shape returned by getStageVisitsTimeline — full visit record for
 * the Detail/Timeline view.
 */
export interface StageVisitRow {
  id: string;
  kprProcessId: string;
  projectId: string;
  stage: string;
  visitSeq: number;
  status: "active" | "closed";
  previousStage: string | null;
  nextStage: string | null;
  enteredAt: Date;
  exitedAt: Date | null;
  targetWorkingDays: number;
  slaSource: "perumahan" | "global" | "legacy";
  configId: string | null;
  slaStartAt: Date;
  slaDeadlineAt: Date;
  slaResult: "selesai_tepat_waktu" | "selesai_terlambat" | null;
  transitionActorId: string | null;
  revisionNotes: string | null;
  dataQuality: "normal" | "historis_terbatas";
  createdAt: Date;
}

/**
 * Ambil kunjungan aktif untuk banyak KPR sekaligus (batch), untuk Kanban/KPI.
 *
 * Single query: SELECT ... FROM kpr_stage_visits
 *   WHERE kpr_process_id = ANY($1) AND status = 'active'
 *
 * Returns a Map keyed by kprProcessId → ActiveVisitRow. Setiap KPR paling
 * banyak satu kunjungan aktif (dijamin partial unique index).
 *
 * Jika kprIds kosong, langsung return empty Map (tidak query).
 *
 * **Validates: Requirements 22.1, 22.2**
 */
export async function getActiveVisitsByKprIds(
  kprIds: string[],
): Promise<Map<string, ActiveVisitRow>> {
  if (kprIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      id: kprStageVisits.id,
      kprProcessId: kprStageVisits.kprProcessId,
      projectId: kprStageVisits.projectId,
      stage: kprStageVisits.stage,
      visitSeq: kprStageVisits.visitSeq,
      enteredAt: kprStageVisits.enteredAt,
      targetWorkingDays: kprStageVisits.targetWorkingDays,
      slaSource: kprStageVisits.slaSource,
      configId: kprStageVisits.configId,
      slaStartAt: kprStageVisits.slaStartAt,
      slaDeadlineAt: kprStageVisits.slaDeadlineAt,
    })
    .from(kprStageVisits)
    .where(
      and(
        inArray(kprStageVisits.kprProcessId, kprIds),
        eq(kprStageVisits.status, "active"),
      ),
    );

  const result = new Map<string, ActiveVisitRow>();
  for (const row of rows) {
    result.set(row.kprProcessId, row as ActiveVisitRow);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Stage Visits Timeline Query (Detail)
// ---------------------------------------------------------------------------

/**
 * Ambil seluruh kunjungan satu KPR untuk Timeline (urut terbaru→terlama).
 *
 * Ordered by `enteredAt DESC, visitSeq DESC` — deterministic even when
 * multiple visits share the same enteredAt timestamp.
 *
 * **Validates: Requirements 15.1, 15.4, 6.8**
 */
export async function getStageVisitsTimeline(
  kprProcessId: string,
): Promise<StageVisitRow[]> {
  const rows = await db
    .select({
      id: kprStageVisits.id,
      kprProcessId: kprStageVisits.kprProcessId,
      projectId: kprStageVisits.projectId,
      stage: kprStageVisits.stage,
      visitSeq: kprStageVisits.visitSeq,
      status: kprStageVisits.status,
      previousStage: kprStageVisits.previousStage,
      nextStage: kprStageVisits.nextStage,
      enteredAt: kprStageVisits.enteredAt,
      exitedAt: kprStageVisits.exitedAt,
      targetWorkingDays: kprStageVisits.targetWorkingDays,
      slaSource: kprStageVisits.slaSource,
      configId: kprStageVisits.configId,
      slaStartAt: kprStageVisits.slaStartAt,
      slaDeadlineAt: kprStageVisits.slaDeadlineAt,
      slaResult: kprStageVisits.slaResult,
      transitionActorId: kprStageVisits.transitionActorId,
      revisionNotes: kprStageVisits.revisionNotes,
      dataQuality: kprStageVisits.dataQuality,
      createdAt: kprStageVisits.createdAt,
    })
    .from(kprStageVisits)
    .where(eq(kprStageVisits.kprProcessId, kprProcessId))
    .orderBy(desc(kprStageVisits.enteredAt), desc(kprStageVisits.visitSeq));

  return rows as StageVisitRow[];
}

// ---------------------------------------------------------------------------
// Overdue Active Visits Batch Query (Scanner / Cron)
// ---------------------------------------------------------------------------

/**
 * Ambil SEMUA kunjungan aktif yang sudah melewati tenggat SLA beserta konteks
 * tampilan (konsumen, unit, perumahan) untuk scanner notifikasi per-kunjungan.
 *
 * SATU query batch (join `kpr_stage_visits` → `kpr_processes` → `bookings` →
 * `units` → `customers` → `projects`). Tidak ada N+1, dan query ini READ-ONLY:
 * tidak memutasi tracking, status, maupun legacy field apa pun.
 *
 * Tahap terminal SLA dikecualikan memakai sumber kanonik `SLA_TERMINAL_STAGES`
 * dari `./resolver` — `approved` TETAP dipindai karena tahap terukur.
 *
 * `customers`/`projects` dijoin dengan `leftJoin` supaya baris KPR tidak hilang
 * ketika relasi tampilan tidak lengkap (pola sama dengan scanner legacy).
 *
 * **Validates: Requirements 23.1, 23.2, 23.5, 23.6, 22.1**
 */
export async function getOverdueActiveVisitsWithContext(
  now: Date,
): Promise<ActiveVisitWithContext[]> {
  const rows = await db
    .select({
      kprProcessId: kprStageVisits.kprProcessId,
      visitSeq: kprStageVisits.visitSeq,
      stage: kprStageVisits.stage,
      slaDeadlineAt: kprStageVisits.slaDeadlineAt,
      currentKprStatus: kprProcesses.status,
      customerName: customers.name,
      unitCode: units.code,
      projectName: projects.name,
    })
    .from(kprStageVisits)
    .innerJoin(kprProcesses, eq(kprStageVisits.kprProcessId, kprProcesses.id))
    .innerJoin(bookings, eq(kprProcesses.bookingId, bookings.id))
    .innerJoin(units, eq(bookings.unitId, units.id))
    .leftJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(projects, eq(kprStageVisits.projectId, projects.id))
    .where(
      and(
        eq(kprStageVisits.status, "active"),
        lt(kprStageVisits.slaDeadlineAt, now),
        notInArray(kprProcesses.status, [...SLA_TERMINAL_STAGES]),
      ),
    );

  return rows.map((row) => ({
    kprProcessId: row.kprProcessId,
    visitSeq: row.visitSeq,
    stage: row.stage,
    slaDeadlineAt: row.slaDeadlineAt,
    currentKprStatus: row.currentKprStatus,
    customerName: row.customerName ?? "-",
    unitCode: row.unitCode ?? "-",
    projectName: row.projectName ?? "-",
  }));
}

/**
 * Kumpulan `kprProcessId` yang PUNYA kunjungan aktif di Tracking_SLA.
 *
 * Dipakai scanner dual-read (pre-cutover) untuk mengecualikan KPR yang konteks
 * SLA-nya sudah dimiliki tracking, sehingga satu konteks SLA tidak menghasilkan
 * dua notifikasi (satu dari jalur tracking, satu dari jalur legacy).
 *
 * Sengaja TIDAK memfilter overdue/terminal: begitu sebuah KPR punya kunjungan
 * aktif, jalur tracking adalah pemilik tunggal notifikasi SLA-nya.
 *
 * **Validates: Requirements 25.5, 25.6**
 */
export async function getKprIdsWithActiveVisit(): Promise<Set<string>> {
  const rows = await db
    .select({ kprProcessId: kprStageVisits.kprProcessId })
    .from(kprStageVisits)
    .where(eq(kprStageVisits.status, "active"));

  return new Set(rows.map((row) => row.kprProcessId));
}
