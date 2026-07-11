"use server";

import { getCurrentUser } from "@/server/permissions";
import {
  validateAndSendMessage,
  markConversationRead,
} from "@/server/services/chat.service";
import { getUserById } from "@/server/repositories/chat.repo";
import type { ActionResult } from "@/lib/action-utils";
import type { SendMessageInput } from "@/server/validators/chat";

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

/**
 * Server Action: Send a chat message.
 *
 * Auth guard → validate sender status → validate input → delegate to service.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1, 7.2
 */
export async function sendMessage(
  input: SendMessageInput
): Promise<ActionResult<{
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}>> {
  // Auth guard: get current user
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Unauthorized" };
  }

  // Validate sender account status is active
  const sender = await getUserById(currentUser.id);
  if (!sender || sender.status !== "active") {
    return { success: false, error: "Akun tidak aktif" };
  }

  // Structural validation: recipientId must be present
  if (!input.recipientId || input.recipientId.trim().length === 0) {
    return { success: false, error: "Recipient ID is required" };
  }

  // Delegate to service layer for business validation (trim, length, recipient status)
  // The service layer enforces the correct validation priority order.
  return validateAndSendMessage({
    senderId: currentUser.id,
    recipientId: input.recipientId,
    content: input.content ?? "",
  });
}

// ---------------------------------------------------------------------------
// markConversationAsRead
// ---------------------------------------------------------------------------

/**
 * Server Action: Mark all messages in a conversation as read.
 *
 * Requirements: 6.1, 6.2
 */
export async function markConversationAsRead(
  conversationId: string
): Promise<ActionResult<{ conversationId: string; updatedCount: number }>> {
  // Auth guard
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Unauthorized" };
  }

  return markConversationRead(conversationId, currentUser.id);
}
