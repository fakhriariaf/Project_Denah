"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { useChatUnread } from "@/components/providers/chat-unread-provider"

/**
 * Chat icon button for the app header — placed beside the notification bell.
 * Shows a badge with the total unread message count and links to /chat.
 */
export function ChatNavButton() {
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const { totalUnread } = useChatUnread()

  // Only show for authenticated users
  if (!session?.user) return null

  const isActive = pathname.startsWith("/chat")

  return (
    <Link
      href="/chat"
      aria-label={
        totalUnread > 0 ? `Chat, ${totalUnread} pesan belum dibaca` : "Chat"
      }
      className={`relative p-2 rounded-full transition-all duration-200 focus:outline-none group ${
        isActive
          ? "text-[#4F6F52] bg-accent"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      <MessageCircle className="w-5 h-5 transition-all duration-300 group-hover:scale-110 group-hover:text-[#4F6F52]" />
      {totalUnread > 0 && (
        <span className="absolute top-1 right-1 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white ring-2 ring-background font-mono tabular-nums animate-pulse">
          {totalUnread > 99 ? "99+" : totalUnread}
        </span>
      )}
    </Link>
  )
}
