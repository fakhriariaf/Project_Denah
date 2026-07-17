import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

/**
 * FinanceDetailLayout
 *
 * Standard, composable layout for every finance detail page (invoice, payment,
 * transaction/ledger, expense approval, budget). It fixes the top-to-bottom
 * section order and centralizes the Sage Green / light-theme presentation rules
 * so all five detail pages look and behave identically.
 *
 * Fixed section order (Req 2.1): Header → Summary cards → Detail metadata → Timeline.
 *
 * Design / requirements:
 * - Req 2.1: sections rendered top-to-bottom in a fixed order.
 * - Req 2.2: header contains document number/name (monospace), status badge
 *   (built by the caller via the centralized label helper), project name, a
 *   back button to the parent finance tab, and an optional print/download slot.
 * - Req 2.3: summary cards section (caller-provided content).
 * - Req 2.4: detail metadata section (caller-provided content).
 * - Req 2.8: empty optional fields render "—" (use `orDash` / `FinanceDetailField`)
 *   rather than being omitted.
 * - Req 2.9 / 11.2: monetary values use `tabular-nums` (`FinanceMoney`).
 * - Req 2.10 / 11.3: document identifiers use monospace (`FinanceIdentifier`).
 * - Req 2.11 / 11.6: responsive — 1 col <768px, 2 col 768–1024px, full multi-col
 *   ≥1024px (`FinanceDetailGrid`).
 * - Req 11.5: light theme only — no dark: variants, semantic Sage Green tokens.
 *
 * The layout is intentionally a set of slots: the caller passes the header info,
 * the summary content, the detail-metadata content, and the timeline element
 * (typically a `<FinanceTimeline .../>`). This keeps entity-specific fetching in
 * the page while the layout owns the consistent shell.
 */

const EM_DASH = "\u2014";

/**
 * Small helper for optional fields: returns the value when it is a non-empty
 * string, otherwise the em dash "—" (Req 2.8). Mirrors the label-helpers em dash
 * contract so empty rows are never omitted — they render a placeholder instead.
 */
export function orDash(value: string | number | null | undefined): string {
  if (value == null) return EM_DASH;
  if (typeof value === "number") {
    return Number.isNaN(value) ? EM_DASH : String(value);
  }
  const trimmed = value.trim();
  return trimmed === "" ? EM_DASH : trimmed;
}

export interface FinanceDetailLayoutProps {
  /** Document number / name shown as the header title, rendered monospace (Req 2.2, 2.10). */
  docNumber: ReactNode;
  /** Icon rendered inside the PageHeader accent square. */
  icon: ReactNode;
  /** Status badge element — caller builds it via the centralized label helper (Req 2.12). */
  statusBadge?: ReactNode;
  /** Project name shown in the header description; "—" when absent (Req 2.2, 2.8). */
  projectName?: string | null;
  /** Optional extra description text rendered after the project name. */
  descriptionExtra?: ReactNode;
  /** Destination of the back button — the parent finance tab (Req 2.2). */
  backHref: string;
  /** Back button label. Defaults to "Kembali". */
  backLabel?: string;
  /**
   * Optional print/download slot (Req 2.2). Rendered to the right of the back
   * button. Used by invoices & payments; omitted for other entities.
   */
  headerActions?: ReactNode;
  /** Summary cards section content (Req 2.3). */
  summary: ReactNode;
  /** Detail metadata section content (Req 2.4). */
  details: ReactNode;
  /**
   * Timeline section — typically a `<FinanceTimeline .../>` element (Req 2.5).
   * Rendered last, after the detail metadata.
   */
  timeline: ReactNode;
  className?: string;
}

export function FinanceDetailLayout({
  docNumber,
  icon,
  statusBadge,
  projectName,
  descriptionExtra,
  backHref,
  backLabel = "Kembali",
  headerActions,
  summary,
  details,
  timeline,
  className,
}: FinanceDetailLayoutProps) {
  return (
    <div className={cn("space-y-6 p-6", className)}>
      {/* Header (Req 2.1 order #1, Req 2.2) */}
      <PageHeader
        icon={icon}
        // Document number/name rendered monospace (Req 2.10).
        title={<span className="font-mono">{docNumber}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {statusBadge}
            <span className="text-muted-foreground">{orDash(projectName)}</span>
            {descriptionExtra}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={backHref}>
              <Button variant="outline" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Button>
            </Link>
            {headerActions}
          </div>
        }
      />

      {/* Summary cards (Req 2.1 order #2, Req 2.3) */}
      <section aria-label="Ringkasan">{summary}</section>

      {/* Detail metadata (Req 2.1 order #3, Req 2.4) */}
      <section aria-label="Detail">{details}</section>

      {/* Timeline (Req 2.1 order #4, Req 2.5) */}
      <section aria-label="Timeline">{timeline}</section>
    </div>
  );
}

export default FinanceDetailLayout;

// ---------------------------------------------------------------------------
// Composable presentation helpers
// ---------------------------------------------------------------------------

/**
 * FinanceDetailGrid
 *
 * Responsive grid used inside the summary and detail sections (Req 2.11, 11.6):
 * - single-column stacked layout below 768px (default `grid-cols-1`)
 * - two-column layout between 768px and 1024px (`md:grid-cols-2`)
 * - full multi-column layout at 1024px and above (`lg:grid-cols-{cols}`)
 *
 * `cols` controls the ≥1024px column count (2, 3, or 4). Tailwind's default
 * breakpoints map exactly to the required widths (md = 768px, lg = 1024px).
 */
export function FinanceDetailGrid({
  children,
  cols = 3,
  className,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  const lgCols =
    cols === 2 ? "lg:grid-cols-2" : cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return (
    <div className={cn("grid grid-cols-1 gap-6 md:grid-cols-2", lgCols, className)}>
      {children}
    </div>
  );
}

/**
 * FinanceDetailField
 *
 * A single metadata row: a small muted label with its value below. Optional
 * leading icon. Empty values render "—" so rows are never omitted (Req 2.8).
 *
 * - `mono`: render the value in monospace for identifiers (Req 2.10, 11.3).
 * - `money`: render the value with `tabular-nums` for monetary values
 *   (Req 2.9, 11.2). When a non-string ReactNode is passed as `children`
 *   (e.g. a `FinanceDocLink`), it is rendered as-is.
 */
export function FinanceDetailField({
  label,
  children,
  value,
  icon,
  mono = false,
  money = false,
  className,
}: {
  label: ReactNode;
  /** Rich value (e.g. a link/badge). Takes precedence over `value`. */
  children?: ReactNode;
  /** Plain string/number value; "—" placeholder applied when empty. */
  value?: string | number | null;
  icon?: ReactNode;
  mono?: boolean;
  money?: boolean;
  className?: string;
}) {
  const hasRichValue = children != null && children !== false;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      {icon && <span className="mt-0.5 shrink-0 text-primary/70">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div
          className={cn(
            "text-sm font-semibold text-foreground",
            mono && "font-mono",
            money && "tabular-nums",
          )}
        >
          {hasRichValue ? children : orDash(value ?? null)}
        </div>
      </div>
    </div>
  );
}

/**
 * FinanceMoney
 *
 * Inline monetary value with `tabular-nums` (Req 2.9, 11.2). Pass the already
 * formatted string (e.g. from `formatRupiah`). Falls back to "—" when empty.
 */
export function FinanceMoney({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const content =
    children == null || children === false ? EM_DASH : children;
  return <span className={cn("tabular-nums", className)}>{content}</span>;
}

/**
 * FinanceIdentifier
 *
 * Inline document identifier in monospace (Req 2.10, 11.3). Falls back to "—"
 * when empty. For clickable identifiers use `FinanceDocLink` instead.
 */
export function FinanceIdentifier({
  children,
  className,
}: {
  children: string | number | null | undefined;
  className?: string;
}) {
  return (
    <span className={cn("font-mono", className)}>{orDash(children ?? null)}</span>
  );
}
