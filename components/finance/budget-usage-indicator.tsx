"use client";

import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format-utils";

/**
 * BudgetUsageIndicator
 *
 * Displays budget usage as a progress bar with nominal terpakai/sisa,
 * and visual state based on usage percentage.
 *
 * States:
 * - Normal (<50%): Sage Green progress bar
 * - Peringatan (50-80%): Yellow/amber indicator
 * - Kritis (>80%): Red/danger indicator
 * - Over-budget (>100%): Red progress capped at 100% + "Over Budget" badge + sisa negatif
 *
 * Validates: Requirements 9.5, 9.6
 */

export interface BudgetUsageIndicatorProps {
  /** Total budget amount */
  totalBudget: number;
  /** Amount already used */
  usedAmount: number;
  /** Label for the indicator, e.g., "Serapan Budget" */
  label?: string;
  /** Show terpakai/sisa text details */
  showDetails?: boolean;
  /** Smaller variant for table cells */
  compact?: boolean;
}

type UsageState = "normal" | "peringatan" | "kritis" | "over-budget";

function getUsageState(percentage: number): UsageState {
  if (percentage > 100) return "over-budget";
  if (percentage > 80) return "kritis";
  if (percentage >= 50) return "peringatan";
  return "normal";
}

/** Styling classes for each state */
const stateStyles: Record<
  UsageState,
  { bar: string; text: string; badge?: string }
> = {
  normal: {
    bar: "bg-primary",
    text: "text-primary-foreground",
  },
  peringatan: {
    bar: "bg-warning",
    text: "text-[#8A6D1D]",
  },
  kritis: {
    bar: "bg-destructive",
    text: "text-destructive",
  },
  "over-budget": {
    bar: "bg-destructive",
    text: "text-destructive",
    badge:
      "bg-destructive/10 text-destructive border border-destructive/20",
  },
};

function formatPercentage(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function BudgetUsageIndicator({
  totalBudget,
  usedAmount,
  label = "Serapan Budget",
  showDetails = true,
  compact = false,
}: BudgetUsageIndicatorProps) {
  // Calculate percentage; guard against division by zero
  const percentage = totalBudget > 0 ? (usedAmount / totalBudget) * 100 : 0;
  // Visual progress capped at 100%
  const visualProgress = Math.min(percentage, 100);
  const sisa = totalBudget - usedAmount;
  const state = getUsageState(percentage);
  const styles = stateStyles[state];

  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        {/* Compact progress bar */}
        <div
          className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted flex-shrink-0"
          role="progressbar"
          aria-valuenow={Math.round(visualProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${formatPercentage(percentage)}%`}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              styles.bar
            )}
            style={{ width: `${visualProgress}%` }}
          />
        </div>
        {/* Compact percentage */}
        <span
          className={cn(
            "text-xs tabular-nums font-medium whitespace-nowrap",
            styles.text
          )}
        >
          {formatPercentage(percentage)}%
        </span>
        {/* Over Budget badge in compact */}
        {state === "over-budget" && (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
              styles.badge
            )}
          >
            Over Budget
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Label + percentage row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              styles.text
            )}
          >
            {formatPercentage(percentage)}%
          </span>
          {state === "over-budget" && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                styles.badge
              )}
            >
              Over Budget
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(visualProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${formatPercentage(percentage)}%`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            styles.bar
          )}
          style={{ width: `${visualProgress}%` }}
        />
      </div>

      {/* Details: Terpakai / Sisa */}
      {showDetails && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            Terpakai{" "}
            <span className="font-semibold text-foreground">
              {formatRupiah(usedAmount)}
            </span>{" "}
            dari {formatRupiah(totalBudget)}
          </span>
          <span className={cn("tabular-nums font-semibold", styles.text)}>
            Sisa: {sisa < 0 ? "-" : ""}
            {formatRupiah(Math.abs(sisa))}
          </span>
        </div>
      )}
    </div>
  );
}

export default BudgetUsageIndicator;
