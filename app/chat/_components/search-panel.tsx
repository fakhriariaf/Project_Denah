"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResultItem {
  messageId: string
  conversationId: string
  partnerName: string
  content: string
  senderName: string
  createdAt: string
  highlightedContent: string
}

interface SearchPanelProps {
  onSelectResult: (conversationId: string, messageId: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats an ISO timestamp into a short readable string (Indonesian locale).
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return "Baru saja"
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} jam lalu`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} hari lalu`

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchPanel({ onSelectResult }: SearchPanelProps) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Fetch results when debounced query changes and meets minimum length
  const fetchResults = useCallback(async (searchQuery: string) => {
    setIsLoading(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams({ q: searchQuery })
      const response = await fetch(`/api/chat/search?${params.toString()}`)
      if (!response.ok) {
        setResults([])
        return
      }
      const data = await response.json()
      setResults(data.results ?? [])
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debouncedQuery.length >= 3) {
      fetchResults(debouncedQuery)
    } else {
      setResults([])
      setHasSearched(false)
    }
  }, [debouncedQuery, fetchResults])

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari pesan..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
            aria-label="Cari pesan"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Ketik minimal 3 karakter
        </p>
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Mencari...</span>
          </div>
        )}

        {/* Empty state — no results found */}
        {!isLoading && hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <Search className="size-10 opacity-40" />
            <p className="text-sm">Tidak ada hasil ditemukan</p>
          </div>
        )}

        {/* Results list */}
        {!isLoading && results.length > 0 && (
          <div className="flex flex-col" role="list" aria-label="Hasil pencarian">
            {results.map((result) => (
              <button
                key={result.messageId}
                type="button"
                role="listitem"
                onClick={() =>
                  onSelectResult(result.conversationId, result.messageId)
                }
                className="flex flex-col gap-1 px-3 py-3 text-left border-b last:border-b-0 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                {/* Partner name and timestamp */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-primary truncate">
                    {result.partnerName}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {formatTimestamp(result.createdAt)}
                  </span>
                </div>

                {/* Sender name */}
                <span className="text-xs text-muted-foreground">
                  {result.senderName}
                </span>

                {/* Highlighted content snippet */}
                <p
                  className="text-sm text-foreground line-clamp-2 [&_mark]:bg-primary/20 [&_mark]:text-foreground [&_mark]:rounded-sm [&_mark]:px-0.5"
                  dangerouslySetInnerHTML={{
                    __html: result.highlightedContent,
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
