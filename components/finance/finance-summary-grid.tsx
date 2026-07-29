import * as React from "react";
import { cn } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinanceSummaryItem {
  /** Unique key for React rendering */
  key: string;
  /** Display label (Bahasa Indonesia) */
  label: string;
  /** Numeric value in IDR (will be formatted as Rupiah) */
  value: number;
  /** Optional icon rendered alongside the label */
  icon?: React.ReactNode;
  /** Semantic accent for the left border (defaults to primary sage). */
  accent?: "primary" | "success" | "warning" | "danger";
  /** Optional indicator element (e.g. badge, trend arrow) rendered below value */
  indicator?: React.ReactNode;
}

export interface FinanceSummaryGridProps {
  /** Array of summary items to display as cards */
  items: FinanceSummaryItem[];
  /** Accessible label for the grid section */
  "aria-label"?: string;
  /** Additional CSS classes for the grid container */
  className?: string;
  /** Custom empty state message. Defaults to "Belum ada data ringkasan." */
  emptyMessage?: string;
}

// ---------------------------------------------------------------------------
// Rupiah Formatter
// ---------------------------------------------------------------------------

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
});

/**
 * Format a number as Indonesian Rupiah (Rp xxx.xxx).
 * Returns "Rp 0" for zero, handles negatives naturally.
 */
export function formatRupiah(amount: number): string {
  return rupiahFormatter.format(amount);
}

// ---------------------------------------------------------------------------
// FinanceSummaryGrid Component
// ---------------------------------------------------------------------------

/**
 * FinanceSummaryGrid
 *
 * Responsive grid for displaying financial summary cards (kas summary, budget
 * summary, or any aggregate metrics on the Finance Home).
 *
 * Layout:
 * - Desktop (lg / ≥1024px): 4 columns
 * - Tablet (sm / ≥640px): 2 columns
 * - Mobile (<640px): 1 column
 *
 * Design requirements:
 * - Sage Green semantic tokens from globals.css (Req 16.1)
 * - tabular-nums for monetary values (AGENTS.md §5)
 * - Rupiah format id-ID (Req 1.4, 1.5)
 * - Empty state when items array is empty (Req 15.1)
 * - Accessible: proper heading levels, aria labels (Req 16)
 */
export function FinanceSummaryGrid({
  items,
  "aria-label": ariaLabel = "Ringkasan Keuangan",
  className,
  emptyMessage = "Belum ada data ringkasan.",
}: FinanceSummaryGridProps) {
  // Empty state
  if (!items || items.length === 0) {
    return (
      <section aria-label={ariaLabel} className={cn("w-full", className)}>
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground">
            <BarChart3 className="h-6 w-6" />
          </span>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label={ariaLabel} className={cn("w-full", className)}>
      <div
        className={cn(
          "grid grid-cols-1 gap-4 sm:grid-cols-2",
          // Lima KPI adalah pola Home Keuangan. Pada layar lebar semuanya
          // tersusun satu baris; jumlah lain tetap memakai grid empat kolom.
          items.length === 5 ? "lg:grid-cols-4 xl:grid-cols-5" : "lg:grid-cols-4",
        )}
      >
        {items.map((item) => (
          <FinanceSummaryCard key={item.key} item={item} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FinanceSummaryCard (internal)
// ---------------------------------------------------------------------------

function FinanceSummaryCard({ item }: { item: FinanceSummaryItem }) {
  const accentClass = {
    primary: "border-l-primary",
    success: "border-l-emerald-500",
    warning: "border-l-amber-500",
    danger: "border-l-destructive",
  }[item.accent ?? "primary"];

  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border border-border border-l-4 bg-card p-4 shadow-sm transition-shadow hover:shadow-sage",
        accentClass,
      )}
      role="group"
      aria-label={item.label}
    >
      {/* Label with optional icon */}
      <div className="flex items-center gap-2 text-muted-foreground">
        {item.icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-primary">
            {item.icon}
          </span>
        )}
        <span className="text-sm font-medium leading-tight">{item.label}</span>
      </div>

      {/* Rupiah value with tabular-nums */}
      <p className="text-xl font-bold tracking-tight text-foreground tabular-nums sm:text-2xl">
        {formatRupiah(item.value)}
      </p>

      {/* Optional indicator (badge, trend, progress bar) */}
      {item.indicator && <div className="mt-1">{item.indicator}</div>}
    </div>
  );
}

export default FinanceSummaryGrid;
