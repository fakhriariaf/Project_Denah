"use client";

import { RefreshCw, Clock } from "lucide-react";

interface StaleIndicatorProps {
  /** Whether data is stale */
  isStale: boolean;
  /** Human-readable time since last fetch */
  timeAgo: string;
  /** Callback when refresh button clicked */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Optional className override */
  className?: string;
}

/**
 * StaleIndicator — Shows data freshness status with optional refresh button.
 *
 * - Fresh: subtle gray text "Data dari X menit lalu"
 * - Stale: amber warning + refresh button
 */
export function StaleIndicator({
  isStale,
  timeAgo,
  onRefresh,
  isRefreshing = false,
  className = "",
}: StaleIndicatorProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
        isStale
          ? "bg-amber-50 text-amber-700 border border-amber-200"
          : "bg-[#F7F8F3]#18221D] text-[#66736A]#8AA293] border border-[#D6DED2]/60#1F2E26]"
      } ${className}`}
    >
      <Clock className="h-3 w-3" />
      <span>{timeAgo}</span>

      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`ml-1 p-0.5 rounded hover:bg-black/5 transition-colors disabled:opacity-50 ${
            isStale ? "text-amber-600" : "text-[#8FAF9A]"
          }`}
          title="Refresh data"
          aria-label="Refresh data"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      )}
    </div>
  );
}
