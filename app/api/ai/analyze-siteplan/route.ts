import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  // 1. Require authenticated session
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validate server-only AI Engine env vars
  const aiEngineUrl = process.env.AI_ENGINE_URL;
  const aiEngineApiKey = process.env.AI_ENGINE_API_KEY;

  if (!aiEngineUrl || !aiEngineApiKey) {
    return NextResponse.json(
      { error: "AI Engine is not configured" },
      { status: 500 }
    );
  }

  try {
    // 3. Parse incoming FormData, then forward to the AI Engine
    // Using req.formData() ensures proper multipart boundary handling.
    // Do NOT manually set Content-Type — fetch auto-sets it for FormData.
    const formData = await req.formData();

    const aiResponse = await fetch(
      `${aiEngineUrl}/api/v1/analyze-siteplan`,
      {
        method: "POST",
        headers: {
          "X-API-Key": aiEngineApiKey,
        },
        body: formData,
      }
    );

    // 4. Return AI Engine response or mapped error
    if (!aiResponse.ok) {
      const status = aiResponse.status;

      // Map specific error codes
      if (status === 401) {
        return NextResponse.json(
          { error: "AI Engine authentication failed" },
          { status: 502 }
        );
      }

      // Try to get error detail from AI Engine
      let errorDetail = "AI Engine error";
      try {
        const errorBody = await aiResponse.json();
        errorDetail = errorBody.detail || errorBody.error || errorDetail;
      } catch {
        // If response body isn't JSON, use status text
        errorDetail = aiResponse.statusText || errorDetail;
      }

      return NextResponse.json(
        { error: errorDetail },
        { status: 502 }
      );
    }

    // Forward successful response
    const data = await aiResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    // Network error — AI Engine unreachable
    console.error("AI Engine proxy error:", error);
    return NextResponse.json(
      { error: "AI Engine unavailable" },
      { status: 502 }
    );
  }
}
