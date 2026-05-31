import { NextRequest, NextResponse } from "next/server";
import { checkOverdueSpks } from "@/server/actions/production";

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

  const expectedAuth = `Bearer ${cronSecret}`;
  if (!authHeader || authHeader !== expectedAuth) {
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
