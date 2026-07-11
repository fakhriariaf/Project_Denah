"use client"

import { Loader2, RotateCcw, Trash2 } from "lucide-react"
import type { MessageItem as MessageItemType } from "@/hooks/use-message-polling"

interface MessageItemProps {
  message: MessageItemType
  /** Called to retry a failed message */
  onRetry?: (tempId: string, content: string, recipientId: string) => void
  /** Called to delete a failed message from local state */
  onDelete?: (tempId: string) => void
}

/**
 * Formats a timestamp for display.
 * - Today: HH:mm
 * - Older: dd/MM HH:mm
 */
function formatMessageTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")

  if (isToday) {
    return `${hours}:${minutes}`
  }

  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  return `${day}/${month} ${hours}:${minutes}`
}

export function MessageItem({ message, onRetry, onDelete }: MessageItemProps) {
  const isOwn = message.isOwn
  const status = message.status
  const isPending = status === "pending"
  const isFailed = status === "failed"

  return (
    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} mb-3`}>
      {/* Sender name — only for received messages */}
      {!isOwn && (
        <span className="text-xs text-muted-foreground mb-1 ml-1">
          {message.senderName}
        </span>
      )}

      {/* Message bubble */}
      <div
        className={`${
          isOwn
            ? "ml-auto bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[75%]"
            : "mr-auto bg-muted rounded-2xl rounded-bl-sm px-4 py-2 max-w-[75%]"
        } ${isPending ? "opacity-60" : ""} ${isFailed ? "opacity-80" : ""}`}
      >
        <div className="flex items-center gap-2">
          <p className="text-sm whitespace-pre-wrap break-words flex-1">
            {message.content}
          </p>
          {/* Pending spinner */}
          {isPending && (
            <Loader2 className="size-3.5 animate-spin shrink-0 opacity-70" />
          )}
        </div>
      </div>

      {/* Status row: timestamp + status indicators */}
      <div
        className={`flex items-center gap-1.5 mt-0.5 ${
          isOwn ? "mr-1" : "ml-1"
        }`}
      >
        <span className="text-[11px] text-muted-foreground">
          {formatMessageTime(message.createdAt)}
        </span>
        {/* Read receipt — only for own sent messages that are read */}
        {isOwn && message.isRead && !isPending && !isFailed && (
          <span className="text-[11px] text-emerald-600" aria-label="Sudah dibaca">✓</span>
        )}
      </div>

      {/* Failed state: error text + retry/delete buttons */}
      {isFailed && isOwn && message.tempId && (
        <div className={`flex items-center gap-2 mt-1 ${isOwn ? "mr-1" : "ml-1"}`}>
          <span className="text-[11px] text-destructive font-medium">
            Gagal kirim
          </span>
          <button
            type="button"
            onClick={() =>
              onRetry?.(message.tempId!, message.content, message.conversationId)
            }
            className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-primary/80 transition-colors"
            aria-label="Coba lagi kirim pesan"
          >
            <RotateCcw className="size-3" />
            Coba lagi
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(message.tempId!)}
            className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Hapus pesan gagal"
          >
            <Trash2 className="size-3" />
            Hapus
          </button>
        </div>
      )}
    </div>
  )
}
