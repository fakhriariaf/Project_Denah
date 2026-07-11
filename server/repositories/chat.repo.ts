/**
 * chat.repo.ts
 *
 * Database query functions for the Internal Chat domain.
 * Encapsulates all SELECT, INSERT, UPDATE operations for messages and presence.
 */

import { db } from "@/db";
import { messages, userPresence } from "@/db/schema/chat";
import { user as userTable } from "@/db/schema/auth";
import { eq, and, desc, lt, ilike, or, sql } from "drizzle-orm";
import { MESSAGES_PER_PAGE } from "@/lib/chat-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InsertMessageData {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

export interface GetMessagesOptions {
  before?: string; // ISO timestamp cursor — fetch messages older than this
  limit?: number;
}

// ---------------------------------------------------------------------------
// Message queries
// ---------------------------------------------------------------------------

/**
 * Insert a new message into the messages table.
 */
export async function insertMessage(data: InsertMessageData) {
  const [inserted] = await db
    .insert(messages)
    .values({
      id: data.id,
      conversationId: data.conversationId,
      senderId: data.senderId,
      recipientId: data.recipientId,
      content: data.content,
      isRead: data.isRead,
      createdAt: data.createdAt,
    })
    .returning();

  return inserted;
}

/**
 * Get messages for a conversation with cursor-based pagination.
 * Returns messages ordered chronologically (oldest first within the page).
 * Uses `before` cursor to fetch older messages.
 */
export async function getMessagesByConversation(
  conversationId: string,
  options?: GetMessagesOptions
) {
  const limit = options?.limit ?? MESSAGES_PER_PAGE;

  const conditions = [eq(messages.conversationId, conversationId)];

  if (options?.before) {
    conditions.push(lt(messages.createdAt, new Date(options.before)));
  }

  const rows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  // Return in chronological order (oldest first)
  return rows.reverse();
}

/**
 * Mark all unread messages in a conversation as read for a specific recipient.
 * Returns the list of updated message IDs for counting purposes.
 */
export async function markMessagesAsRead(
  conversationId: string,
  recipientId: string
): Promise<{ id: string }[]> {
  const result = await db
    .update(messages)
    .set({ isRead: true })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.recipientId, recipientId),
        eq(messages.isRead, false)
      )
    )
    .returning({ id: messages.id });

  return result;
}

// ---------------------------------------------------------------------------
// Presence queries
// ---------------------------------------------------------------------------

/**
 * Get user presence record by user ID.
 */
export async function getUserPresence(userId: string) {
  const [row] = await db
    .select()
    .from(userPresence)
    .where(eq(userPresence.userId, userId))
    .limit(1);

  return row ?? null;
}

/**
 * Upsert user heartbeat — insert if not exists, update last_heartbeat if exists.
 */
export async function upsertHeartbeat(userId: string) {
  const now = new Date();
  const id = `presence_${userId}`;

  await db
    .insert(userPresence)
    .values({
      id,
      userId,
      lastHeartbeat: now,
      status: "online",
    })
    .onConflictDoUpdate({
      target: userPresence.userId,
      set: {
        lastHeartbeat: now,
        status: "online",
      },
    });
}

// ---------------------------------------------------------------------------
// Conversation queries
// ---------------------------------------------------------------------------

/**
 * Get all conversations for a user with last message preview.
 * Returns distinct conversations ordered by most recent message.
 */
export async function getConversationsForUser(userId: string) {
  // Get all messages where user is sender or recipient, grouped by conversationId
  const rows = await db
    .select({
      conversationId: messages.conversationId,
      lastMessageAt: sql<Date>`MAX(${messages.createdAt})`.as("last_message_at"),
    })
    .from(messages)
    .where(
      or(eq(messages.senderId, userId), eq(messages.recipientId, userId))
    )
    .groupBy(messages.conversationId)
    .orderBy(desc(sql`MAX(${messages.createdAt})`));

  return rows;
}

// ---------------------------------------------------------------------------
// Search queries
// ---------------------------------------------------------------------------

/**
 * Search messages using case-insensitive text matching (ILIKE).
 * Only returns messages in conversations involving the given user.
 */
export async function searchMessages(
  userId: string,
  query: string,
  page: number = 1
) {
  const offset = (page - 1) * MESSAGES_PER_PAGE;

  const rows = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        or(eq(messages.senderId, userId), eq(messages.recipientId, userId)),
        ilike(messages.content, `%${query}%`)
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(MESSAGES_PER_PAGE)
    .offset(offset);

  return rows;
}

// ---------------------------------------------------------------------------
// User queries (for chat context)
// ---------------------------------------------------------------------------

/**
 * Get a user by ID (for checking status, etc.)
 */
export async function getUserById(userId: string) {
  const [row] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      status: userTable.status,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  return row ?? null;
}
