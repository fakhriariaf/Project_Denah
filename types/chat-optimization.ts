// types/chat-optimization.ts
// Shared TypeScript interfaces and types for Chat Polling Optimization
// Requirements: 2.1, 4.1, 5.1, 9.5, 11.4, 12.1, 13.2

// === Message Status for Optimistic Updates ===
export type MessageStatus = "pending" | "sent" | "failed";

export interface OptimisticMessage {
  tempId: string; // Client-generated temporary ID
  realId?: string; // Server-assigned ID (after confirmation)
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string; // Client timestamp
  status: MessageStatus;
  isOwn: true;
  isRead: false;
}

// === Enhanced MessageItem (with read receipt) ===
export interface EnhancedMessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isOwn: boolean;
  isRead: boolean; // untuk read receipt display
  status?: MessageStatus; // untuk optimistic update display
}

// === Unread Count Response ===
export interface UnreadCountResponse {
  totalUnread: number;
}

// === ETag-aware Fetch Result ===
export interface ETagFetchResult<T> {
  data: T | null; // null jika 304
  etag: string | null;
  notModified: boolean;
}

// === Rate Limit Error ===
export interface RateLimitError {
  error: string;
  retryAfterSeconds: number;
}

// === Polling State ===
export type PollingState = "ACTIVE" | "IDLE" | "HIDDEN";

export interface PollingStateInfo {
  state: PollingState;
  intervalMs: number;
  lastActivity: number; // Unix timestamp
  consecutiveFailures: number;
}

// === Message DOM Cap State ===
export interface MessageDomCapState {
  renderedCount: number;
  trimmedOlderCount: number;
  hasTrimmedOlderMessages: boolean;
}

// === New Message Pill State ===
export interface NewMessagePillState {
  visible: boolean;
  count: number;
  isAtBottom: boolean;
}
