"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MESSAGES_PER_PAGE } from "@/lib/chat-utils";
import { useAdaptivePolling } from "./use-adaptive-polling";
import type { PollingState } from "@/types/chat-optimization";

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string; // ISO timestamp
  isOwn: boolean;
  isRead: boolean;
  // Optimistic update fields
  status?: "pending" | "sent" | "failed";
  tempId?: string;
}

const MESSAGE_POLL_INTERVAL_MS = 5_000; // 5 seconds — fallback default
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Hook that polls messages for a given conversation.
 *
 * - Initial load: fetches last 50 messages (no `after` param)
 * - Polling: every 5 seconds fetches new messages after the latest timestamp
 * - Pagination: `loadOlder()` fetches older messages using `before` param
 * - Appends new messages without replacing existing ones
 * - Tracks `hasMore` for pagination (false when < 50 returned on loadOlder)
 *
 * Connection failure handling:
 * - Silently retries on next interval for individual failures
 * - After 3 consecutive polling failures, sets error state
 * - Resets failure counter on successful fetch
 * - Keeps existing messages on error (graceful degradation)
 */
export function useMessagePolling(conversationId: string | null) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Use refs to avoid stale closures in polling interval
  const lastTimestampRef = useRef<string | null>(null);
  const oldestTimestampRef = useRef<string | null>(null);
  const isLoadingOlderRef = useRef(false);
  const isMountedRef = useRef(true);
  const failureCountRef = useRef(0);
  // Stores the ETag from the last successful poll response for conditional requests
  const lastETagRef = useRef<string | null>(null);
  // Timestamp (ms) until which polling is paused due to a 429 rate-limit response.
  // While Date.now() < backoffUntilRef.current, all chat fetches early-return.
  const backoffUntilRef = useRef<number>(0);

  // Default backoff (seconds) applied when a 429 response has no Retry-After header.
  const DEFAULT_BACKOFF_SECONDS = 30;

  /**
   * Compute a safe backoff window (in ms) from a 429 response's Retry-After
   * header. Falls back to DEFAULT_BACKOFF_SECONDS when the header is missing
   * or not a positive finite number.
   */
  const resolveBackoffMs = useCallback((res: Response): number => {
    const retryAfter = res.headers.get("Retry-After");
    const backoffSeconds = retryAfter ? parseInt(retryAfter, 10) : DEFAULT_BACKOFF_SECONDS;
    const safeSeconds =
      Number.isFinite(backoffSeconds) && backoffSeconds > 0
        ? backoffSeconds
        : DEFAULT_BACKOFF_SECONDS;
    return safeSeconds * 1000;
  }, []);

  // Update refs whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      lastTimestampRef.current = messages[messages.length - 1].createdAt;
      oldestTimestampRef.current = messages[0].createdAt;
    }
  }, [messages]);

  // Fetch initial messages (last 50 in chronological order)
  const fetchInitial = useCallback(async () => {
    if (!conversationId) return;
    // Respect the rate-limit backoff window — skip while still paused.
    if (Date.now() < backoffUntilRef.current) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`
      );
      // 429 Too Many Requests — pause all chat polling for the backoff window.
      // Do not set the error state; this is a transient throttling condition.
      if (res.status === 429) {
        backoffUntilRef.current = Date.now() + resolveBackoffMs(res);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MessageItem[] = await res.json();
      if (!isMountedRef.current) return;
      setMessages(data);
      setHasMore(data.length >= MESSAGES_PER_PAGE);
      failureCountRef.current = 0;
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      failureCountRef.current++;
      console.error("[useMessagePolling] Initial fetch error:", err);
      if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
        setError(err instanceof Error ? err : new Error("Connection failed"));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [conversationId, resolveBackoffMs]);

  // Poll for new messages (append only, using ref for timestamp)
  const pollNew = useCallback(async () => {
    if (!conversationId || !isMountedRef.current) return;
    // Respect the rate-limit backoff window — skip this poll while still paused.
    if (Date.now() < backoffUntilRef.current) return;
    const afterTs = lastTimestampRef.current;
    if (!afterTs) return;

    try {
      // Send If-None-Match with the stored ETag so the server can respond 304
      // when there are no new messages since the last successful poll.
      const headers: HeadersInit = {};
      if (lastETagRef.current) headers["If-None-Match"] = lastETagRef.current;

      const res = await fetch(
        `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}&after=${encodeURIComponent(afterTs)}`,
        { headers }
      );

      // 429 Too Many Requests — pause all chat polling for the backoff window.
      // Handled specially (not as an error) so we resume cleanly afterwards.
      if (res.status === 429) {
        if (!isMountedRef.current) return;
        backoffUntilRef.current = Date.now() + resolveBackoffMs(res);
        return;
      }

      // 304 Not Modified — data unchanged, skip processing entirely.
      if (res.status === 304) {
        if (!isMountedRef.current) return;
        failureCountRef.current = 0;
        setError(null);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // 200 OK — capture the new ETag and process the fresh data.
      const etag = res.headers.get("ETag");
      if (etag) lastETagRef.current = etag;

      const newMsgs: MessageItem[] = await res.json();
      if (!isMountedRef.current) return;
      if (newMsgs.length > 0) {
        // Dedupe by id: skip messages already present (e.g. optimistic sends)
        // Also skip messages whose id matches a confirmed optimistic message
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          // Also track tempIds that are still pending/failed to avoid duplication
          const pendingTempIds = new Set(
            prev.filter((m) => m.tempId && m.status !== "sent").map((m) => m.tempId)
          );
          const unique = newMsgs.filter(
            (m) => !existingIds.has(m.id) && !pendingTempIds.has(m.id)
          );
          return unique.length > 0 ? [...prev, ...unique] : prev;
        });
      }
      failureCountRef.current = 0;
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      failureCountRef.current++;
      if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
        setError(err instanceof Error ? err : new Error("Connection failed"));
      }
      // Silent retry on next interval — keep existing messages
    }
  }, [conversationId, resolveBackoffMs]);

  /**
   * Append a message locally (optimistic update) so the sender sees it
   * instantly without waiting for the next poll cycle. Deduped by id, so
   * the subsequent poll won't create a duplicate.
   */
  const appendLocalMessage = useCallback((message: MessageItem) => {
    if (!isMountedRef.current) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  /**
   * Add a pending message (optimistic send). The message is displayed
   * immediately with status "pending" and a client-generated tempId.
   */
  const addPendingMessage = useCallback((message: MessageItem) => {
    if (!isMountedRef.current) return;
    setMessages((prev) => [...prev, { ...message, status: "pending" }]);
  }, []);

  /**
   * Confirm a pending message: transition to "sent" and replace tempId with real id.
   */
  const confirmMessage = useCallback((tempId: string, realMessage: MessageItem) => {
    if (!isMountedRef.current) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.tempId === tempId
          ? { ...realMessage, status: "sent" as const, tempId: undefined }
          : m
      )
    );
  }, []);

  /**
   * Mark a pending message as failed.
   */
  const failMessage = useCallback((tempId: string) => {
    if (!isMountedRef.current) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.tempId === tempId ? { ...m, status: "failed" as const } : m
      )
    );
  }, []);

  /**
   * Reset a failed message back to "pending" for retry.
   */
  const retryMessage = useCallback((tempId: string) => {
    if (!isMountedRef.current) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.tempId === tempId ? { ...m, status: "pending" as const } : m
      )
    );
  }, []);

  /**
   * Remove a message from local state (e.g. delete a failed message).
   */
  const removeMessage = useCallback((tempId: string) => {
    if (!isMountedRef.current) return;
    setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
  }, []);

  // Load older messages (pagination)
  const loadOlder = useCallback(async () => {
    if (!conversationId || !hasMore || isLoadingOlderRef.current) return;
    // Respect the rate-limit backoff window — skip while still paused.
    if (Date.now() < backoffUntilRef.current) return;
    const beforeTs = oldestTimestampRef.current;
    if (!beforeTs) return;

    isLoadingOlderRef.current = true;

    try {
      const res = await fetch(
        `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}&before=${encodeURIComponent(beforeTs)}`
      );
      // 429 Too Many Requests — pause all chat polling for the backoff window.
      if (res.status === 429) {
        backoffUntilRef.current = Date.now() + resolveBackoffMs(res);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const olderMsgs: MessageItem[] = await res.json();
      if (!isMountedRef.current) return;
      if (olderMsgs.length < MESSAGES_PER_PAGE) {
        setHasMore(false);
      }
      if (olderMsgs.length > 0) {
        setMessages((prev) => [...olderMsgs, ...prev]);
      }
    } catch (error) {
      console.error("[useMessagePolling] Load older error:", error);
    } finally {
      isLoadingOlderRef.current = false;
    }
  }, [conversationId, hasMore, resolveBackoffMs]);

  // Reset state and fetch initial on conversationId change
  useEffect(() => {
    isMountedRef.current = true;
    setMessages([]);
    setHasMore(true);
    setError(null);
    lastTimestampRef.current = null;
    oldestTimestampRef.current = null;
    failureCountRef.current = 0;
    lastETagRef.current = null;
    backoffUntilRef.current = 0;

    if (conversationId) {
      fetchInitial();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [conversationId, fetchInitial]);

  // Adaptive polling — replaces the old setInterval + visibilitychange logic.
  // Uses the state machine hook (ACTIVE/IDLE/HIDDEN) to manage interval switching.
  // Backward-compatible: if adaptive polling is not wired to DOM events,
  // it stays in ACTIVE state (5s default), matching the previous behavior.
  const { state: pollingState, recordActivity } = useAdaptivePolling({
    activeIntervalMs: MESSAGE_POLL_INTERVAL_MS, // 5000ms
    idleIntervalMs: 10_000, // 10s when idle
    idleThresholdMs: 60_000, // 60s without interaction → idle
    pollFn: pollNew,
  });

  // Only start adaptive polling after initial load completes and conversation is active
  // The useAdaptivePolling hook manages its own intervals internally, including
  // visibility handling and idle detection. We just need to gate it on readiness.
  // Since useAdaptivePolling starts polling immediately, we handle the "not ready" case
  // by making pollNew a no-op when there's no conversationId or still loading (it already
  // checks `!conversationId` and `!lastTimestampRef.current`).

  return {
    messages,
    isLoading,
    loadOlder,
    hasMore,
    error,
    appendLocalMessage,
    addPendingMessage,
    confirmMessage,
    failMessage,
    retryMessage,
    removeMessage,
    pollNew,
    recordActivity,
    pollingState: pollingState as PollingState,
  };
}
