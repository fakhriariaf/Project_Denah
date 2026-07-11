"use client"

import { ChevronLeft } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

interface ChatHeaderProps {
  partnerName: string
  partnerImage?: string | null
  partnerStatus: "online" | "offline"
  onBack?: () => void
}

export function ChatHeader({
  partnerName,
  partnerImage,
  partnerStatus,
  onBack,
}: ChatHeaderProps) {
  const initials = partnerName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-3 md:px-4">
      {/* Back button — mobile only */}
      {onBack && (
        <button
          onClick={onBack}
          className="md:hidden p-2 rounded-lg hover:bg-muted"
          aria-label="Kembali ke daftar"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Avatar with online indicator */}
      <div className="relative">
        <Avatar size="default">
          {partnerImage && (
            <AvatarImage src={partnerImage} alt={partnerName} />
          )}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        {/* Online/offline dot */}
        <span
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-background ${
            partnerStatus === "online" ? "bg-green-500" : "bg-muted-foreground/40"
          }`}
          aria-hidden="true"
        />
      </div>

      {/* Name and status */}
      <div className="flex flex-col min-w-0">
        <span className="font-semibold text-sm truncate">{partnerName}</span>
        <span
          className={`text-xs ${
            partnerStatus === "online"
              ? "text-green-600"
              : "text-muted-foreground"
          }`}
        >
          {partnerStatus === "online" ? "Online" : "Offline"}
        </span>
      </div>
    </header>
  )
}
