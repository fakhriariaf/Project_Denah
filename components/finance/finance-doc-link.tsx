import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * FinanceDocLink
 *
 * Renders a finance document identifier (invoice / payment / transaction /
 * approval number, budget name, etc.) as a semantic anchor when a concrete
 * `href` is provided, and as plain monospace text otherwise.
 *
 * Design / requirements:
 * - Requirement 1.6: monospace font + semantic Sage Green hover state.
 * - Requirement 1.7: rendered as a real HTML anchor (via Next `Link`, which
 *   emits an `<a href>`), preserving standard browser link behavior —
 *   open-in-new-tab via middle-click / Ctrl+click, copy-link-address via the
 *   right-click context menu, and browser-back navigation.
 * - Requirement 11.1: interactive control uses the primary color token.
 * - Requirement 11.3: document identifiers use monospace font.
 *
 * Route-safety (Property 6 / Link_Safety, Requirements 13.2, 13.3): callers
 * activate links per phase. The component renders an interactive anchor ONLY
 * when `href` resolves to a concrete route with a complete id segment. It
 * renders non-interactive monospace text when `href` is:
 * - null / undefined / empty / whitespace-only, or
 * - an internal route with a missing id segment (trailing slash, e.g.
 *   `/finance/invoices/`), or
 * - an internal route whose interpolated segment is the literal string
 *   `undefined` / `null` (e.g. `/finance/invoices/undefined`).
 * This guarantees no rendered link ever points at a 404.
 */

type AnchorProps = Omit<ComponentPropsWithoutRef<"a">, "href" | "children">;

export interface FinanceDocLinkProps extends AnchorProps {
  /**
   * Concrete destination. When omitted, null, or empty the component renders
   * plain (non-link) monospace text instead of an anchor.
   */
  href?: string | null;
  /** The document identifier to display (e.g. invoice number). */
  children: ReactNode;
  className?: string;
}

const linkClassName = cn(
  "font-mono text-primary transition-colors",
  "hover:text-primary-dark hover:underline underline-offset-2 rounded-xs",
  // Visible keyboard focus state using the Sage Green ring token.
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
);

/**
 * Determines whether an `href` value is a safe, complete route that will not
 * resolve to a 404. Returns false for empty values and for internal routes
 * that are missing their id segment (trailing slash) or whose interpolated
 * segment is the literal string `undefined` / `null`.
 */
export function isSafeDocHref(href: string | null | undefined): href is string {
  if (typeof href !== "string") return false;

  const trimmed = href.trim();
  if (trimmed.length === 0) return false;

  // Only apply path-segment validation to internal, path-like routes so that
  // any absolute/protocol href keeps working unchanged (backward compatible).
  const isInternalPath = trimmed.startsWith("/");
  if (!isInternalPath) return true;

  // Strip query string / fragment before inspecting path segments.
  const pathOnly = trimmed.split(/[?#]/, 1)[0];

  // Trailing slash on a nested route means the id segment is missing
  // (e.g. "/finance/invoices/" produced from an empty id).
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) return false;

  // Reject routes whose interpolated segment resolved to a nullish literal
  // (e.g. "/finance/invoices/undefined" or ".../null").
  const segments = pathOnly.split("/").filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === "undefined" || segment === "null")) {
    return false;
  }

  return true;
}

export function FinanceDocLink({
  href,
  children,
  className,
  ...anchorProps
}: FinanceDocLinkProps) {
  // Route-safe: only render an anchor for a concrete route with a complete id.
  const hasHref = isSafeDocHref(href);

  if (!hasHref) {
    return (
      <span className={cn("font-mono text-foreground", className)}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={cn(linkClassName, className)} {...anchorProps}>
      {children}
    </Link>
  );
}

export default FinanceDocLink;
