"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * useOptimisticAction — Execute server action with instant UI update + rollback on error.
 *
 * Usage:
 * ```ts
 * const { execute, isLoading } = useOptimisticAction({
 *   action: cancelBooking,
 *   onOptimistic: () => setStatus("cancelled"),
 *   onRollback: () => setStatus("active"),
 *   onSuccess: () => router.refresh(),
 *   successMessage: "Booking berhasil dibatalkan",
 *   errorMessage: "Gagal membatalkan booking",
 * });
 * ```
 */

interface UseOptimisticActionOptions<TArgs extends unknown[], TResult> {
  /** Server action to execute */
  action: (...args: TArgs) => Promise<TResult>;
  /** Called immediately before server action — update UI optimistically */
  onOptimistic?: () => void;
  /** Called if server action fails — revert UI to previous state */
  onRollback?: () => void;
  /** Called after server action succeeds */
  onSuccess?: (result: TResult) => void;
  /** Called after server action fails (after rollback) */
  onError?: (error: string) => void;
  /** Toast message on success */
  successMessage?: string;
  /** Toast message on error (overrides caught message) */
  errorMessage?: string;
}

interface UseOptimisticActionReturn<TArgs extends unknown[]> {
  /** Execute action with optimistic update */
  execute: (...args: TArgs) => Promise<void>;
  /** Whether action is currently in flight */
  isLoading: boolean;
  /** Last error message, null if no error */
  error: string | null;
  /** Clear error state */
  clearError: () => void;
}

export function useOptimisticAction<TArgs extends unknown[], TResult>(
  options: UseOptimisticActionOptions<TArgs, TResult>
): UseOptimisticActionReturn<TArgs> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const execute = useCallback(async (...args: TArgs) => {
    const opts = optionsRef.current;
    setIsLoading(true);
    setError(null);

    // 1. Apply optimistic update immediately
    opts.onOptimistic?.();

    try {
      // 2. Execute server action
      const result = await opts.action(...args);

      // 3. Check if result indicates failure (support { success: false, error: string } pattern)
      if (result && typeof result === "object" && "success" in result) {
        const r = result as { success: boolean; error?: string };
        if (!r.success) {
          throw new Error(r.error || "Operasi gagal");
        }
      }

      // 4. Success
      if (opts.successMessage) {
        toast.success(opts.successMessage);
      }
      opts.onSuccess?.(result);
    } catch (err: unknown) {
      // 5. Rollback optimistic update
      opts.onRollback?.();

      const errorMsg =
        opts.errorMessage ||
        (err instanceof Error ? err.message : "Operasi gagal. Silakan coba lagi.");

      setError(errorMsg);
      toast.error(errorMsg);
      opts.onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { execute, isLoading, error, clearError };
}

/**
 * useOptimisticList — Manage a list with optimistic add/remove/update operations.
 *
 * Usage:
 * ```ts
 * const { items, optimisticRemove, optimisticUpdate, rollback } = useOptimisticList(bookings);
 * ```
 */
export function useOptimisticList<T extends { id: string }>(initialItems: T[]) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [snapshot, setSnapshot] = useState<T[]>(initialItems);

  useEffect(() => {
    setItems(initialItems);
    setSnapshot(initialItems);
  }, [initialItems]);

  /** Save current state before optimistic mutation */
  const saveSnapshot = useCallback(() => {
    setSnapshot([...items]);
  }, [items]);

  /** Rollback to last snapshot */
  const rollback = useCallback(() => {
    setItems(snapshot);
  }, [snapshot]);

  /** Optimistically remove item by id */
  const optimisticRemove = useCallback((id: string) => {
    setSnapshot((prev) => [...prev]);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /** Optimistically update item */
  const optimisticUpdate = useCallback((id: string, updates: Partial<T>) => {
    setSnapshot((prev) => [...prev]);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  /** Optimistically add item to start */
  const optimisticAdd = useCallback((item: T) => {
    setSnapshot((prev) => [...prev]);
    setItems((prev) => [item, ...prev]);
  }, []);

  return {
    items,
    setItems,
    saveSnapshot,
    rollback,
    optimisticRemove,
    optimisticUpdate,
    optimisticAdd,
  };
}
