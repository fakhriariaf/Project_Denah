"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseStaleCheckOptions {
  /** Max age in milliseconds before data is considered stale (default: 5 minutes) */
  maxAgeMs?: number;
  /** Update interval for relative time display (default: 30 seconds) */
  updateIntervalMs?: number;
}

interface UseStaleCheckReturn {
  /** Whether data is stale (exceeded maxAge) */
  isStale: boolean;
  /** Human-readable time since last fetch */
  timeAgo: string;
  /** Timestamp of last fetch */
  lastFetchedAt: Date;
  /** Mark data as freshly fetched (call after refetch) */
  markFresh: () => void;
  /** Milliseconds since last fetch */
  elapsedMs: number;
}

/**
 * useStaleCheck — Track data freshness and provide human-readable age.
 *
 * Usage:
 * ```tsx
 * const { isStale, timeAgo, markFresh } = useStaleCheck({ maxAgeMs: 5 * 60 * 1000 });
 *
 * async function handleRefresh() {
 *   await refetchData();
 *   markFresh();
 * }
 *
 * return <StaleIndicator isStale={isStale} timeAgo={timeAgo} onRefresh={handleRefresh} />;
 * ```
 */
export function useStaleCheck(options: UseStaleCheckOptions = {}): UseStaleCheckReturn {
  const { maxAgeMs = 5 * 60 * 1000, updateIntervalMs = 30_000 } = options;

  const [lastFetchedAt, setLastFetchedAt] = useState<Date>(new Date());
  const [now, setNow] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update "now" periodically for live relative time
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setNow(new Date());
    }, updateIntervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [updateIntervalMs]);

  const elapsedMs = now.getTime() - lastFetchedAt.getTime();
  const isStale = elapsedMs >= maxAgeMs;

  const timeAgo = formatTimeAgo(elapsedMs);

  const markFresh = useCallback(() => {
    setLastFetchedAt(new Date());
    setNow(new Date());
  }, []);

  return { isStale, timeAgo, lastFetchedAt, markFresh, elapsedMs };
}

function formatTimeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 10) return "baru saja";
  if (seconds < 60) return `${seconds} detik lalu`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;

  const hours = Math.floor(minutes / 60);
  return `${hours} jam lalu`;
}
