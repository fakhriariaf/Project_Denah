"use client"

import { usePresencePolling } from "@/hooks/use-presence-polling"
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

interface UserListProps {
  onSelectUser: (userId: string) => void
  currentUserId?: string
}

/**
 * Displays all active users with their online/offline status.
 * Online users appear first (sorted by usePresencePolling hook).
 * Clicking a user triggers onSelectUser to open/create a conversation.
 */
export function UserList({ onSelectUser, currentUserId }: UserListProps) {
  const { users, isLoading, error } = usePresencePolling()

  // Filter out the current user from the list
  const filteredUsers = currentUserId
    ? users.filter((u) => u.userId !== currentUserId)
    : users

  if (error && users.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground">
        Gagal memuat daftar pengguna
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 px-4 py-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <UserSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (filteredUsers.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground">
        Tidak ada pengguna lain
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col py-1">
        {filteredUsers.map((user) => (
          <button
            key={user.userId}
            type="button"
            onClick={() => onSelectUser(user.userId)}
            className="flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            {/* Avatar with online/offline indicator */}
            <div className="relative shrink-0">
              <Avatar size="lg">
                {user.image ? (
                  <AvatarImage src={user.image} alt={user.name} />
                ) : null}
                <AvatarFallback>
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              {/* Online/offline dot — hidden when presence data is stale (connection error) */}
              {!error && (
                <span
                  className={`absolute bottom-0 right-0 z-10 size-3 rounded-full ring-2 ring-background ${
                    user.status === "online"
                      ? "bg-green-500"
                      : "bg-gray-300"
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* User name and status text */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {user.name}
              </p>
              {!error && (
                <p className="text-xs text-muted-foreground">
                  {user.status === "online" ? "Online" : "Offline"}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}

/** Loading skeleton for a single user row. */
function UserSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  )
}

/** Extract up to 2 initials from a name string. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}
