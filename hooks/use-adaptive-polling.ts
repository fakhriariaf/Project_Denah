"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// === Types ===

type PollingState = "ACTIVE" | "IDLE" | "HIDDEN";

export interface AdaptivePollingConfig {
  activeIntervalMs: number; // 5000
  idleIntervalMs: number; // 10000
  idleThresholdMs: number; // 60000
  pollFn: () => Promise<void>; // The actual fetch function
}

/**
 * useAdaptivePolling — state machine hook for adaptive polling.
 *
 * States:
 * - ACTIVE: poll every activeIntervalMs (default 5s)
 * - IDLE: poll every idleIntervalMs (default 10s)
 * - HIDDEN: no polling (tab hidden)
 *
 * Transitions:
 * - ACTIVE → IDLE: no interaction for idleThresholdMs (60s)
 * - ACTIVE/IDLE → HIDDEN: document.visibilityState === "hidden"
 * - HIDDEN → ACTIVE: tab becomes visible (immediate fetch + reset interval)
 * - IDLE → ACTIVE: user interacts (immediate fetch + reset interval)
 *
 * Activity tracked via: send message, keypress in textarea, scroll in message area, focus on input
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
export function useAdaptivePolling(config: AdaptivePollingConfig) {
  const [state, setState] = useState<PollingState>("ACTIVE");

  // Use refs to avoid stale closure issues
  const stateRef = useRef<PollingState>(state);
  const lastActivityRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const configRef = useRef(config);

  // Initialize lastActivity on mount (avoid calling Date.now() during render)
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Keep refs in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  /**
   * recordActivity — call this when user interacts (send, keypress, scroll, focus).
   * If currently IDLE, transitions to ACTIVE with an immediate fetch.
   */
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (stateRef.current === "IDLE") {
      setState("ACTIVE");
      configRef.current.pollFn();
    }
  }, []);

  // Visibility change handler
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden") {
        setState("HIDDEN");
      } else {
        setState("ACTIVE");
        lastActivityRef.current = Date.now();
        configRef.current.pollFn(); // Immediate fetch on tab return
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // Idle detection timer — only runs when ACTIVE
  useEffect(() => {
    if (state !== "ACTIVE") return;

    const checkIdle = setInterval(() => {
      if (
        Date.now() - lastActivityRef.current >
        configRef.current.idleThresholdMs
      ) {
        setState("IDLE");
      }
    }, 5000); // Check every 5s

    return () => clearInterval(checkIdle);
  }, [state]);

  // Polling interval management
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (state === "HIDDEN") return; // No polling when hidden

    const interval =
      state === "ACTIVE"
        ? config.activeIntervalMs
        : config.idleIntervalMs;

    intervalRef.current = setInterval(() => {
      configRef.current.pollFn();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state, config.activeIntervalMs, config.idleIntervalMs]);

  return { state, recordActivity };
}
