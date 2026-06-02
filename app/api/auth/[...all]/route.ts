import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

const { GET: authGet, POST: authPost } = toNextJsHandler(auth);

export async function GET(req: NextRequest) {
  try {
    const host = req.headers.get("host");
    const origin = req.headers.get("origin");
    console.log("[Better Auth GET Request]:", req.url, "Host:", host, "Origin:", origin);
    const res = await authGet(req);
    console.log("[Better Auth GET Response Status]:", res.status);
    return res;
  } catch (error: any) {
    console.error("[Better Auth GET Error]:", error);
    return NextResponse.json({ error: String(error.message || error), stack: error.stack }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const host = req.headers.get("host");
    console.log("[Better Auth POST Request]:", req.url, "Host:", host);
    const res = await authPost(req);
    console.log("[Better Auth POST Response Status]:", res.status);
    return res;
  } catch (error: any) {
    console.error("[Better Auth POST Error]:", error);
    return NextResponse.json({ error: String(error.message || error), stack: error.stack }, { status: 500 });
  }
}
