"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Calendar } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinanceFilterBarProps {
  /** List of available projects for the filter dropdown */
  projects: Array<{ id: string; name: string }>;
  /** Currently selected project ID, null means "Semua Perumahan" */
  selectedProjectId: string | null;
  /** Callback when project selection changes */
  onProjectChange: (projectId: string | null) => void;
  /** Start of the period range filter, null means "Semua Periode" */
  periodStart: Date | null;
  /** End of the period range filter, null means "Semua Periode" */
  periodEnd: Date | null;
  /** Callback when the period range changes */
  onPeriodChange: (start: Date | null, end: Date | null) => void;
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes (already debounced internally) */
  onSearchChange: (query: string) => void;
  /** Placeholder for the search input */
  searchPlaceholder?: string;
  /** Additional CSS classes */
  className?: string;
}

// ---------------------------------------------------------------------------
// Period Presets
// ---------------------------------------------------------------------------

type PeriodPresetKey = "all" | "this_month" | "this_quarter" | "this_year" | "custom";

interface PeriodPreset {
  key: PeriodPresetKey;
  label: string;
  getRange: () => { start: Date; end: Date } | null;
}

function getQuarterRange(): { start: Date; end: Date } {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), quarter * 3, 1);
  const end = new Date(now.getFullYear(), quarter * 3 + 3, 0); // last day of quarter
  return { start, end };
}

const PERIOD_PRESETS: PeriodPreset[] = [
  { key: "all", label: "Semua Periode", getRange: () => null },
  {
    key: "this_month",
    label: "Bulan Ini",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    },
  },
  {
    key: "this_quarter",
    label: "Kuartal Ini",
    getRange: getQuarterRange,
  },
  {
    key: "this_year",
    label: "Tahun Ini",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start, end };
    },
  },
  { key: "custom", label: "Custom", getRange: () => null },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format Date to YYYY-MM-DD for native input[type=date] */
function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Format a period range for display as a chip label */
function formatPeriodLabel(start: Date | null, end: Date | null): string {
  if (!start && !end) return "";
  const fmt = new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric" });
  const startLabel = start ? fmt.format(start) : "...";
  const endLabel = end ? fmt.format(end) : "...";
  if (startLabel === endLabel) return startLabel;
  return `${startLabel} – ${endLabel}`;
}

/** Detect which preset matches the current period state */
function detectPreset(start: Date | null, end: Date | null): PeriodPresetKey {
  if (!start && !end) return "all";

  for (const preset of PERIOD_PRESETS) {
    if (preset.key === "all" || preset.key === "custom") continue;
    const range = preset.getRange();
    if (!range) continue;
    if (
      toDateInputValue(start) === toDateInputValue(range.start) &&
      toDateInputValue(end) === toDateInputValue(range.end)
    ) {
      return preset.key;
    }
  }
  return "custom";
}

// ---------------------------------------------------------------------------
// FinanceFilterBar Component
// ---------------------------------------------------------------------------

/**
 * FinanceFilterBar — Reusable filter bar for the Finance module.
 *
 * Provides:
 * - Project dropdown ("Semua Perumahan" + list)
 * - Period filter with presets and custom date range
 * - Search input with debounce and search icon
 * - Active filter chips showing context
 *
 * The component does NOT apply date field logic — that's the tab's responsibility.
 * It only manages the period range state.
 *
 * Responsive: flex-wrap on tablet/desktop, flex-col on mobile (< 640px).
 *
 * @see Requirements 1.3, 16.1, 16.2
 */
export function FinanceFilterBar({
  projects,
  selectedProjectId,
  onProjectChange,
  periodStart,
  periodEnd,
  onPeriodChange,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Cari dokumen...",
  className,
}: FinanceFilterBarProps) {
  // Internal debounce for search
  const [localSearch, setLocalSearch] = React.useState(searchQuery);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external searchQuery → localSearch when parent resets
  React.useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchInput = (value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  };

  // Cleanup debounce on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Period preset state
  const currentPreset = detectPreset(periodStart, periodEnd);
  const showCustomDateInputs = currentPreset === "custom";

  const handlePresetChange = (presetKey: string) => {
    const preset = PERIOD_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    if (preset.key === "all") {
      onPeriodChange(null, null);
    } else if (preset.key === "custom") {
      // Keep current dates or initialize to today
      const today = new Date();
      onPeriodChange(periodStart || today, periodEnd || today);
    } else {
      const range = preset.getRange();
      if (range) {
        onPeriodChange(range.start, range.end);
      }
    }
  };

  const handleCustomStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const newStart = val ? new Date(val + "T00:00:00") : null;
    onPeriodChange(newStart, periodEnd);
  };

  const handleCustomEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const newEnd = val ? new Date(val + "T00:00:00") : null;
    onPeriodChange(periodStart, newEnd);
  };

  // Project display label for chips
  const projectLabel = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)?.name ?? null
    : null;

  // Period display label for chips
  const periodLabel = formatPeriodLabel(periodStart, periodEnd);

  const hasActiveFilters = selectedProjectId !== null || periodStart !== null || periodEnd !== null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Filter Controls Row */}
      <div
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        role="toolbar"
        aria-label="Filter keuangan"
      >
        {/* Project Filter */}
        <div className="w-full sm:w-auto sm:min-w-[200px]">
          <Select
            value={selectedProjectId ?? "all"}
            onValueChange={(val: string | null) => onProjectChange(val === "all" ? null : (val ?? null))}
          >
            <SelectTrigger
              className="h-11 w-full rounded-lg border-border bg-white px-3 text-sm shadow-sm sm:w-[220px]"
              aria-label="Filter perumahan"
            >
              <SelectValue placeholder="Semua Perumahan">
                <span className="block truncate">
                  {selectedProjectId
                    ? projects.find((p) => p.id === selectedProjectId)?.name ?? "Semua Perumahan"
                    : "Semua Perumahan"}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Perumahan</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Period Filter */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
          <div className="w-full sm:w-auto sm:min-w-[160px]">
            <Select
              value={currentPreset}
              onValueChange={(val: string | null) => {
                if (val) handlePresetChange(val);
              }}
            >
              <SelectTrigger
                className="h-11 w-full rounded-lg border-border bg-white px-3 text-sm shadow-sm sm:w-[180px]"
                aria-label="Filter periode"
              >
                <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Semua Periode">
                  <span className="block truncate">
                    {PERIOD_PRESETS.find((p) => p.key === currentPreset)?.label ?? "Semua Periode"}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PERIOD_PRESETS.map((preset) => (
                  <SelectItem key={preset.key} value={preset.key}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range Inputs */}
          {showCustomDateInputs && (
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Input
                type="date"
                value={toDateInputValue(periodStart)}
                onChange={handleCustomStartChange}
                className="h-11 w-full text-sm sm:w-[140px]"
                aria-label="Tanggal mulai"
              />
              <span className="text-sm text-muted-foreground">–</span>
              <Input
                type="date"
                value={toDateInputValue(periodEnd)}
                onChange={handleCustomEndChange}
                className="h-11 w-full text-sm sm:w-[140px]"
                aria-label="Tanggal selesai"
              />
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-auto sm:min-w-[220px] sm:flex-1 sm:max-w-[320px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="h-11 w-full rounded-lg border-border bg-white pl-9 pr-3 text-sm shadow-sm"
            aria-label={searchPlaceholder}
          />
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="status"
          aria-label="Filter aktif"
          aria-live="polite"
        >
          {projectLabel && (
            <Badge
              variant="secondary"
              className="gap-1 pl-2.5 pr-1.5 text-xs font-normal"
            >
              {projectLabel}
              <button
                type="button"
                onClick={() => onProjectChange(null)}
                className="relative ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted-foreground/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring after:absolute after:-inset-3.5 after:content-['']"
                aria-label={`Hapus filter ${projectLabel}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {periodLabel && (
            <Badge
              variant="secondary"
              className="gap-1 pl-2.5 pr-1.5 text-xs font-normal"
            >
              <Calendar className="h-3 w-3" />
              {periodLabel}
              <button
                type="button"
                onClick={() => onPeriodChange(null, null)}
                className="relative ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted-foreground/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring after:absolute after:-inset-3.5 after:content-['']"
                aria-label="Hapus filter periode"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export default FinanceFilterBar;
