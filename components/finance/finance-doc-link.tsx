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
 * - Requirement 1.6: monospace font + Sage Green hover state (#3D563F).
 * - Requirement 1.7: rendered as a real HTML anchor (via Next `Link`, which
 *   emits an `<a href>`), preserving standard browser link behavior —
 *   open-in-new-tab via middle-click / Ctrl+click, copy-link-address via the
 *   right-click context menu, and browser-back navigation.
 * - Requirement 11.1: interactive control uses Primary #4F6F52, hover #3D563F.
 * - Requirement 11.3: document identifiers use monospace font.
 *
 * Route-safety: callers activate links per phase. When `href` is not a concrete,
 * non-empty string the component renders non-interactive monospace text so it
 * never points at a route that does not yet exist.
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
  "font-mono text-[#4F6F52] transition-colors",
  "hover:text-[#3D563F] hover:underline underline-offset-2 rounded-xs",
  // Visible keyboard focus state using the Sage Green ring token.
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
);

export function FinanceDocLink({
  href,
  children,
  className,
  ...anchorProps
}: FinanceDocLinkProps) {
  // Route-safe: only render an anchor for a concrete, non-empty href.
  const hasHref = typeof href === "string" && href.trim().length > 0;

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
