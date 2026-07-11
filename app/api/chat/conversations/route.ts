import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages, userPresence } from "@/db/schema/chat";
import { user as userTable } from "@/db/schema/auth";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { checkRateLimit } from "@/lib/chat-rate-limiter";

export interface ConversationItem {
  conversationId: string;
  partnerId: string;
  partnerName: string;
  partnerImage: string | null;
  partnerStatus: "online" | "offline";
  lastMessage: string;
  lastMessageAt: string; // ISO timestamp
  unreadCount: number;
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Rate limiting — graceful degradation if the limiter throws
  try {
    const rl = checkRateLimit(userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti." },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSeconds ?? 30) },
        }
      );
    }
  } catch {
    // Graceful degradation: if rate limiter throws, allow the request
  }

  try {
    // Step 1: Get all distinct conversations for the user with last message info
    const conversations = await db
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

    if (conversations.length === 0) {
      return NextResponse.json([] as ConversationItem[]);
    }

    // Step 2: For each conversation, get last message, partner info, and unread count
    const results: ConversationItem[] = [];

    for (const conv of conversations) {
      // Get the last message for this conversation
      const [lastMsg] = await db
        .select({
          content: messages.content,
          senderId: messages.senderId,
          recipientId: messages.recipientId,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.conversationId, conv.conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      if (!lastMsg) continue;

      // Determine partner ID (the other user in the conversation)
      const partnerId =
        lastMsg.senderId === userId ? lastMsg.recipientId : lastMsg.senderId;

      // If partnerId is still the same as userId (user sent last message to themselves — edge case),
      // try to find the other participant from another message
      let resolvedPartnerId = partnerId;
      if (resolvedPartnerId === userId) {
        const [otherMsg] = await db
          .select({
            senderId: messages.senderId,
            recipientId: messages.recipientId,
          })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conv.conversationId),
              or(
                sql`${messages.senderId} != ${userId}`,
                sql`${messages.recipientId} != ${userId}`
              )
            )
          )
          .limit(1);

        if (otherMsg) {
          resolvedPartnerId =
            otherMsg.senderId === userId
              ? otherMsg.recipientId
              : otherMsg.senderId;
        }
      }

      // Get partner user info
      const [partner] = await db
        .select({
          id: userTable.id,
          name: userTable.name,
          image: userTable.image,
        })
        .from(userTable)
        .where(eq(userTable.id, resolvedPartnerId))
        .limit(1);

      if (!partner) continue;

      // Get partner presence status
      const [presence] = await db
        .select({
          status: sql<string>`CASE WHEN ${userPresence.lastHeartbeat} > NOW() - INTERVAL '60 seconds' THEN 'online' ELSE 'offline' END`.as(
            "status"
          ),
        })
        .from(userPresence)
        .where(eq(userPresence.userId, resolvedPartnerId))
        .limit(1);

      const partnerStatus: "online" | "offline" = presence?.status === "online" ? "online" : "offline";

      // Get unread count for this conversation (messages sent TO current user that are unread)
      const [unreadResult] = await db
        .select({
          count: sql<number>`COUNT(*)::int`.as("count"),
        })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conv.conversationId),
            eq(messages.recipientId, userId),
            eq(messages.isRead, false)
          )
        );

      const unreadCount = unreadResult?.count ?? 0;

      results.push({
        conversationId: conv.conversationId,
        partnerId: resolvedPartnerId,
        partnerName: partner.name,
        partnerImage: partner.image,
        partnerStatus,
        lastMessage: lastMsg.content,
        lastMessageAt: lastMsg.createdAt.toISOString(),
        unreadCount,
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("[chat/conversations] Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
