import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy Authentication Strategy
 * -----------------------------
 * We avoid making an HTTP call to /api/auth/get-session on every request
 * because it adds latency per page load.
 *
 * Instead, we inspect the Better Auth session cookie directly.
 * Better Auth sets a cookie named "better-auth.session_token" or the
 * "__Secure-" prefixed variant in production.
 *
 * The cookie check is only a lightweight route gate. Actual cryptographic
 * session validation still happens inside server actions and API routes.
 */

const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
];

function hasSessionCookie(request: NextRequest): boolean {
  const cookieHeader = request.headers.get("cookie") || "";

  return SESSION_COOKIE_NAMES.some((name) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = cookieHeader.match(
      new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`)
    );

    return Boolean(match?.[1]?.trim());
  });
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isPublicRoute =
    pathname === "/siteplan-public" ||
    pathname.startsWith("/siteplan-public/") ||
    pathname === "/api/public/siteplan" ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/maintenance";

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const isAuthenticated = hasSessionCookie(request);
  const isAuthPage = pathname.startsWith("/login");

  if (isAuthPage) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/maintenance",
    "/siteplan-public",
    "/siteplan-public/:path*",
    "/api/public/siteplan",
    "/chat/:path*",
    "/dashboard/:path*",
    "/siteplan/:path*",
    "/master/:path*",
    "/marketing/:path*",
    "/finance/:path*",
    "/production/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
