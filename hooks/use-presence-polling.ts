"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface UserPresenceItem {
  userId: string;
  name: string;
  image: string | null;
  status: "online" | "offline";
}

const PRESENCE_INTERVAL_MS = 30_000; // 30 seconds
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Sort users: online first, then offline. Alphabetical within each group.
 */
function sortUsers(users: UserPresenceItem[]): UserPresenceItem[] {
  return [...users].sort((a, b) => {
    // Online first, then offline
    if (a.status === "online" && b.status === "offline") return -1;
    if (a.status === "offline" && b.status === "online") return 1;
    // Alphabetical within same status group
    return a.name.localeCompare(b.name);
  });
}

/**
 * Polls the presence API every 30 seconds to get online/offline user list.
 * Returns sorted users (online first, then offline, alphabetical within groups).
 * Pauses polling when the browser tab is hidden and resumes on visibility.
 *
 * Connection failure handling:
 * - Silently retries on next interval for individual failures
 * - After 3 consecutive failures, sets error state (connection problem banner)
 * - Resets failure counter on successful fetch
 * - Graceful degradation: keeps showing last successful data on error (users not cleared)
 */
export function usePresencePolling() {
  const [users, setUsers] = useState<UserPresenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const failureCountRef = useRef(0);

  const fetchPresence = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      const res = await fetch("/api/chat/presence");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!isMountedRef.current) return;
      const data: UserPresenceItem[] = await res.json();
      setUsers(sortUsers(data));
      failureCountRef.current = 0;
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      failureCountRef.current++;
      console.error("[usePresencePolling] Error:", err);
      if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
        setError(err instanceof Error ? err : new Error("Connection failed"));
      }
      // Graceful degradation: do NOT clear users — keep showing last successful data
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const startPolling = () => {
      fetchPresence();
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(fetchPresence, PRESENCE_INTERVAL_MS);
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
    } else {
      // Still do initial fetch even if hidden, to have data ready
      fetchPresence();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchPresence]);

  return { users, isLoading, error };
}
