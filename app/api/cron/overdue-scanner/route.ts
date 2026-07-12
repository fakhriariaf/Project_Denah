import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { checkOverdueSpks } from "@/server/actions/production";

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
    const result = await checkOverdueSpks();
    return NextResponse.json({
      message: "Daily SPK overdue check executed successfully.",
      ...result
    });
  } catch (error: any) {
    console.error("Cron Job [overdue-scanner] execution failed:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
