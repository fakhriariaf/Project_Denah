import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { isMaintenanceMode } from "@/lib/maintenance-cache";
import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { roles } from "@/db/schema/access";
import { eq } from "drizzle-orm";

const { GET: authGet, POST: authPost } = toNextJsHandler(auth);

export async function GET(req: NextRequest) {
  try {
    const res = await authGet(req);
    return res;
  } catch (error: any) {
    console.error("[Better Auth GET Error]:", error);
    return NextResponse.json({ error: { message: String(error.message || error), code: "AUTH_ERROR" } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const isSignIn = url.pathname.endsWith("/sign-in/email");

    // Maintenance mode check: intercept login requests BEFORE passing to Better Auth
    if (isSignIn) {
      const maintenanceActive = await isMaintenanceMode();
      if (maintenanceActive) {
        // Clone request to read body without consuming it
        const body = await req.clone().json().catch(() => ({}));
        const email = body?.email?.trim().toLowerCase();

        if (email) {
          // Check if user is Super Admin
          const [foundUser] = await db
            .select({ roleId: userTable.roleId })
            .from(userTable)
            .where(eq(userTable.email, email))
            .limit(1);

          let isSuperAdmin = false;
          if (foundUser?.roleId) {
            const [userRole] = await db
              .select({ name: roles.name })
              .from(roles)
              .where(eq(roles.id, foundUser.roleId))
              .limit(1);
            isSuperAdmin = userRole?.name === "Super Admin";
          }

          if (!isSuperAdmin) {
            return NextResponse.json(
              {
                error: {
                  message: "Sistem sedang dalam pemeliharaan. Silakan coba lagi nanti.",
                  code: "MAINTENANCE_MODE",
                },
              },
              { status: 503 }
            );
          }
        }
      }
    }

    // Pass to Better Auth normally
    const res = await authPost(req);
    return res;
  } catch (error: any) {
    console.error("[Better Auth POST Error]:", error);
    const message = error?.message || "Internal Server Error";
    return NextResponse.json(
      { error: { message, code: "AUTH_ERROR" } },
      { status: 500 }
    );
  }
}
