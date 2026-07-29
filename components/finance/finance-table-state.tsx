"use client";

import type { ReactNode } from "react";
import { AlertCircle, FileSearch, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * FinanceTableState
 *
 * Unified empty/loading/error state component for finance tables.
 * Provides contextual feedback depending on the active tab and filter state.
 *
 * Requirements:
 * - 15.1: Empty state shows icon and message mentioning active tab/filter.
 * - 15.2: Loading uses Sage Green skeleton consistent with design tokens.
 * - 15.3: Error does not expose technical details, provides retry, preserves tab/filter.
 * - 15.4: No blank table without explanation.
 *
 * Accessibility:
 * - aria-live="polite" on state container for screen reader announcements.
 * - role="status" for loading state.
 * - retry button is keyboard accessible with visible focus ring.
 */

export interface FinanceTableStateProps {
  /** The state variant to display. */
  variant: "empty" | "loading" | "error";
  /** Title text. Defaults vary by variant. */
  title?: string;
  /** Description text. Defaults vary by variant. */
  description?: string;
  /** Context string for the active tab/filter, e.g. "Invoice & Tagihan - Belum Lunas". */
  filterContext?: string;
  /** Retry callback for error state. */
  onRetry?: () => void;
  /** Number of skeleton table rows to show in loading state. Defaults to 5. */
  columns?: number;
  /** Optional icon override for empty state. */
  icon?: ReactNode;
  /** Additional className for the outer container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Default labels per variant
// ---------------------------------------------------------------------------

function getDefaultTitle(variant: FinanceTableStateProps["variant"]): string {
  switch (variant) {
    case "empty":
      return "Tidak ada data";
    case "loading":
      return "Memuat data...";
    case "error":
      return "Gagal memuat data";
  }
}

function getDefaultDescription(
  variant: FinanceTableStateProps["variant"],
  filterContext?: string,
): string {
  switch (variant) {
    case "empty":
      return filterContext
        ? `Tidak ada data untuk ${filterContext}. Coba ubah filter atau pencarian.`
        : "Tidak ada data yang sesuai dengan filter aktif.";
    case "loading":
      return "Sedang memuat data keuangan...";
    case "error":
      return "Terjadi kendala saat memuat data. Silakan coba lagi.";
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyVariant({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      aria-live="polite"
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary/60 border border-border/50 text-primary shadow-sm">
        {icon ?? <FileSearch className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function LoadingVariant({ columns = 5 }: { columns: number }) {
  return (
    <div role="status" aria-label="Memuat data" className="space-y-3 p-4">
      {/* Summary skeleton row */}
      <div className="flex gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            key={`summary-${i}`}
            className="h-16 flex-1 rounded-lg bg-primary/10"
          />
        ))}
      </div>

      {/* Table header skeleton */}
      <div className="flex gap-3">
        {Array.from({ length: Math.min(columns, 6) }).map((_, i) => (
          <Skeleton
            key={`header-${i}`}
            className="h-8 flex-1 rounded-md bg-primary/10"
          />
        ))}
      </div>

      {/* Table row skeletons */}
      {Array.from({ length: 5 }).map((_, rowIdx) => (
        <div key={`row-${rowIdx}`} className="flex gap-3">
          {Array.from({ length: Math.min(columns, 6) }).map((_, colIdx) => (
            <Skeleton
              key={`cell-${rowIdx}-${colIdx}`}
              className="h-10 flex-1 rounded-md bg-primary/10"
            />
          ))}
        </div>
      ))}

      {/* Accessible loading text (screen readers) */}
      <span className="sr-only">Memuat data keuangan, harap tunggu...</span>
    </div>
  );
}

function ErrorVariant({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive shadow-sm">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-5 gap-1.5"
        >
          <RefreshCw className="h-4 w-4" />
          Coba Lagi
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FinanceTableState({
  variant,
  title,
  description,
  filterContext,
  onRetry,
  columns = 5,
  icon,
  className,
}: FinanceTableStateProps) {
  const resolvedTitle = title ?? getDefaultTitle(variant);
  const resolvedDescription =
    description ?? getDefaultDescription(variant, filterContext);

  return (
    <div
      data-slot="finance-table-state"
      data-variant={variant}
      aria-busy={variant === "loading" ? true : undefined}
      className={cn("w-full", className)}
    >
      {variant === "empty" && (
        <EmptyVariant
          title={resolvedTitle}
          description={resolvedDescription}
          icon={icon}
        />
      )}
      {variant === "loading" && <LoadingVariant columns={columns} />}
      {variant === "error" && (
        <ErrorVariant
          title={resolvedTitle}
          description={resolvedDescription}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}

export default FinanceTableState;
