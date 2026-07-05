"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getUnreadCount,
  getLatestNotificationAfter,
} from "@/server/actions/notification";
import type { NotificationItem } from "@/server/actions/notification";

export interface UseNotificationPollingOptions {
  /** Polling interval in milliseconds (default: 10000 = 10s) */
  interval?: number;
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
}

export interface UseNotificationPollingResult {
  /** Current unread notification count */
  unreadCount: number;
  /** The most recent notification detected since last seen timestamp */
  latestNotification: NotificationItem | null;
  /** Whether a genuinely new notification arrived since the hook was initialized */
  hasNewSince: boolean;
  /** Reset the "new since" state (e.g., after user opens dropdown) */
  resetNewSince: () => void;
  /** Force an immediate refresh of polling data */
  refresh: () => Promise<void>;
}

/**
 * Reusable polling hook for real-time notification detection.
 * - Polls every `interval` ms (default 10s)
 * - Only polls when document is visible
 * - Tracks "last seen" timestamp to detect genuinely new notifications
 * - Stops polling when tab is hidden, resumes on focus
 */
export function useNotificationPolling(
  options: UseNotificationPollingOptions = {}
): UseNotificationPollingResult {
  const { interval = 10000, enabled = true } = options;

  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] =
    useState<NotificationItem | null>(null);
  const [hasNewSince, setHasNewSince] = useState(false);

  // Track "last seen" timestamp — initialized to now so we only detect NEW ones
  const lastSeenRef = useRef<string>(new Date().toISOString());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const poll = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      // 1. Get unread count (lightweight)
      const count = await getUnreadCount();
      if (!isMountedRef.current) return;
      setUnreadCount(count);

      // 2. Check for newest notification after last seen
      const latest = await getLatestNotificationAfter(lastSeenRef.current);
      if (!isMountedRef.current) return;

      if (latest) {
        setLatestNotification(latest);
        setHasNewSince(true);
        // Update last seen to this notification's createdAt so we don't repeat
        const createdAtISO =
          latest.createdAt instanceof Date
            ? latest.createdAt.toISOString()
            : new Date(latest.createdAt).toISOString();
        lastSeenRef.current = createdAtISO;
      }
    } catch (err) {
      console.warn("[useNotificationPolling] Poll failed:", err);
    }
  }, []);

  const refresh = useCallback(async () => {
    await poll();
  }, [poll]);

  const resetNewSince = useCallback(() => {
    setHasNewSince(false);
    setLatestNotification(null);
    lastSeenRef.current = new Date().toISOString();
  }, []);

  // Start/stop polling based on visibility
  useEffect(() => {
    if (!enabled) return;

    isMountedRef.current = true;

    const startPolling = () => {
      // Run immediately
      poll();
      // Clear any existing interval
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(poll, interval);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startPolling();
      } else {
        stopPolling();
      }
    };

    // Initial start (only if visible)
    if (document.visibilityState === "visible") {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, interval, poll]);

  return {
    unreadCount,
    latestNotification,
    hasNewSince,
    resetNewSince,
    refresh,
  };
}
