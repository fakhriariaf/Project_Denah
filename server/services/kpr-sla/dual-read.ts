/**
 * KPR Stage SLA — Dual-Read Mapper & Safe Fetch
 *
 * Implements the dual-read strategy for SLA display on Kanban and Detail views:
 * - Active visit (new tracking) is the primary source when structure is available
 * - Legacy fields are fallback for compatibility when tracking is unavailable
 * - No data at all → "belum_dimulai"
 * - Invalid legacy → safe state without failing
 *
 * Post-cutover behavior (when `cutoverActive = true`):
 * - Tracking_SLA is the ONLY source for active display on non-terminal KPR
 * - Legacy fallback is NOT used; legacy is read-only archive
 * - If tracking unavailable for a non-terminal KPR → error state
 *   ("Data SLA tidak tersedia") instead of silently falling back to legacy
 *
 * IMPORTANT: This module NEVER mutates tracking data, creates hidden records,
 * or changes business status during READ operations. It is purely a display
 * mapper for the presentation layer.
 *
 * **Validates: Requirements 10.5, 10.6, 10.7, 21.8, 21.9, 21.10, 22.1, 22.4, 25.5, 25.6, 25.9, 25.11**
 */

import { classifyActiveSlaStatus, type SlaStatus } from "./working-days";
import { isSlaTerminalStage } from "./resolver";
import type { ActiveVisitRow } from "./queries";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Result of the dual-read display mapper. Contains all information needed by
 * Kanban cards and Detail views to render SLA badges/indicators without
 * additional queries or derived state.
 */
export interface KprSlaDisplayResult {
  /** The computed SLA status for display purposes. */
  status: SlaStatus | "belum_dimulai" | "tidak_berlaku" | "data_legacy_tidak_valid" | "sla_tidak_tersedia";
  /**
   * Source of the SLA data displayed:
   * - "tracking" — from new kpr_stage_visits active visit
   * - "legacy" — from legacy sla_start_at/sla_deadline_at fields
   * - null — no data / terminal / invalid / unavailable
   */
  source: "tracking" | "legacy" | null;
  /** SLA deadline (from tracking or legacy), null if unavailable. */
  deadline: Date | null;
  /** Target working days (from tracking snapshot), null if not available. */
  targetWorkingDays: number | null;
  /** The SLA source recorded in the snapshot (perumahan/global/legacy). */
  slaSource: "perumahan" | "global" | "legacy" | null;
  /** Stage of the active visit, null if using legacy. */
  stage: string | null;
  /** Human-readable error message when status is error-like (post-cutover). */
  errorMessage?: string | null;
}

/**
 * Input for the dual-read mapper. The caller provides all relevant data so
 * the mapper can determine the correct display state without doing I/O.
 */
export interface MapKprSlaDisplayInput {
  /** Active visit row from the new tracking system, or null if not available. */
  activeVisit: ActiveVisitRow | null;
  /** Legacy sla_start_at field from kpr_processes, or null. */
  legacySlaStartAt: Date | null;
  /** Legacy sla_deadline_at field from kpr_processes, or null. */
  legacySlaDeadlineAt: Date | null;
  /** Current KPR process status (e.g. "bi_checking", "rejected"). */
  kprStatus: string;
  /** Current evaluation timestamp (for SLA classification). */
  now: Date;
  /**
   * Whether cutover is active (post-cutover mode).
   * - false (default, pre-cutover): tracking → legacy fallback → belum_dimulai
   * - true (post-cutover): tracking is ONLY source; no legacy fallback;
   *   missing tracking → "sla_tidak_tersedia" error state
   */
  cutoverActive?: boolean;
}

// ---------------------------------------------------------------------------
// Dual-read mapper
// ---------------------------------------------------------------------------

/**
 * Maps KPR SLA data (tracking + legacy) into a display result.
 *
 * Pre-cutover rules (cutoverActive = false, default, in evaluation order):
 * 1. If `kprStatus` is a terminal SLA stage → "tidak_berlaku"
 * 2. If `activeVisit` exists → use as primary source, classify with
 *    `classifyActiveSlaStatus`, return full snapshot info
 * 3. Else if legacy fields exist and are valid dates → use as fallback,
 *    mark source "legacy", classify deadline vs now
 * 4. Else if legacy exists but invalid → "data_legacy_tidak_valid"
 * 5. Else (no data at all) → "belum_dimulai"
 *
 * Post-cutover rules (cutoverActive = true):
 * 1. If `kprStatus` is a terminal SLA stage → "tidak_berlaku"
 * 2. If `activeVisit` exists → use as primary source (same as pre-cutover)
 * 3. Else → "sla_tidak_tersedia" (NO legacy fallback; show error state)
 *
 * NEVER mutates tracking data or creates hidden records during a READ operation.
 *
 * **Validates: Requirements 10.5, 10.6, 10.7, 21.9, 21.10, 25.5, 25.6, 25.9, 25.11**
 */
export function mapKprSlaDisplay(input: MapKprSlaDisplayInput): KprSlaDisplayResult {
  const { activeVisit, legacySlaStartAt, legacySlaDeadlineAt, kprStatus, now, cutoverActive } = input;

  // 1. Terminal SLA status → "tidak_berlaku" (both modes)
  if (isSlaTerminalStage(kprStatus)) {
    return {
      status: "tidak_berlaku",
      source: null,
      deadline: null,
      targetWorkingDays: null,
      slaSource: null,
      stage: null,
    };
  }

  // 2. Active visit exists → primary source (new tracking) — both modes
  if (activeVisit) {
    const classifiedStatus = classifyActiveSlaStatus(
      { slaDeadlineAt: activeVisit.slaDeadlineAt },
      now,
    );

    return {
      status: classifiedStatus,
      source: "tracking",
      deadline: activeVisit.slaDeadlineAt,
      targetWorkingDays: activeVisit.targetWorkingDays,
      slaSource: activeVisit.slaSource,
      stage: activeVisit.stage,
    };
  }

  // POST-CUTOVER: No active visit for non-terminal KPR → error state
  // Legacy fallback is NOT used; tracking is the only source of truth
  if (cutoverActive) {
    return {
      status: "sla_tidak_tersedia",
      source: null,
      deadline: null,
      targetWorkingDays: null,
      slaSource: null,
      stage: null,
      errorMessage: "Data SLA tidak tersedia",
    };
  }

  // PRE-CUTOVER: Legacy fallback path
  // 3. Legacy fields present — validate and use as fallback
  if (legacySlaDeadlineAt !== null || legacySlaStartAt !== null) {
    // Check validity: deadline must be a real Date with a valid timestamp
    const deadlineValid = isValidDate(legacySlaDeadlineAt);

    if (deadlineValid && legacySlaDeadlineAt !== null) {
      // Legacy fallback: classify based on deadline vs now
      const classifiedStatus = classifyActiveSlaStatus(
        { slaDeadlineAt: legacySlaDeadlineAt },
        now,
      );

      return {
        status: classifiedStatus,
        source: "legacy",
        deadline: legacySlaDeadlineAt,
        targetWorkingDays: null, // Legacy doesn't have per-stage target info
        slaSource: "legacy",
        stage: null,
      };
    }

    // 4. Legacy exists but invalid → safe state
    return {
      status: "data_legacy_tidak_valid",
      source: null,
      deadline: null,
      targetWorkingDays: null,
      slaSource: null,
      stage: null,
    };
  }

  // 5. No data at all → belum dimulai
  return {
    status: "belum_dimulai",
    source: null,
    deadline: null,
    targetWorkingDays: null,
    slaSource: null,
    stage: null,
  };
}

// ---------------------------------------------------------------------------
// Safe fetch helper (error wrapping for Kanban/Detail reads)
// ---------------------------------------------------------------------------

/**
 * Result of a safe SLA data fetch. Wraps any SLA read operation in try/catch
 * so that failures display a non-destructive error badge instead of crashing
 * the page or altering business status.
 */
export interface SafeFetchResult<T> {
  data: T | null;
  error: string | null;
}

/**
 * Wraps any asynchronous SLA data fetch in try/catch. If the operation fails,
 * returns `{ data: null, error: "Gagal memuat data SLA" }` instead of
 * propagating the error — ensuring the Kanban/Detail page continues to
 * function and display KPR data without SLA information.
 *
 * The caller (Kanban/Detail pages) uses this to show an SLA error badge
 * without affecting the rest of the KPR display.
 *
 * NEVER modifies business status or creates tracking records on failure.
 *
 * **Validates: Requirements 21.8, 21.9, 21.10, 22.4**
 */
export async function safeFetchSlaData<T>(
  fn: () => Promise<T>,
): Promise<SafeFetchResult<T>> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch {
    return { data: null, error: "Gagal memuat data SLA" };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Checks if a value is a valid Date object with a real timestamp.
 * Returns false for null, undefined, and Date objects with NaN time.
 */
function isValidDate(value: Date | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (!(value instanceof Date)) {
    return false;
  }
  return !Number.isNaN(value.getTime());
}
