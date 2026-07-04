"use client";

import * as React from "react";
import { Download, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface BulkActionBarProps {
  /** Number of currently selected items */
  selectedCount: number;
  /** Callback when Export Excel is clicked */
  onExport: () => void;
  /** Callback when Delete is clicked — only shown when provided (role-gated by parent) */
  onDelete?: () => void;
  /** Whether a bulk operation is currently in progress */
  isProcessing: boolean;
  /** Additional CSS classes for the container */
  className?: string;
}

/**
 * Floating action bar displayed above the data table when items are selected.
 * Shows selected count, Export Excel button, and optionally a Delete button
 * (only rendered when `onDelete` is provided — role gating done by the parent).
 *
 * Displays a spinner and disables buttons while `isProcessing` is true.
 */
export function BulkActionBar({
  selectedCount,
  onExport,
  onDelete,
  isProcessing,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      data-slot="bulk-action-bar"
      className={cn(
        "flex items-center gap-3 rounded-xl border border-[#B7CDB3] bg-[#F7F8F3]/95 px-4 py-2.5 shadow-md backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200",
        className
      )}
    >
      {/* Selected count */}
      <span className="text-sm font-medium text-[#4F6F52] whitespace-nowrap">
        {selectedCount} item dipilih
      </span>

      {/* Separator */}
      <div className="h-5 w-px bg-[#B7CDB3]" />

      {/* Processing spinner */}
      {isProcessing && (
        <Loader2 className="size-4 animate-spin text-[#4F6F52]" />
      )}

      {/* Export Excel button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onExport}
        disabled={isProcessing}
        className="border-[#B7CDB3] text-[#4F6F52] hover:bg-[#DDE8D8] hover:text-[#3A5440]"
      >
        <Download data-icon="inline-start" className="size-3.5" />
        Export Excel
      </Button>

      {/* Delete button — only shown when onDelete is provided */}
      {onDelete && (
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isProcessing}
        >
          <Trash2 data-icon="inline-start" className="size-3.5" />
          Hapus
        </Button>
      )}
    </div>
  );
}
