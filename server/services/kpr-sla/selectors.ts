/**
 * KPR Stage SLA — Pure UI Selectors
 *
 * Pure, DB-free, framework-free selector functions used by the Kanban/KPI/
 * Timeline UI layer (Phase 4/5) to derive SLA card status, filter cards,
 * aggregate KPI counts scoped by project, order timeline entries, and render
 * a safe fallback state for invalid/missing legacy SLA data.
 *
 * No DB calls, no React/UI framework dependency, no mutation of inputs, and
 * deterministic output for the same input.
 *
 * -----------------------------------------------------------------------
 * Concurrency / reconciliation note (read before editing):
 * -----------------------------------------------------------------------
 * Tasks 2.2 (`resolver.ts`) and 2.3 (`working-days.ts`) were implemented in
 * parallel with this file. To avoid coupling this module's compilation to
 * those in-flight modules, this file intentionally DEFINES ITS OWN local,
 * minimal input types (`KprSlaCardInput`, `KprSlaActiveSnapshotInput`, etc.)
 * instead of importing `SlaStatus` / `ResolvedSla` / `MeasuredStage` / etc.
 * from `resolver.ts` / `working-days.ts`.
 *
 * One design choice follows from this:
 *
 * - Active-visit boundary classification (tepat_waktu / perlu_dicek /
 *    jatuh_tempo_hari_ini / terlambat) requires working-day-aware boundary
 *    math (target working days vs. remaining working days before the
 *    deadline). That logic belongs to task 2.3 (`working-days.ts`,
 *    `classifyActiveSlaStatus`). To avoid duplicating it here, this module's
 *    `KprSlaActiveSnapshotInput` accepts an OPTIONAL, already-classified
 *    `classifiedStatus` field that the caller is expected to populate using
 *    `working-days.ts` once integrated (Phase 3/4). When `classifiedStatus`
 *    is not supplied, this module falls back to a minimal, clearly-labeled,
 *    working-day-agnostic "deadline vs now" comparison (see
 *    `classifyByDeadlineOnly` below) that only distinguishes
 *    `tepat_waktu` / `jatuh_tempo_hari_ini` / `terlambat` and never produces
 *    `perlu_dicek` (which strictly needs the working-day boundary). This
 *    fallback exists purely so this module remains independently testable
 *    and usable before `working-days.ts` is wired in; it MUST be reconciled
 *    with `working-days.ts` once that module stabilizes (see design.md
 *    Components #1, `classifyActiveSlaStatus`).
 *
 * The terminal stage check, however, is NO LONGER duplicated here: it now
 * imports `isSlaTerminalStage` from `server/services/kpr-sla/resolver.ts`,
 * the single canonical stage domain (see "Stage Domain — Source of Truth" in
 * design.md). `resolver.ts` is a pure domain module (no DB / Node / server
 * action imports), so importing it keeps this module DB-free.
 */

import { isSlaTerminalStage } from "./resolver";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Status_SLA used for a Kanban card / filter / KPI bucket.
 *
 * `selesai_tepat_waktu` and `selesai_terlambat` are included for shape
 * compatibility with the broader Status_SLA union used elsewhere in the
 * feature (closed-visit outcomes shown on the Timeline), but
 * `deriveKprSlaCardStatus` below never returns them — a Kanban card is
 * always either actively tracked, not-yet-started, terminal, or in a safe
 * fallback state.
 */
export type KprSlaCardStatus =
  | "belum_dimulai"
  | "tepat_waktu"
  | "perlu_dicek"
  | "jatuh_tempo_hari_ini"
  | "terlambat"
  | "selesai_tepat_waktu"
  | "selesai_terlambat"
  | "tidak_berlaku"
  | "sla_tidak_tersedia"
  | "data_legacy_tidak_valid";

/** The 7 SLA filter options exposed on the Kanban (Requirement 13.1). */
export type KprSlaFilterValue =
  | "semua_sla"
  | "tepat_waktu"
  | "perlu_dicek"
  | "jatuh_tempo_hari_ini"
  | "terlambat"
  | "belum_dimulai"
  | "tidak_berlaku";

/** Pre-classified active-visit boundary status (see reconciliation note). */
export type KprSlaActiveBoundaryStatus =
  | "tepat_waktu"
  | "perlu_dicek"
  | "jatuh_tempo_hari_ini"
  | "terlambat";

export interface KprSlaActiveSnapshotInput {
  slaDeadlineAt: Date;
  targetWorkingDays: number;
  source: "perumahan" | "global" | "legacy";
  /**
   * Optional pre-classified boundary status computed by
   * `working-days.ts` (`classifyActiveSlaStatus`). Prefer supplying this
   * once that module is wired in — see module doc comment.
   */
  classifiedStatus?: KprSlaActiveBoundaryStatus;
}

export interface KprSlaCardInput {
  kprId: string;
  projectId: string;
  /** The KPR pipeline stage, e.g. bi_checking, ..., approved, rejected, akad, realisasi. */
  status: string;
  activeSnapshot: KprSlaActiveSnapshotInput | null;
  /** Raw legacy deadline field; may be null/undefined/unparseable. */
  legacySlaDeadlineAt: Date | string | null | undefined;
  now: Date;
}

/** Minimal card shape consumed by the filter/KPI selectors below. */
export interface KprSlaCardLike {
  slaStatus: KprSlaCardStatus;
}

export interface KprSlaKpiCounts {
  tepatWaktu: number;
  perluDicek: number;
  jatuhTempoHariIni: number;
  terlambat: number;
  /** Total KPR Aktif = everything except `tidak_berlaku`. */
  totalAktif: number;
}

export interface LegacySlaFallbackResult {
  /** True when the raw legacy value parses to a usable, valid Date. */
  usable: boolean;
  /** Parsed deadline when `usable` is true; otherwise `null`. */
  deadline: Date | null;
  /**
   * Which safe fallback label key to use when `usable` is false.
   * - `sla_tidak_tersedia`: there is simply no legacy data at all
   *   (null/undefined/empty/whitespace-only).
   * - `data_legacy_tidak_valid`: a legacy value IS present but fails to
   *   parse as a valid date.
   * `null` when `usable` is true (no fallback needed).
   */
  fallbackKey: "sla_tidak_tersedia" | "data_legacy_tidak_valid" | null;
  /** Indonesian display label matching `fallbackKey`, or `null` if usable. */
  fallbackLabel: string | null;
}

// ---------------------------------------------------------------------------
// 5. Safe legacy fallback rendering helper
// ---------------------------------------------------------------------------

/**
 * Given a raw legacy deadline value that might be null/undefined/invalid,
 * returns whether it is usable and, if not, which safe fallback label key
 * applies. Never throws.
 *
 * Validates: Requirements 10.5, 12.6, 12.12
 */
export function resolveLegacySlaFallback(
  raw: Date | string | null | undefined,
): LegacySlaFallbackResult {
  if (raw === null || raw === undefined) {
    return {
      usable: false,
      deadline: null,
      fallbackKey: "sla_tidak_tersedia",
      fallbackLabel: "SLA tidak tersedia",
    };
  }

  if (typeof raw === "string" && raw.trim() === "") {
    return {
      usable: false,
      deadline: null,
      fallbackKey: "sla_tidak_tersedia",
      fallbackLabel: "SLA tidak tersedia",
    };
  }

  let parsed: Date;
  try {
    parsed = raw instanceof Date ? raw : new Date(raw);
  } catch {
    return {
      usable: false,
      deadline: null,
      fallbackKey: "data_legacy_tidak_valid",
      fallbackLabel: "Data SLA Lama Tidak Valid",
    };
  }

  if (Number.isNaN(parsed.getTime())) {
    return {
      usable: false,
      deadline: null,
      fallbackKey: "data_legacy_tidak_valid",
      fallbackLabel: "Data SLA Lama Tidak Valid",
    };
  }

  return { usable: true, deadline: parsed, fallbackKey: null, fallbackLabel: null };
}

// ---------------------------------------------------------------------------
// Internal: minimal, working-day-agnostic deadline classification
// ---------------------------------------------------------------------------

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Minimal fallback classification used only when the caller has not yet
 * supplied a working-day-aware `classifiedStatus` (see module doc comment).
 * Intentionally cannot produce `perlu_dicek`, since that requires working-day
 * boundary math owned by `working-days.ts`.
 */
function classifyByDeadlineOnly(deadline: Date, now: Date): KprSlaActiveBoundaryStatus {
  if (now.getTime() > deadline.getTime()) {
    return "terlambat";
  }
  if (isSameCalendarDay(deadline, now)) {
    return "jatuh_tempo_hari_ini";
  }
  return "tepat_waktu";
}

// ---------------------------------------------------------------------------
// 1. Card status derivation
// ---------------------------------------------------------------------------

/**
 * Derives a Kanban card's SLA status for filtering/KPI purposes.
 *
 * Rules (Requirements 10.5, 10.6, 12.6, 12.7, 12.12):
 * - Terminal SLA stage (`rejected`, `akad`, `realisasi`) -> `tidak_berlaku`,
 *   regardless of snapshot/legacy state.
 * - No `activeSnapshot` and no usable legacy deadline -> `belum_dimulai`
 *   (never a misleading "0 hari" value).
 * - No `activeSnapshot` but legacy deadline exists and is a valid parseable
 *   date -> classified using the legacy deadline (source is implicitly
 *   `legacy`; the boundary classification itself is working-day-agnostic
 *   here, see module doc comment).
 * - No `activeSnapshot`, legacy deadline exists but is NOT parseable/valid
 *   -> `data_legacy_tidak_valid` (safe fallback, never throws, never "0 hari").
 * - `activeSnapshot` present -> uses `classifiedStatus` if supplied, else a
 *   minimal deadline-only fallback classification.
 *
 * Pure: no DB calls, no mutation of `input`, deterministic for the same
 * input (including `now`). Never throws.
 */
export function deriveKprSlaCardStatus(input: KprSlaCardInput): KprSlaCardStatus {
  if (isSlaTerminalStage(input.status)) {
    return "tidak_berlaku";
  }

  if (input.activeSnapshot) {
    const { classifiedStatus, slaDeadlineAt } = input.activeSnapshot;
    return classifiedStatus ?? classifyByDeadlineOnly(slaDeadlineAt, input.now);
  }

  const legacy = resolveLegacySlaFallback(input.legacySlaDeadlineAt);
  if (!legacy.usable) {
    // No legacy data at all -> belum_dimulai (counts toward Total KPR Aktif).
    // Legacy value present but unparseable -> safe "invalid" fallback state.
    return legacy.fallbackKey === "data_legacy_tidak_valid"
      ? "data_legacy_tidak_valid"
      : "belum_dimulai";
  }

  return classifyByDeadlineOnly(legacy.deadline as Date, input.now);
}

// ---------------------------------------------------------------------------
// Filter <-> KPI bucket mapping
// ---------------------------------------------------------------------------

/**
 * Maps every `KprSlaCardStatus` to one of the 7 filter buckets used by
 * `filterKprSlaCardsByStatus` and `aggregateKprSlaKpi`, so the two selectors
 * stay consistent by construction (Property 10 in design.md, task 2.6).
 *
 * `sla_tidak_tersedia` and `data_legacy_tidak_valid` are safe display states
 * for cards with no active tracking data; for filtering/KPI purposes they are
 * treated the same as `belum_dimulai` (still counted in Total KPR Aktif, not
 * `tidak_berlaku`). `selesai_tepat_waktu`/`selesai_terlambat` are closed-visit
 * (Timeline) outcomes that never appear on a Kanban card; they are mapped to
 * `null` (no card filter bucket) so this function stays total without
 * silently misclassifying data it should never receive in this context.
 */
function toKprSlaFilterBucket(
  status: KprSlaCardStatus,
): Exclude<KprSlaFilterValue, "semua_sla"> | null {
  switch (status) {
    case "tepat_waktu":
    case "perlu_dicek":
    case "jatuh_tempo_hari_ini":
    case "terlambat":
    case "tidak_berlaku":
      return status;
    case "belum_dimulai":
    case "sla_tidak_tersedia":
    case "data_legacy_tidak_valid":
      return "belum_dimulai";
    case "selesai_tepat_waktu":
    case "selesai_terlambat":
      return null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// 2. Filter predicate
// ---------------------------------------------------------------------------

/**
 * Returns the subset of `cards` matching the selected SLA filter value.
 * `"semua_sla"` returns every card unfiltered. Pure: never mutates `cards`.
 *
 * Validates: Requirements 12.6, 12.7, 12.12 (bucket consistency), and the
 * 7-filter contract from design.md (Property 9/10).
 */
export function filterKprSlaCardsByStatus<T extends KprSlaCardLike>(
  cards: readonly T[],
  filter: KprSlaFilterValue,
): T[] {
  if (filter === "semua_sla") {
    return [...cards];
  }
  return cards.filter((card) => toKprSlaFilterBucket(card.slaStatus) === filter);
}

// ---------------------------------------------------------------------------
// 3. KPI aggregation scoped by project
// ---------------------------------------------------------------------------

/**
 * Aggregates SLA KPI counts for a list of cards (caller is expected to have
 * already scoped/filtered the list by project if a project scope is
 * desired). `totalAktif` counts every card except `tidak_berlaku`, so cards
 * classified `belum_dimulai` (no snapshot, no legacy, or invalid legacy) are
 * included in the active total rather than being dropped or shown as a
 * misleading "0 hari" entry.
 *
 * Pure: never mutates `cards`. Counts are computed via the same
 * `toKprSlaFilterBucket` mapping used by `filterKprSlaCardsByStatus`, so the
 * count for e.g. "Terlambat" always equals
 * `filterKprSlaCardsByStatus(cards, "terlambat").length` for the same input.
 */
export function aggregateKprSlaKpi(cards: readonly KprSlaCardLike[]): KprSlaKpiCounts {
  let tepatWaktu = 0;
  let perluDicek = 0;
  let jatuhTempoHariIni = 0;
  let terlambat = 0;
  let totalAktif = 0;

  for (const card of cards) {
    const bucket = toKprSlaFilterBucket(card.slaStatus);
    if (bucket !== "tidak_berlaku") {
      totalAktif += 1;
    }
    switch (bucket) {
      case "tepat_waktu":
        tepatWaktu += 1;
        break;
      case "perlu_dicek":
        perluDicek += 1;
        break;
      case "jatuh_tempo_hari_ini":
        jatuhTempoHariIni += 1;
        break;
      case "terlambat":
        terlambat += 1;
        break;
      default:
        break;
    }
  }

  return { tepatWaktu, perluDicek, jatuhTempoHariIni, terlambat, totalAktif };
}

// ---------------------------------------------------------------------------
// 4. Timeline ordering
// ---------------------------------------------------------------------------

export interface TimelineOrderable {
  enteredAt: Date;
}

/**
 * Sorts stage-visit-like records newest-to-oldest by `enteredAt`, breaking
 * ties deterministically using `secondaryKey` (e.g. `visitSeq` or `id`).
 * Higher secondary-key values are treated as more recent and sort first on
 * a tie, matching design.md Property 11's `(enteredAt, visitSeq)` ordering
 * (a higher `visitSeq` is a later/newer visit).
 *
 * Pure: returns a new array; never mutates `visits`.
 */
export function sortStageVisitsNewestFirst<T extends TimelineOrderable>(
  visits: readonly T[],
  secondaryKey: (visit: T) => string | number,
): T[] {
  return [...visits].sort((a, b) => {
    const timeDiff = b.enteredAt.getTime() - a.enteredAt.getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    const keyA = secondaryKey(a);
    const keyB = secondaryKey(b);
    if (keyA === keyB) {
      return 0;
    }
    // Descending secondary key: larger key (newer visit) comes first.
    return keyA > keyB ? -1 : 1;
  });
}
