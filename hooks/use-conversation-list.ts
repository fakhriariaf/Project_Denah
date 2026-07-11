"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ConversationItem {
  conversationId: string;
  partnerId: string;
  partnerName: string;
  partnerImage: string | null;
  partnerStatus: "online" | "offline";
  lastMessage: string;
  lastMessageAt: string; // ISO timestamp
  unreadCount: number;
}

const CONVERSATION_POLL_INTERVAL_MS = 30_000; // 30 seconds
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Polls GET /api/chat/conversations every 30 seconds to fetch
 * the current user's conversation list (sorted by most recent first).
 *
 * - Fetches immediately on mount
 * - Polls every 30 seconds while the tab is visible
 * - Pauses polling when the tab is hidden, resumes on visibility
 * - Provides a `refetch` function for imperative refresh (e.g., after mark-as-read)
 * - Silently handles errors (logs to console, retries on next interval)
 *
 * Connection failure handling:
 * - After 3 consecutive failures, sets error state
 * - Resets failure counter on successful fetch
 * - Keeps existing conversations on error (graceful degradation)
 */
export function useConversationList() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const failureCountRef = useRef(0);

  const fetchConversations = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      const res = await fetch("/api/chat/conversations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ConversationItem[] = await res.json();
      if (!isMountedRef.current) return;
      setConversations(data);
      failureCountRef.current = 0;
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      failureCountRef.current++;
      console.error("[useConversationList] Error:", err);
      if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
        setError(err instanceof Error ? err : new Error("Connection failed"));
      }
      // Graceful degradation: keep existing conversations
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const startPolling = () => {
      // Fetch immediately on start/resume
      fetchConversations();
      // Clear any existing interval before creating a new one
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(
        fetchConversations,
        CONVERSATION_POLL_INTERVAL_MS
      );
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

    // Start if tab is currently visible
    if (document.visibilityState === "visible") {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchConversations]);

  return { conversations, isLoading, error, refetch: fetchConversations };
}
