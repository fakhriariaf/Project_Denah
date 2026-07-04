"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Hook to manage animated row deletion in data tables.
 * 
 * When a row is deleted, it first triggers a fade-out animation (300ms),
 * then removes the row from DOM after animation completes — preventing layout shift.
 * 
 * Usage:
 * ```tsx
 * const { deletingIds, animateDelete, getRowClassName } = useAnimatedDelete();
 * 
 * // In delete handler:
 * onConfirm={async () => {
 *   await animateDelete(rowId, () => deleteAction(rowId));
 * }}
 * 
 * // On the table row:
 * <tr className={getRowClassName(rowId)}>
 * ```
 */
export function useAnimatedDelete() {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Triggers the delete animation on a row, then executes the actual delete action.
   * The animation plays first (300ms fade-out), then the delete action is called.
   * After the action resolves, the row is removed from the deleting set.
   */
  const animateDelete = useCallback(
    async (id: string, deleteAction: () => Promise<{ success: boolean }>) => {
      // Mark row as deleting to trigger fade-out animation
      setDeletingIds((prev) => new Set(prev).add(id));

      // Wait for animation to complete (300ms)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 300);
        timeoutsRef.current.set(id, timeout);
      });

      // Execute actual delete action
      const result = await deleteAction();

      // Clean up - remove from deleting state
      timeoutsRef.current.delete(id);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      return result;
    },
    []
  );

  /**
   * Returns CSS classes for the row based on its deleting state.
   * Applies fade-out + height collapse transition when row is being deleted.
   */
  const getRowClassName = useCallback(
    (id: string): string => {
      if (deletingIds.has(id)) {
        return "animate-row-delete";
      }
      return "";
    },
    [deletingIds]
  );

  /**
   * Check if a specific row is currently being deleted (animating out).
   */
  const isDeleting = useCallback(
    (id: string): boolean => {
      return deletingIds.has(id);
    },
    [deletingIds]
  );

  return {
    deletingIds,
    animateDelete,
    getRowClassName,
    isDeleting,
  };
}
