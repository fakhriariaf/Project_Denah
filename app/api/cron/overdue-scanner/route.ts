import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
// Calls the INTERNAL service, not the server action. The action now carries a
// role gate for its manual UI trigger, which a session-less cron request would
// always fail. This route's own CRON_SECRET check is the authorisation here.
import { runOverdueSpkScan, runKprSlaOverdueScan } from "@/server/services/reminder.service";

/**
 * Verifies the cron authorization token using timing-safe comparison.
 * Uses strict Bearer parsing via regex to avoid accepting malformed headers.
 */
function verifyCronToken(authHeader: string | null, expectedSecret: string): boolean {
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const token = match[1];
  const tokenBuf = Buffer.from(token, "utf-8");
  const secretBuf = Buffer.from(expectedSecret, "utf-8");

  if (tokenBuf.length !== secretBuf.length) return false;

  return timingSafeEqual(tokenBuf, secretBuf);
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "Cron secret is not configured in the application environment." },
      { status: 500 }
    );
  }

  if (!verifyCronToken(authHeader, cronSecret)) {
    return NextResponse.json(
      { error: "Unauthorized access: Invalid or missing authorization token." },
      { status: 401 }
    );
  }

  try {
    const spkResult = await runOverdueSpkScan();
    const kprSlaResult = await runKprSlaOverdueScan();
    return NextResponse.json({
      message: "Daily overdue checks (SPK + KPR SLA) executed successfully.",
      spk: spkResult,
      kprSla: kprSlaResult,
    });
  } catch (error: any) {
    console.error("Cron Job [overdue-scanner] execution failed:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
