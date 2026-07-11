/**
 * chat.service.ts
 *
 * Business logic orchestration for Internal Chat.
 * Validates inputs, enforces business rules, and delegates to repository layer.
 */

import { randomUUID } from "crypto";
import { generateConversationId, MESSAGE_MAX_LENGTH } from "@/lib/chat-utils";
import {
  insertMessage,
  markMessagesAsRead,
  getUserById,
} from "@/server/repositories/chat.repo";
import type { ActionResult } from "@/lib/action-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidatedSendMessageInput {
  senderId: string;
  recipientId: string;
  content: string;
}

export interface MessageResult {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Validates and sends a message.
 *
 * Validation priority:
 * 1. Empty after trim → "Pesan tidak boleh kosong"
 * 2. Exceeds 2000 chars → "Pesan maksimal 2000 karakter"
 * 3. Recipient inactive/suspended → "Penerima tidak tersedia"
 */
export async function validateAndSendMessage(
  input: ValidatedSendMessageInput
): Promise<ActionResult<MessageResult>> {
  const { senderId, recipientId, content } = input;

  // Trim content
  const trimmedContent = content.trim();

  // Validation 1: Empty after trim
  if (trimmedContent.length === 0) {
    return { success: false, error: "Pesan tidak boleh kosong" };
  }

  // Validation 2: Exceeds max length
  if (trimmedContent.length > MESSAGE_MAX_LENGTH) {
    return { success: false, error: "Pesan maksimal 2000 karakter" };
  }

  // Validation 3: Check recipient status
  const recipient = await getUserById(recipientId);
  if (!recipient) {
    return { success: false, error: "Pengguna tidak ditemukan" };
  }
  if (recipient.status !== "active") {
    return { success: false, error: "Penerima tidak tersedia" };
  }

  // Generate deterministic conversation ID
  const conversationId = generateConversationId(senderId, recipientId);

  // Create message
  const messageId = randomUUID();
  const now = new Date();

  const inserted = await insertMessage({
    id: messageId,
    conversationId,
    senderId,
    recipientId,
    content: trimmedContent,
    isRead: false,
    createdAt: now,
  });

  return {
    success: true,
    data: {
      id: inserted.id,
      conversationId: inserted.conversationId,
      senderId: inserted.senderId,
      recipientId: inserted.recipientId,
      content: inserted.content,
      isRead: inserted.isRead,
      createdAt: inserted.createdAt,
    },
  };
}

/**
 * Mark all messages in a conversation as read for the given user.
 * Returns the count of messages that were updated.
 */
export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<ActionResult<{ conversationId: string; updatedCount: number }>> {
  const updated = await markMessagesAsRead(conversationId, userId);

  return {
    success: true,
    data: { conversationId, updatedCount: updated.length },
  };
}
