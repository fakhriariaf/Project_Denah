import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { messages } from "@/db/schema/chat";
import { eq, and, sql } from "drizzle-orm";
import { checkRateLimit } from "@/lib/chat-rate-limiter";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting — graceful degradation if the limiter throws
  try {
    const rl = checkRateLimit(session.user.id);
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
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, session.user.id),
          eq(messages.isRead, false)
        )
      );

    return NextResponse.json({ totalUnread: result?.count ?? 0 });
  } catch (error) {
    console.error("[chat/unread-count] Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
