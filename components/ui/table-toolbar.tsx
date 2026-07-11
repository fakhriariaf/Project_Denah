import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Standard toolbar layout for list/table pages: a search area on the left and
 * filter/action controls on the right. Layout-only — no behavior — so any page
 * can drop in its own search input, filter selects, and action buttons while
 * keeping consistent spacing and responsive wrapping.
 */
interface TableToolbarProps {
  /** Left slot — typically a search input. */
  search?: React.ReactNode;
  /** Right slot — filters and primary actions (e.g. "Tambah"). */
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function TableToolbar({ search, actions, className, children }: TableToolbarProps) {
  return (
    <div
      data-slot="table-toolbar"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {search && <div className="w-full sm:max-w-xs">{search}</div>}
      {children}
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>
      )}
    </div>
  );
}
