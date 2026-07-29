import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { KpiPercentageResult } from "@/lib/finance-kpi-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KpiComparisonIndicatorProps {
  /** Result from calculateKpiPercentageChange utility */
  result: KpiPercentageResult;
  /** Label for the comparison period, e.g. "Des 2024". null when unavailable. */
  comparisonLabel: string | null;
  /** true when "Semua Periode" is active — distinguishes neutral reasons */
  isAllPeriod?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format percentage to 1 decimal place.
 * Always returns absolute value (sign is conveyed by arrow direction).
 */
function formatPercentage(value: number): string {
  return Math.abs(value).toFixed(1);
}

// ---------------------------------------------------------------------------
// KpiComparisonIndicator Component
// ---------------------------------------------------------------------------

/**
 * KpiComparisonIndicator
 *
 * Small presentational component showing period-over-period KPI trend.
 * Consumes the output of `calculateKpiPercentageChange` from `lib/finance-kpi-utils.ts`.
 *
 * Display rules:
 * - state "neutral" + both values 0 (comparisonLabel null) → "Belum ada pembanding periode sebelumnya"
 * - state "neutral" + isAllPeriod flag → "Pilih periode untuk melihat perbandingan"
 * - state "new_data" → "Data baru pada periode ini"
 * - state "comparable" + percentage > 0 → TrendingUp + "↑ X.X% dari [label]" (green)
 * - state "comparable" + percentage < 0 → TrendingDown + "↓ X.X% dari [label]" (red)
 * - state "comparable" + percentage === 0 → "Tidak ada perubahan dari [label]"
 *
 * Design:
 * - Arrows ONLY shown when state === "comparable" and percentage !== 0
 * - Text size: text-xs (12px)
 * - Neutral/muted states use text-muted-foreground
 * - No Date.now() or browser-dependent values at render (hydration-safe)
 */
export function KpiComparisonIndicator({
  result,
  comparisonLabel,
  isAllPeriod = false,
}: KpiComparisonIndicatorProps) {
  const { state, percentage } = result;

  // --- Neutral state ---
  if (state === "neutral") {
    // Distinguish: both values 0 (no comparison data) vs "Semua Periode" active
    if (!isAllPeriod && comparisonLabel === null) {
      return (
        <span className="text-xs text-muted-foreground" aria-label="Belum ada pembanding periode sebelumnya">
          Belum ada pembanding periode sebelumnya
        </span>
      );
    }
    return (
      <span className="text-xs text-muted-foreground" aria-label="Pilih periode untuk melihat perbandingan">
        Pilih periode untuk melihat perbandingan
      </span>
    );
  }

  // --- New data state ---
  if (state === "new_data") {
    return (
      <span className="text-xs text-muted-foreground" aria-label="Data baru pada periode ini">
        Data baru pada periode ini
      </span>
    );
  }

  // --- Comparable state ---
  if (state === "comparable" && percentage !== null) {
    const label = comparisonLabel ?? "";

    // Zero change
    if (percentage === 0) {
      return (
        <span className="text-xs text-muted-foreground" aria-label={`Tidak ada perubahan dari ${label}`}>
          Tidak ada perubahan dari {label}
        </span>
      );
    }

    // Positive change
    if (percentage > 0) {
      return (
        <span
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"
          aria-label={`Naik ${formatPercentage(percentage)} persen dari ${label}`}
        >
          <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
          <span>↑ {formatPercentage(percentage)}% dari {label}</span>
        </span>
      );
    }

    // Negative change
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium text-red-600"
        aria-label={`Turun ${formatPercentage(percentage)} persen dari ${label}`}
      >
        <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
        <span>↓ {formatPercentage(percentage)}% dari {label}</span>
      </span>
    );
  }

  // Fallback (should not be reached with well-formed data)
  return null;
}

export default KpiComparisonIndicator;
