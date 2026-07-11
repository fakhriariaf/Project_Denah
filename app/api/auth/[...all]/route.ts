import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { isMaintenanceMode } from "@/lib/maintenance-cache";
import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { auditLogs } from "@/db/schema/system";
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
    const isSignOut = url.pathname.endsWith("/sign-out");

    // Read body early (before stream is consumed) for login audit
    let loginEmail: string | undefined;
    if (isSignIn) {
      const clonedBody = await req.clone().json().catch(() => ({}));
      loginEmail = clonedBody?.email?.trim().toLowerCase();
    }

    // Get session for logout audit BEFORE Better Auth clears it
    let logoutUserId: string | undefined;
    let logoutUserName: string | undefined;
    let logoutUserEmail: string | undefined;
    if (isSignOut) {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (session?.user) {
          logoutUserId = session.user.id;
          logoutUserName = session.user.name;
          logoutUserEmail = session.user.email;
        }
      } catch {}
    }

    // Maintenance mode check: intercept login requests BEFORE passing to Better Auth
    if (isSignIn && loginEmail) {
      const maintenanceActive = await isMaintenanceMode();
      if (maintenanceActive) {
        // Check if user is Super Admin
        const [foundUser] = await db
          .select({ roleId: userTable.roleId })
          .from(userTable)
          .where(eq(userTable.email, loginEmail))
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

    // Pass to Better Auth normally
    const res = await authPost(req);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "::1";

    // Audit log: Login success (non-blocking)
    // Better Auth returns 200 on success, or sometimes the body contains a token/session
    if (isSignIn && loginEmail && res.ok) {
      try {
        const [foundUser] = await db
          .select({ id: userTable.id, name: userTable.name })
          .from(userTable)
          .where(eq(userTable.email, loginEmail))
          .limit(1);

        if (foundUser) {
          // Update lastLogin
          await db.update(userTable).set({ lastLogin: new Date() }).where(eq(userTable.id, foundUser.id));

          // Write audit log
          await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            userId: foundUser.id,
            action: "login",
            module: "auth",
            entityId: foundUser.id,
            entityType: "user",
            ipAddress: ip,
            endpoint: "/api/auth/sign-in/email",
            details: { method: "email_password", userName: foundUser.name, email: loginEmail },
            level: "info",
            status: "success",
            responseCode: res.status,
            durationMs: null,
            createdAt: new Date(),
          });
        }
      } catch (auditErr) {
        console.warn("[Auth Audit] Login log failed:", auditErr);
      }
    }

    // Audit log: Logout (non-blocking)
    if (isSignOut && logoutUserId && res.ok) {
      try {
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          userId: logoutUserId,
          action: "logout",
          module: "auth",
          entityId: logoutUserId,
          entityType: "user",
          ipAddress: ip,
          endpoint: "/api/auth/sign-out",
          details: { userName: logoutUserName, email: logoutUserEmail },
          level: "info",
          status: "success",
          responseCode: res.status,
          durationMs: null,
          createdAt: new Date(),
        });
      } catch (auditErr) {
        console.warn("[Auth Audit] Logout log failed:", auditErr);
      }
    }

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
