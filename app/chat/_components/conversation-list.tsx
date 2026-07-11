"use client"

import { MessageCircle } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"

interface ConversationItem {
  conversationId: string
  partnerId: string
  partnerName: string
  partnerImage: string | null
  partnerStatus: "online" | "offline"
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
}

interface ConversationListProps {
  activeConversationId: string | null
  onSelectConversation: (conversationId: string, partnerId: string) => void
  conversations: ConversationItem[]
  isLoading: boolean
}

/**
 * Formats an ISO timestamp into a short relative time string (Indonesian).
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return "Baru saja"
  if (diffMinutes < 60) return `${diffMinutes}m`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}j`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}h`
}

/**
 * Extracts initials from a name (max 2 chars).
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function ConversationList({
  activeConversationId,
  onSelectConversation,
  conversations,
  isLoading,
}: ConversationListProps) {

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
        <MessageCircle className="size-10 opacity-50" />
        <p className="text-sm">Belum ada percakapan</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto" role="list" aria-label="Daftar percakapan">
      {conversations.map((conversation) => {
        const isActive = activeConversationId === conversation.conversationId
        const isOnline = conversation.partnerStatus === "online"

        return (
          <button
            key={conversation.conversationId}
            role="listitem"
            type="button"
            onClick={() =>
              onSelectConversation(
                conversation.conversationId,
                conversation.partnerId
              )
            }
            className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
              isActive ? "bg-primary/10" : ""
            }`}
            aria-current={isActive ? "true" : undefined}
          >
            {/* Avatar with online indicator */}
            <div className="relative shrink-0">
              <Avatar>
                {conversation.partnerImage ? (
                  <AvatarImage
                    src={conversation.partnerImage}
                    alt={conversation.partnerName}
                  />
                ) : null}
                <AvatarFallback>
                  {getInitials(conversation.partnerName)}
                </AvatarFallback>
              </Avatar>
              {isOnline && (
                <span
                  className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 ring-2 ring-background"
                  aria-label="Online"
                />
              )}
            </div>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {conversation.partnerName}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatRelativeTime(conversation.lastMessageAt)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {conversation.lastMessage}
                </span>
                {conversation.unreadCount > 0 && (
                  <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary-foreground">
                    {conversation.unreadCount > 99
                      ? "99+"
                      : conversation.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
