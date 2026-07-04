"use client"

import { useState, useCallback, useMemo } from "react"

const MAX_SELECTION = 100

export interface UseBulkSelectionReturn {
  selectedIds: Set<string>
  toggleItem: (id: string) => void
  togglePage: (pageIds: string[]) => void
  clearSelection: () => void
  isSelected: (id: string) => boolean
  selectedCount: number
  isMaxReached: boolean
}

export function useBulkSelection(): UseBulkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= MAX_SELECTION) return prev
        next.add(id)
      }
      return next
    })
  }, [])

  const togglePage = useCallback((pageIds: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = pageIds.length > 0 && pageIds.every((id) => prev.has(id))

      if (allSelected) {
        // Deselect all page items
        const next = new Set(prev)
        for (const id of pageIds) {
          next.delete(id)
        }
        return next
      } else {
        // Select all page items (up to max 100 total)
        const next = new Set(prev)
        for (const id of pageIds) {
          if (next.size >= MAX_SELECTION) break
          next.add(id)
        }
        return next
      }
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  )

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds])

  const isMaxReached = useMemo(() => selectedIds.size >= MAX_SELECTION, [selectedIds])

  return {
    selectedIds,
    toggleItem,
    togglePage,
    clearSelection,
    isSelected,
    selectedCount,
    isMaxReached,
  }
}
