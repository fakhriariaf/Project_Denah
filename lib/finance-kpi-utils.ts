/**
 * KPI Percentage Change Utility
 *
 * Pure utility for calculating KPI percentage changes safely.
 * Used by FinanceShell to compute period-over-period comparisons
 * for the 5 summary KPI cards (Kas Masuk, Pengeluaran, Saldo Bersih,
 * Piutang, Anggaran Aktif).
 *
 * Guarantees:
 * - Never returns Infinity, -Infinity, or NaN
 * - Safe for negative baseline values (uses Math.abs(previous) as divisor)
 * - Deterministic and hydration-safe (no Date.now() or browser APIs)
 */

/**
 * Result of a KPI percentage change calculation.
 */
export interface KpiPercentageResult {
  /** Persentase perubahan. null jika tidak dapat dihitung. */
  percentage: number | null;
  /**
   * State kalkulasi:
   * - "neutral": filter "Semua Periode" aktif OR both values are 0
   * - "new_data": previous=0 but current≠0 (data appeared in current period)
   * - "comparable": previous≠0, safe division was performed
   */
  state: "neutral" | "new_data" | "comparable";
}

/**
 * Menghitung persentase perubahan KPI secara safe.
 *
 * @param current - Nilai KPI pada periode aktif
 * @param previous - Nilai KPI pada periode pembanding (M-1)
 * @param isNeutral - Set to `true` when "Semua Periode" is active.
 *   When true, no computation is performed and state is always "neutral".
 *   This prevents meaningless comparisons when no specific period is selected.
 * @returns KpiPercentageResult with percentage and state
 *
 * @remarks
 * **Safe for negative baseline:** Uses `Math.abs(previous)` as the divisor,
 * so a negative net balance (e.g., previous = -500, current = -200) produces
 * a meaningful positive percentage (+60%) instead of a confusing negative one.
 *
 * **Never returns Infinity/NaN:** We explicitly guard against `previous === 0`
 * before performing any division. When previous is zero:
 * - Both zero → state "neutral" (no meaningful comparison)
 * - Only previous zero → state "new_data" (data appeared with no baseline)
 *
 * @example
 * ```ts
 * // "Semua Periode" active → always neutral
 * calculateKpiPercentageChange(1000, 800, true)
 * // → { percentage: null, state: "neutral" }
 *
 * // Normal comparison
 * calculateKpiPercentageChange(1200, 1000)
 * // → { percentage: 20, state: "comparable" }
 *
 * // Previous zero, current non-zero
 * calculateKpiPercentageChange(500, 0)
 * // → { percentage: null, state: "new_data" }
 *
 * // Both zero
 * calculateKpiPercentageChange(0, 0)
 * // → { percentage: null, state: "neutral" }
 * ```
 */
export function calculateKpiPercentageChange(
  current: number,
  previous: number,
  isNeutral?: boolean
): KpiPercentageResult {
  // "Semua Periode" aktif → no computation
  if (isNeutral) {
    return { percentage: null, state: "neutral" };
  }

  // Both zero → no meaningful comparison
  if (previous === 0 && current === 0) {
    return { percentage: null, state: "neutral" };
  }

  // Previous zero, current non-zero → new data appeared
  if (previous === 0 && current !== 0) {
    return { percentage: null, state: "new_data" };
  }

  // Safe division — previous guaranteed non-zero here
  // Uses Math.abs(previous) to handle negative baselines correctly
  const pct = ((current - previous) / Math.abs(previous)) * 100;

  // Guard against overflow to Infinity/-Infinity for extreme float values
  // (e.g., subnormal previous like 5e-324 can cause division overflow)
  if (!Number.isFinite(pct)) {
    return { percentage: null, state: "new_data" };
  }

  return { percentage: pct, state: "comparable" };
}
