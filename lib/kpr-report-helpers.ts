/**
 * KPR report helpers — pure, DB-free predicates shared by the SQL query
 * builder in `server/actions/reports.ts` (`getKprReportsData`) and its
 * regression tests.
 *
 * The terminal stage list is NOT declared here. It is imported from
 * `server/services/kpr-sla/resolver.ts` (`SLA_TERMINAL_STAGES`), the single
 * canonical stage domain — see "Stage Domain — Source of Truth" in
 * `.kiro/specs/kpr-stage-sla-master-data/design.md`. `resolver.ts` is a pure
 * domain module (no DB / Node / server-action imports), so importing it from
 * `lib/` keeps these helpers DB-free and client-safe.
 *
 * `KPR_SLA_TERMINAL_STATUSES` / `KprSlaTerminalStatus` remain exported as
 * aliases for existing consumers (report query builder + regression tests).
 *
 * Terminal SLA stages stop being measured: `rejected`, `akad`, `realisasi`.
 * `approved` is intentionally NOT terminal — it is a measured/active SLA
 * stage and must keep counting as overdue-eligible and as "aktif".
 *
 * **Validates: Requirements 26.10, 26.11, 26.12, 26.13, 26.14**
 */

import {
  SLA_TERMINAL_STAGES,
  isSlaTerminalStage,
  type SlaTerminalStage,
} from "@/server/services/kpr-sla/resolver";

export { SLA_TERMINAL_STAGES as KPR_SLA_TERMINAL_STATUSES };

export type KprSlaTerminalStatus = SlaTerminalStage;

/**
 * Total predicate: is `status` one of the terminal SLA stages? Terminal
 * stages are excluded from both the overdue count and the "aktif" count.
 * Unknown/unexpected string values are treated as non-terminal (measured),
 * matching the SQL `NOT IN (...)` semantics used by the report query.
 */
export function isKprSlaTerminalStatus(status: string): boolean {
  return isSlaTerminalStage(status);
}

/**
 * A KPR counts toward the overdue KPI when its `slaDeadlineAt` is in the
 * past AND its status is not a terminal SLA stage. `approved` still counts.
 */
export function isKprOverdueEligible(
  status: string,
  slaDeadlineAt: Date | null,
  now: Date,
): boolean {
  if (!slaDeadlineAt) return false;
  if (slaDeadlineAt.getTime() >= now.getTime()) return false;
  return !isKprSlaTerminalStatus(status);
}

/**
 * Sum of `statusMap` counts for every status that is NOT a terminal SLA
 * stage — the "Total KPR Aktif" metric. Uses the exact same terminal list as
 * the overdue predicate above so the two metrics stay consistent.
 */
export function computeTotalKprAktif(statusMap: Record<string, number>): number {
  return Object.entries(statusMap)
    .filter(([status]) => !isKprSlaTerminalStatus(status))
    .reduce((sum, [, cnt]) => sum + cnt, 0);
}
