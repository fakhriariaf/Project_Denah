"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DataTablePaginationProps {
  totalItems: number;
  itemsPerPage?: number;
  /** Optional clamped page when a local filter reduces the available pages. */
  currentPage?: number;
  /**
   * Use local state when a table owns its filter/pagination state. When absent,
   * the component keeps the existing URL-query behaviour.
   */
  onPageChange?: (page: number) => void;
  /** URL parameter namespace for tab-specific pagination (e.g. "invoicePage") */
  pageParam?: string;
  /** Maximum visible page number buttons (default 5) */
  maxVisiblePages?: number;
}

/**
 * Compute which page numbers to display, including ellipsis markers.
 * Returns an array of page numbers (positive integers) and -1 for ellipsis.
 */
function getVisiblePages(
  currentPage: number,
  totalPages: number,
  maxVisible: number,
): number[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: number[] = [];

  // Always include first and last page
  // Calculate the range around current page
  const sideCount = Math.floor((maxVisible - 2) / 2); // pages on each side of current (excluding first/last)
  // We reserve 2 slots for first and last, so we have maxVisible - 2 inner slots
  const innerSlots = maxVisible - 2;

  let rangeStart: number;
  let rangeEnd: number;

  if (currentPage <= sideCount + 2) {
    // Current page is near the beginning
    rangeStart = 2;
    rangeEnd = Math.min(innerSlots + 1, totalPages - 1);
  } else if (currentPage >= totalPages - sideCount - 1) {
    // Current page is near the end
    rangeEnd = totalPages - 1;
    rangeStart = Math.max(totalPages - innerSlots, 2);
  } else {
    // Current page is in the middle
    rangeStart = currentPage - sideCount;
    rangeEnd = currentPage + sideCount;
    // Adjust if we don't have enough room
    if (rangeEnd - rangeStart + 1 < innerSlots) {
      rangeEnd = rangeStart + innerSlots - 1;
    }
    // Clamp
    if (rangeEnd >= totalPages) {
      rangeEnd = totalPages - 1;
      rangeStart = Math.max(2, rangeEnd - innerSlots + 1);
    }
    if (rangeStart <= 1) {
      rangeStart = 2;
      rangeEnd = Math.min(rangeStart + innerSlots - 1, totalPages - 1);
    }
  }

  // Build the pages array
  pages.push(1);

  if (rangeStart > 2) {
    pages.push(-1); // ellipsis
  }

  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  if (rangeEnd < totalPages - 1) {
    pages.push(-1); // ellipsis
  }

  pages.push(totalPages);

  return pages;
}

export function DataTablePagination({
  totalItems,
  itemsPerPage = 20,
  currentPage: currentPageOverride,
  onPageChange,
  pageParam,
  maxVisiblePages = 5,
}: DataTablePaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramKey = pageParam || "page";

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const pageFromUrl = Number(searchParams.get(paramKey)) || 1;
  const currentPage = Math.min(
    Math.max(1, currentPageOverride ?? pageFromUrl),
    totalPages,
  );

  const handlePageChange = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramKey, String(page));
    router.push(`?${params.toString()}`);
  };

  if (totalItems <= 0) return null;

  const visiblePages = getVisiblePages(currentPage, totalPages, maxVisiblePages);

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-4 border-t border-border bg-background/70 backdrop-blur-md rounded-b-2xl sm:flex-row sm:justify-between sm:px-6">
      <div className="text-xs text-muted-foreground font-medium font-sans">
        Menampilkan <span className="font-semibold text-foreground font-mono tabular-nums">{(currentPage - 1) * itemsPerPage + 1}</span> -{" "}
        <span className="font-semibold text-foreground font-mono tabular-nums">{Math.min(currentPage * itemsPerPage, totalItems)}</span> dari{" "}
        <span className="font-semibold text-foreground font-mono tabular-nums">{totalItems}</span> data
      </div>
      <div className="flex items-center gap-1 flex-wrap justify-center">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
          aria-label="Halaman sebelumnya"
          title="Halaman sebelumnya"
          className="h-11 w-11 p-0 rounded-xl disabled:opacity-40 transition-all"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>

        {visiblePages.map((page, index) =>
          page === -1 ? (
            <span
              key={`ellipsis-${index}`}
              className="h-11 w-11 flex items-center justify-center text-xs text-muted-foreground select-none"
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant={page === currentPage ? "default" : "outline"}
              size="sm"
              onClick={() => handlePageChange(page)}
              aria-label={`Halaman ${page}`}
              aria-current={page === currentPage ? "page" : undefined}
              className={
                page === currentPage
                  ? "h-11 w-11 p-0 rounded-xl bg-primary text-primary-foreground font-mono tabular-nums font-semibold transition-all"
                  : "h-11 w-11 p-0 rounded-xl font-mono tabular-nums transition-all"
              }
            >
              {page}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange(currentPage + 1)}
          aria-label="Halaman berikutnya"
          title="Halaman berikutnya"
          className="h-11 w-11 p-0 rounded-xl disabled:opacity-40 transition-all"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
