import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { userPresence } from "@/db/schema/chat";
import { eq, sql } from "drizzle-orm";
import { checkRateLimit } from "@/lib/chat-rate-limiter";

export interface UserPresenceItem {
  userId: string;
  name: string;
  image: string | null;
  status: "online" | "offline";
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
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

  const users = await db
    .select({
      userId: userTable.id,
      name: userTable.name,
      image: userTable.image,
      status: sql<string>`CASE WHEN ${userPresence.lastHeartbeat} > NOW() - INTERVAL '60 seconds' THEN 'online' ELSE 'offline' END`.as("status"),
    })
    .from(userTable)
    .leftJoin(userPresence, eq(userTable.id, userPresence.userId))
    .where(eq(userTable.status, "active"));

  return NextResponse.json(users as UserPresenceItem[]);
}
