"use client"

import { useChatUnread } from "@/components/providers/chat-unread-provider"

export function ChatBadge() {
  const { totalUnread } = useChatUnread()
  if (totalUnread === 0) return null
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground min-w-[18px]">
      {totalUnread > 99 ? "99+" : totalUnread}
    </span>
  )
}
