import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { searchSchema } from "@/server/validators/chat";
import { db } from "@/db";
import { messages } from "@/db/schema/chat";
import { user as userTable } from "@/db/schema/auth";
import { eq, and, or, ilike, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { checkRateLimit } from "@/lib/chat-rate-limiter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResultItem {
  messageId: string;
  conversationId: string;
  partnerName: string;
  content: string;
  senderName: string;
  createdAt: string;
  highlightedContent: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEARCH_PAGE_SIZE = 20;

/**
 * Escape special regex characters in the search query
 * to prevent regex injection in highlightedContent.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// GET /api/chat/search?q=...&page=...
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Auth guard
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

  // Parse query params
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const page = searchParams.get("page") || "1";

  // Validate with Zod
  const parsed = searchSchema.safeParse({ q, page });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { q: query, page: pageNum } = parsed.data;
  const offset = (pageNum - 1) * SEARCH_PAGE_SIZE;

  // Create aliases for JOINs to user table
  const senderUser = alias(userTable, "sender_user");
  const recipientUser = alias(userTable, "recipient_user");

  // Search messages where the current user is sender OR recipient
  // JOIN with user table to get senderName and partnerName
  const rows = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      content: messages.content,
      createdAt: messages.createdAt,
      senderName: senderUser.name,
      recipientName: recipientUser.name,
    })
    .from(messages)
    .innerJoin(senderUser, eq(messages.senderId, senderUser.id))
    .innerJoin(recipientUser, eq(messages.recipientId, recipientUser.id))
    .where(
      and(
        or(eq(messages.senderId, userId), eq(messages.recipientId, userId)),
        ilike(messages.content, `%${query}%`)
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(SEARCH_PAGE_SIZE)
    .offset(offset);

  // Map results to SearchResultItem
  const escapedQuery = escapeRegex(query);
  const highlightRegex = new RegExp(`(${escapedQuery})`, "gi");

  const results: SearchResultItem[] = rows.map((row) => {
    // Partner is the other user in the conversation
    const partnerName =
      row.senderId === userId ? row.recipientName : row.senderName;

    const highlightedContent = row.content.replace(
      highlightRegex,
      "<mark>$1</mark>"
    );

    return {
      messageId: row.id,
      conversationId: row.conversationId,
      partnerName,
      content: row.content,
      senderName: row.senderName,
      createdAt: row.createdAt.toISOString(),
      highlightedContent,
    };
  });

  return NextResponse.json({
    results,
    page: pageNum,
    pageSize: SEARCH_PAGE_SIZE,
    hasMore: rows.length === SEARCH_PAGE_SIZE,
  });
}
