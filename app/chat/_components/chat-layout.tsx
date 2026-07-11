"use client"

import { useState } from "react"
import { Search, Users } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { generateConversationId } from "@/lib/chat-utils"
import { useConversationList } from "@/hooks/use-conversation-list"
import { usePresencePolling } from "@/hooks/use-presence-polling"
import { useMessagePolling, type MessageItem } from "@/hooks/use-message-polling"
import { markConversationAsRead } from "@/server/actions/chat"

import { HeartbeatProvider } from "./heartbeat-provider"
import { ConversationList } from "./conversation-list"
import { UserList } from "./user-list"
import { ChatHeader } from "./chat-header"
import { MessageList } from "./message-list"
import { MessageInput } from "./message-input"
import { SearchPanel } from "./search-panel"

type LeftPanelView = "conversations" | "users" | "search"

export function ChatLayout() {
  const { data: session } = authClient.useSession()
  const currentUserId = (session?.user as any)?.id as string | undefined

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null)
  const [activePartnerName, setActivePartnerName] = useState<string>("")
  const [activePartnerImage, setActivePartnerImage] = useState<string | null>(null)
  const [activePartnerStatus, setActivePartnerStatus] = useState<"online" | "offline">("offline")
  const [leftPanelView, setLeftPanelView] = useState<LeftPanelView>("conversations")

  const { conversations, isLoading, error: conversationError, refetch } = useConversationList()
  const { users, error: presenceError } = usePresencePolling()
  const {
    messages,
    isLoading: messagesLoading,
    loadOlder,
    hasMore,
    error: messageError,
    appendLocalMessage,
    addPendingMessage,
    confirmMessage,
    failMessage,
    retryMessage,
    removeMessage,
    pollNew,
    recordActivity,
  } = useMessagePolling(activeConversationId)

  const hasConnectionError = !!(presenceError || conversationError || messageError)

  // --- Optimistic message update handlers ---

  /** Add a pending message instantly to the UI */
  function handlePendingMessage(message: MessageItem) {
    addPendingMessage(message)
  }

  /** Server confirmed: transition pending → sent, replace tempId with real id */
  function handleMessageConfirmed(tempId: string, realMessage: MessageItem) {
    confirmMessage(tempId, realMessage)
    // Immediate poll to pick up any interleaved messages without waiting 5s
    void pollNew()
    refetch()
  }

  /** Server failed: transition pending → failed */
  function handleMessageFailed(tempId: string) {
    failMessage(tempId)
  }

  /** Retry a failed message: reset to pending and resend */
  async function handleRetry(tempId: string, content: string, _recipientId: string) {
    // Use activePartnerId as the actual recipient
    if (!activePartnerId) return
    retryMessage(tempId)
    try {
      const { sendMessage } = await import("@/server/actions/chat")
      const result = await sendMessage({ recipientId: activePartnerId, content })
      if (result.success) {
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
        confirmMessage(tempId, confirmedMessage)
        void pollNew()
        refetch()
      } else {
        failMessage(tempId)
      }
    } catch {
      failMessage(tempId)
    }
  }

  /** Delete a failed message from local state */
  function handleDeleteFailed(tempId: string) {
    removeMessage(tempId)
  }

  // Open a conversation (from conversation list or user list)
  async function handleSelectConversation(conversationId: string, partnerId: string) {
    setActiveConversationId(conversationId)
    setActivePartnerId(partnerId)

    // Find partner info from conversations list or users list
    const conv = conversations.find((c) => c.conversationId === conversationId)
    if (conv) {
      setActivePartnerName(conv.partnerName)
      setActivePartnerImage(conv.partnerImage)
      setActivePartnerStatus(conv.partnerStatus)
    } else {
      // Might be a new conversation from user list — find in presence list
      const user = users.find((u) => u.userId === partnerId)
      if (user) {
        setActivePartnerName(user.name)
        setActivePartnerImage(user.image)
        setActivePartnerStatus(user.status)
      }
    }

    // Mark conversation as read in background, then refresh list
    await markConversationAsRead(conversationId)
    refetch()
  }

  // Start a new conversation by selecting a user from the user list
  function handleSelectUser(userId: string) {
    if (!currentUserId) return
    const conversationId = generateConversationId(currentUserId, userId)
    const user = users.find((u) => u.userId === userId)

    setActiveConversationId(conversationId)
    setActivePartnerId(userId)
    setActivePartnerName(user?.name ?? "Pengguna")
    setActivePartnerImage(user?.image ?? null)
    setActivePartnerStatus(user?.status ?? "offline")
    setLeftPanelView("conversations")
  }

  // Navigate from search result to a conversation
  function handleSearchResult(conversationId: string, _messageId: string) {
    // Find partner from conversations
    const conv = conversations.find((c) => c.conversationId === conversationId)
    if (conv) {
      handleSelectConversation(conversationId, conv.partnerId)
    } else {
      setActiveConversationId(conversationId)
    }
    setLeftPanelView("conversations")
  }

  // Mobile back button
  function handleBack() {
    setActiveConversationId(null)
    setActivePartnerId(null)
  }

  return (
    <HeartbeatProvider>
      <div className="flex h-full w-full flex-col overflow-hidden min-h-0">
        {/* Connection error banner */}
        {hasConnectionError && (
          <div className="shrink-0 bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-center text-sm text-destructive">
            Koneksi bermasalah — mencoba ulang...
          </div>
        )}

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* ─── Left Panel ─── */}
          <aside
            className={`w-full md:w-80 md:min-w-80 border-r flex flex-col bg-background ${
              activeConversationId ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Left panel toolbar */}
            <div className="flex shrink-0 items-center gap-1 border-b px-3 py-2">
              <button
                type="button"
                onClick={() => setLeftPanelView("conversations")}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  leftPanelView === "conversations"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setLeftPanelView("users")}
                className={`rounded-lg p-1.5 transition-colors ${
                  leftPanelView === "users"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                aria-label="Daftar pengguna"
              >
                <Users className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setLeftPanelView("search")}
                className={`rounded-lg p-1.5 transition-colors ${
                  leftPanelView === "search"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                aria-label="Cari pesan"
              >
                <Search className="size-4" />
              </button>
            </div>

            {/* Left panel content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {leftPanelView === "conversations" && (
                <ConversationList
                  activeConversationId={activeConversationId}
                  onSelectConversation={handleSelectConversation}
                  conversations={conversations}
                  isLoading={isLoading}
                />
              )}
              {leftPanelView === "users" && (
                <UserList
                  onSelectUser={handleSelectUser}
                  currentUserId={currentUserId}
                />
              )}
              {leftPanelView === "search" && (
                <SearchPanel onSelectResult={handleSearchResult} />
              )}
            </div>
          </aside>

          {/* ─── Right Panel: Conversation ─── */}
          <section
            className={`flex-1 flex flex-col bg-background min-h-0 ${
              activeConversationId ? "flex" : "hidden md:flex"
            }`}
          >
            {activeConversationId && activePartnerId ? (
              <>
                {/* Chat header */}
                <ChatHeader
                  partnerName={activePartnerName}
                  partnerImage={activePartnerImage}
                  partnerStatus={activePartnerStatus}
                  onBack={handleBack}
                />

                {/* Message list */}
                <MessageList
                  conversationId={activeConversationId}
                  messages={messages}
                  isLoading={messagesLoading}
                  loadOlder={loadOlder}
                  hasMore={hasMore}
                  onScroll={recordActivity}
                  onRetry={handleRetry}
                  onDeleteFailed={handleDeleteFailed}
                />

                {/* Message input */}
                <MessageInput
                  recipientId={activePartnerId}
                  currentUserId={currentUserId ?? ""}
                  conversationId={activeConversationId}
                  onPendingMessage={handlePendingMessage}
                  onMessageConfirmed={handleMessageConfirmed}
                  onMessageFailed={handleMessageFailed}
                  onActivity={recordActivity}
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center">
                  <Search className="size-7 opacity-50" />
                </div>
                <p className="text-sm">Pilih percakapan atau pengguna untuk mulai chat</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </HeartbeatProvider>
  )
}
