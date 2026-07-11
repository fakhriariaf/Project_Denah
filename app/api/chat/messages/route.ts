import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema/chat";
import { user as userTable } from "@/db/schema/auth";
import { eq, and, gt, lt, desc, asc } from "drizzle-orm";
import { MESSAGES_PER_PAGE } from "@/lib/chat-utils";
import { generateMessagesETag, checkETagMatch } from "@/lib/etag-utils";
import { checkRateLimit } from "@/lib/chat-rate-limiter";

// crypto (used by ETag generation) requires the Node.js runtime
export const runtime = "nodejs";

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isOwn: boolean;
  isRead: boolean;
}

export async function GET(request: NextRequest) {
  // Auth guard — return JSON 401, no redirect
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  const after = searchParams.get("after");
  const before = searchParams.get("before");

  // Validate conversationId is present
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 }
    );
  }

  // Verify current user is a participant of the conversation.
  // conversationId format: conv_${sorted[0]}_${sorted[1]}
  const currentUserId = session.user.id;
  const convParts = conversationId.split("_");
  // Exact match on the two participant slots (index 1 and 2 after "conv")
  if (convParts[1] !== currentUserId && convParts[2] !== currentUserId) {
    return NextResponse.json(
      { error: "Forbidden: not a participant" },
      { status: 403 }
    );
  }

  // Rate limiting — graceful degradation if the limiter throws
  try {
    const rl = checkRateLimit(currentUserId);
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
    let rows;

    if (after) {
      // Polling for new messages since timestamp
      // No limit — there shouldn't be too many in 5s interval
      rows = await db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          senderId: messages.senderId,
          senderName: userTable.name,
          content: messages.content,
          createdAt: messages.createdAt,
          isRead: messages.isRead,
        })
        .from(messages)
        .innerJoin(userTable, eq(messages.senderId, userTable.id))
        .where(
          and(
            eq(messages.conversationId, conversationId),
            gt(messages.createdAt, new Date(after))
          )
        )
        .orderBy(asc(messages.createdAt));
    } else if (before) {
      // Pagination: fetch older messages before cursor
      // SELECT DESC LIMIT 50, then reverse for chronological order
      const descRows = await db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          senderId: messages.senderId,
          senderName: userTable.name,
          content: messages.content,
          createdAt: messages.createdAt,
          isRead: messages.isRead,
        })
        .from(messages)
        .innerJoin(userTable, eq(messages.senderId, userTable.id))
        .where(
          and(
            eq(messages.conversationId, conversationId),
            lt(messages.createdAt, new Date(before))
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(MESSAGES_PER_PAGE);

      // Reverse to chronological order (oldest first)
      rows = descRows.reverse();
    } else {
      // Default: last 50 messages in chronological order
      const descRows = await db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          senderId: messages.senderId,
          senderName: userTable.name,
          content: messages.content,
          createdAt: messages.createdAt,
          isRead: messages.isRead,
        })
        .from(messages)
        .innerJoin(userTable, eq(messages.senderId, userTable.id))
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(MESSAGES_PER_PAGE);

      // Reverse to chronological order (oldest first)
      rows = descRows.reverse();
    }

    // Map to MessageItem[] with isOwn and isRead computed
    const result: MessageItem[] = rows.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      senderName: row.senderName,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      isOwn: row.senderId === currentUserId,
      isRead: row.isRead,
    }));

    // ETag conditional response support.
    // Fallback requirement: if ETag generation fails, return a normal 200 response.
    try {
      const etag = generateMessagesETag(
        result.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          isRead: r.isRead,
        }))
      );
      const ifNoneMatch = request.headers.get("if-none-match");
      if (checkETagMatch(ifNoneMatch, etag)) {
        return new NextResponse(null, {
          status: 304,
          headers: { ETag: `"${etag}"` },
        });
      }
      return NextResponse.json(result, { headers: { ETag: `"${etag}"` } });
    } catch {
      // Fallback: normal 200 response
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error("[chat/messages] Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
