"use client"

import { useState, useRef } from "react"
import { Send, Loader2 } from "lucide-react"
import { sendMessage } from "@/server/actions/chat"
import { Button } from "@/components/ui/button"
import { useAutoResize, MIN_HEIGHT } from "@/hooks/use-auto-resize"
import type { MessageItem } from "@/hooks/use-message-polling"

interface MessageInputProps {
  recipientId: string
  currentUserId: string
  conversationId: string
  /** Called immediately to add a pending message to the UI */
  onPendingMessage?: (message: MessageItem) => void
  /** Called when server confirms the message (replace tempId with real id) */
  onMessageConfirmed?: (tempId: string, realMessage: MessageItem) => void
  /** Called when server fails to deliver the message */
  onMessageFailed?: (tempId: string) => void
  /** Called to retry a failed message */
  onRetry?: (tempId: string, content: string, recipientId: string) => void
  /** Called to delete a failed message from local state */
  onDeleteFailed?: (tempId: string) => void
  /** Called on keypress/focus to record user activity for adaptive polling */
  onActivity?: () => void
}

/** Generate a unique temporary ID for optimistic messages */
function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function MessageInput({
  recipientId,
  currentUserId,
  conversationId,
  onPendingMessage,
  onMessageConfirmed,
  onMessageFailed,
  onActivity,
}: MessageInputProps) {
  const [content, setContent] = useState("")
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { resize } = useAutoResize(textareaRef)

  const isDisabled = isSending || !content.trim()

  const handleSend = async () => {
    const trimmedContent = content.trim()
    if (!trimmedContent) return

    // Record activity on send
    onActivity?.()

    // Generate tempId and create pending message
    const tempId = generateTempId()
    const pendingMessage: MessageItem = {
      id: tempId, // Use tempId as id until confirmed
      conversationId,
      senderId: currentUserId,
      senderName: "",
      content: trimmedContent,
      createdAt: new Date().toISOString(),
      isOwn: true,
      isRead: false,
      status: "pending",
      tempId,
    }

    // Immediately show the pending message
    onPendingMessage?.(pendingMessage)
    setContent("")
    // Reset textarea to 1 line after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_HEIGHT}px`
      textareaRef.current.style.overflowY = "hidden"
    }
    setIsSending(true)

    try {
      const result = await sendMessage({ recipientId, content: trimmedContent })
      if (result.success) {
        // Transition: pending → sent, replace tempId with real id
        const confirmedMessage: MessageItem = {
          id: result.data.id,
          conversationId: result.data.conversationId,
          senderId: result.data.senderId,
          senderName: "",
          content: result.data.content,
          createdAt:
            result.data.createdAt instanceof Date
              ? result.data.createdAt.toISOString()
              : String(result.data.createdAt),
          isOwn: true,
          isRead: false,
          status: "sent",
        }
        onMessageConfirmed?.(tempId, confirmedMessage)
      } else {
        // Transition: pending → failed
        onMessageFailed?.(tempId)
      }
    } catch {
      // Transition: pending → failed
      onMessageFailed?.(tempId)
    } finally {
      setIsSending(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Record activity on any keypress in textarea
    onActivity?.()
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    // Shift+Enter: default textarea behavior (newline)
  }

  return (
    <div className="shrink-0 border-t bg-background p-3">
      {/* Character count indicator — show when approaching limit */}
      {content.length > 1800 && (
        <div className="mb-1.5 flex justify-end px-1">
          <span
            className={`text-xs tabular-nums ${
              content.length > 2000
                ? "text-destructive font-medium"
                : "text-muted-foreground"
            }`}
          >
            {content.length}/2000
          </span>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            resize()
          }}
          onKeyDown={handleKeyDown}
          onFocus={onActivity}
          placeholder="Ketik pesan..."
          aria-label="Ketik pesan"
          disabled={isSending}
          style={{ height: `${MIN_HEIGHT}px`, overflowY: "hidden" }}
          className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={handleSend}
          disabled={isDisabled}
          aria-label="Kirim pesan"
          className="shrink-0 text-primary hover:text-primary/80 hover:bg-primary/10 disabled:opacity-40"
        >
          {isSending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Send className="size-5" />
          )}
        </Button>
      </div>
    </div>
  )
}
