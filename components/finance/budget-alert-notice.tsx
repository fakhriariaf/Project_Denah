"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * BudgetAlertNotice
 *
 * Displays an amber/yellow warning banner when a budget has exceeded 80% absorption.
 * Shows the budget name, percentage, used/total amounts formatted as Rupiah,
 * and a link to the budget detail page.
 *
 * Renders nothing when `budget` is null (no budget exceeds 80%).
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5
 */

export interface BudgetAlertNoticeProps {
  /** Budget with highest absorption > 80%, or null if none qualifies */
  budget: {
    id: string;
    name: string;
    totalAmount: number;
    usedAmount: number;
    absorptionPercentage: number;
  } | null;
}

/** Format percentage to 1 decimal place using id-ID locale */
function formatPercentage(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** Format number as Rupiah using id-ID locale */
function formatRupiahLocal(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function BudgetAlertNotice({ budget }: BudgetAlertNoticeProps) {
  if (!budget) return null;

  const { id, name, totalAmount, usedAmount, absorptionPercentage } = budget;

  return (
    <div
      role="alert"
      className="w-full rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-amber-800 leading-relaxed">
            Anggaran &ldquo;{name}&rdquo; telah mencapai{" "}
            <span className="font-semibold tabular-nums">
              {formatPercentage(absorptionPercentage)}%
            </span>{" "}
            dari alokasi (
            <span className="tabular-nums">
              {formatRupiahLocal(usedAmount)}
            </span>{" "}
            dari{" "}
            <span className="tabular-nums">
              {formatRupiahLocal(totalAmount)}
            </span>
            ).{" "}
            <Link
              href={`/finance/budgets/${id}`}
              className="inline-flex items-center font-medium text-amber-900 underline underline-offset-2 hover:text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 rounded-sm"
            >
              Lihat Detail →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default BudgetAlertNotice;
