import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { upsertHeartbeat, getUserById } from "@/server/repositories/chat.repo";
import { checkRateLimit } from "@/lib/chat-rate-limiter";

export async function POST() {
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

  const user = await getUserById(session.user.id);
  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "Akun tidak aktif" }, { status: 403 });
  }

  await upsertHeartbeat(session.user.id);

  return NextResponse.json({ success: true });
}
