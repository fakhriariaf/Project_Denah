"use client";

import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Sends a heartbeat POST to /api/chat/heartbeat every 30 seconds
 * while the browser tab is active (visible).
 *
 * - Pauses when the tab becomes hidden
 * - Resumes (and sends immediately) when the tab becomes visible again
 * - Silently handles errors (logs to console, retries on next interval)
 * - Cleans up interval and event listener on unmount
 */
export function useHeartbeat() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const sendHeartbeat = async () => {
      if (!isMountedRef.current) return;
      try {
        await fetch("/api/chat/heartbeat", { method: "POST" });
      } catch (error) {
        console.error("[useHeartbeat] Failed to send heartbeat:", error);
      }
    };

    const startInterval = () => {
      // Send immediately on start/resume
      sendHeartbeat();
      // Clear any existing interval before creating a new one
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    };

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startInterval();
      } else {
        stopInterval();
      }
    };

    // Start if tab is currently visible
    if (document.visibilityState === "visible") {
      startInterval();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
