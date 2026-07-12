"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import type { MessageItem as MessageItemType } from "@/hooks/use-message-polling"
import { MessageItem } from "./message-item"
import { DateSeparator } from "./date-separator"
import { NewMessagePill } from "./new-message-pill"
import { capRenderedMessages } from "./message-dom-cap"
import { shouldShowDateSeparator, formatDateLabel } from "@/lib/date-separator-utils"
import { Loader2 } from "lucide-react"

interface MessageListProps {
  conversationId: string | null
  messages: MessageItemType[]
  isLoading: boolean
  loadOlder: () => void
  hasMore: boolean
  /** Called on scroll to record user activity for adaptive polling */
  onScroll?: () => void
  /** Called to retry a failed message */
  onRetry?: (tempId: string, content: string, recipientId: string) => void
  /** Called to delete a failed message from local state */
  onDeleteFailed?: (tempId: string) => void
}

export function MessageList({
  conversationId,
  messages,
  isLoading,
  loadOlder,
  hasMore,
  onScroll: onScrollActivity,
  onRetry,
  onDeleteFailed,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [newMessageCount, setNewMessageCount] = useState(0)
  const prevMessageCountRef = useRef(messages.length)

  // Accessibility: track the latest incoming message for the aria-live region.
  // We use a ref to remember the last announced message id so we only update
  // the live region when a genuinely new incoming message arrives, not on every
  // poll cycle with unchanged data.
  const lastAnnouncedIdRef = useRef<string | null>(null)
  const [announcedMessage, setAnnouncedMessage] = useState<{
    senderName: string
    content: string
  } | null>(null)

  useEffect(() => {
    // Find the latest incoming (not own) message
    const latestIncoming = [...messages]
      .reverse()
      .find((m) => !m.isOwn && m.status !== "pending" && m.status !== "failed")

    if (latestIncoming && latestIncoming.id !== lastAnnouncedIdRef.current) {
      lastAnnouncedIdRef.current = latestIncoming.id
      setAnnouncedMessage({
        senderName: latestIncoming.senderName,
        content: latestIncoming.content,
      })
    }
  }, [messages])

  // Track new messages arriving while user is scrolled up
  useEffect(() => {
    const prevCount = prevMessageCountRef.current
    const currentCount = messages.length

    if (currentCount > prevCount && !isAtBottomRef.current) {
      // New messages arrived while user is scrolled up
      const delta = currentCount - prevCount
      setNewMessageCount((prev) => prev + delta)
    }

    // If user is at bottom, always reset count
    if (isAtBottomRef.current) {
      setNewMessageCount(0)
    }

    prevMessageCountRef.current = currentCount
  }, [messages])

  // Handle scroll: detect if user is at bottom + trigger loadOlder at top
  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current

    // Record activity for adaptive polling
    onScrollActivity?.()

    // Check if user is near bottom (within 50px)
    const atBottom = scrollHeight - scrollTop - clientHeight < 50
    isAtBottomRef.current = atBottom
    setIsAtBottom(atBottom)

    // User scrolled to bottom manually — hide pill
    if (atBottom) {
      setNewMessageCount(0)
    }

    // Infinite scroll up: load older when scrolled to top
    if (scrollTop === 0 && hasMore && !isLoading) {
      loadOlder()
    }
  }

  // Smooth scroll to bottom when pill is clicked
  const handlePillClick = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
    setNewMessageCount(0)
    setIsAtBottom(true)
    isAtBottomRef.current = true
  }, [])

  // Auto-scroll to bottom when new messages arrive (only if user is already at bottom)
  useEffect(() => {
    if (isAtBottomRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  // No conversation selected
  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Pilih percakapan untuk mulai chat</p>
      </div>
    )
  }

  // Initial loading state
  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  // Empty conversation
  if (!isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Belum ada pesan</p>
      </div>
    )
  }

  // DOM cap: only render the most recent MAX_RENDERED_MESSAGES (200) to keep the
  // DOM size bounded on long conversations. Because capRenderedMessages keeps the
  // LAST N messages, new messages at the bottom are never trimmed while the user
  // is at the bottom (Requirement 12.5). Older history is still fully available in
  // the source `messages` array and remains reachable via loadOlder() pagination.
  const { visibleMessages, hasTrimmedOlderMessages } = capRenderedMessages(messages)

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-3"
        data-has-trimmed-older={hasTrimmedOlderMessages ? "true" : "false"}
      >
        {/* Loading spinner at top when loading older messages */}
        {isLoading && hasMore && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {/* Messages in chronological order (oldest first, newest last).
            Rendered from the DOM-capped `visibleMessages` slice so the DOM never
            exceeds MAX_RENDERED_MESSAGES nodes. Date separator comparison uses the
            previous VISIBLE message which is correct while iterating visibleMessages. */}
        {visibleMessages.map((message, index) => {
          const previousMessage = index > 0 ? visibleMessages[index - 1] : null;
          const showSeparator = shouldShowDateSeparator(message, previousMessage);

          return (
            <div key={message.tempId ?? message.id}>
              {showSeparator && (
                <DateSeparator
                  label={formatDateLabel(new Date(message.createdAt))}
                />
              )}
              <MessageItem
                message={message}
                onRetry={onRetry}
                onDelete={onDeleteFailed}
              />
            </div>
          );
        })}
      </div>

      {/* New message pill — floating indicator */}
      <NewMessagePill
        count={newMessageCount}
        visible={!isAtBottom && newMessageCount > 0}
        onClick={handlePillClick}
      />

      {/* Accessibility: screen-reader-only live region for latest incoming message */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="log"
      >
        {announcedMessage ? (
          <span>
            {announcedMessage.senderName}: {announcedMessage.content}
          </span>
        ) : null}
      </div>
    </div>
  )
}
