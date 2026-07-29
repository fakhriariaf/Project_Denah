"use client";

import { cn } from "@/lib/utils";
import type { InvoiceDocumentContextKind } from "@/lib/finance-invoice-summary";

/**
 * FinanceDocumentContextBadge
 *
 * Displays a badge indicating the document context of an invoice:
 * - Customer: Sage Green primary theme (bg-primary/10, primary text, border)
 * - Internal: Amber/warning theme (amber bg, darker text, border)
 * - Neutral: Gray/muted theme (muted bg, muted text, border)
 *
 * All badges ALWAYS have a text label — color is never the sole differentiator.
 * This ensures accessibility compliance (WCAG: information not conveyed by color alone).
 *
 * Requirements: 2.3, 2.4, 5.4
 */

export interface FinanceDocumentContextBadgeProps {
  /** The document context variant from getInvoiceDocumentContext helper. */
  variant: InvoiceDocumentContextKind;
  /**
   * Optional override label.
   * Defaults:
   * - customer → "Invoice Customer"
   * - internal → "Pengeluaran Internal"
   * - neutral → "Dokumen Keuangan"
   */
  label?: string;
  /** Additional className for custom styling. */
  className?: string;
}

/** Default labels per variant in Bahasa Indonesia. */
const DEFAULT_LABELS: Record<InvoiceDocumentContextKind, string> = {
  customer: "Invoice Customer",
  internal: "Pengeluaran Internal",
  neutral: "Dokumen Keuangan",
};

/**
 * Tailwind classes per variant.
 * Each variant uses distinct background, text color, AND border
 * so the badge is identifiable without relying on color alone.
 */
const VARIANT_STYLES: Record<InvoiceDocumentContextKind, string> = {
  customer:
    "bg-primary/10 text-primary border-primary/30",
  internal:
    "bg-amber-50 text-amber-800 border-amber-300/60",
  neutral:
    "bg-muted text-muted-foreground border-border",
};

export function FinanceDocumentContextBadge({
  variant,
  label,
  className,
}: FinanceDocumentContextBadgeProps) {
  const resolvedLabel = label ?? DEFAULT_LABELS[variant] ?? "Dokumen Keuangan";

  return (
    <span
      data-slot="finance-document-context-badge"
      data-variant={variant}
      className={cn(
        // Base badge styles
        "inline-flex items-center justify-center",
        "rounded-md border px-2 py-0.5",
        "text-xs font-medium whitespace-nowrap",
        "select-none shrink-0",
        // Variant-specific styles
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {resolvedLabel}
    </span>
  );
}

export default FinanceDocumentContextBadge;
