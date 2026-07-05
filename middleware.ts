import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware Authentication Strategy
 * ------------------------------------
 * We avoid making an HTTP call to /api/auth/get-session on every request
 * (which added 50-200ms latency per page load).
 *
 * Instead, we inspect the Better Auth session cookie directly.
 * Better Auth sets a cookie named "better-auth.session_token" (or "__Secure-" prefix in prod).
 * If that cookie is present and non-empty, we treat the user as potentially authenticated
 * and allow the request to proceed. The actual cryptographic session validation happens
 * inside each Server Action via auth.api.getSession() which runs server-side with full DB access.
 *
 * This is a common "lightweight middleware + deep server action auth" pattern used in Next.js
 * to prevent expensive auth round-trips at the edge/middleware layer.
 */

// Better Auth session cookie names (checked in priority order)
const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token", // HTTPS/production
  "better-auth.session_token",           // HTTP/development
];

function hasSessionCookie(request: NextRequest): boolean {
  const cookieHeader = request.headers.get("cookie") || "";
  return SESSION_COOKIE_NAMES.some((name) => {
    // Check cookie exists and has a non-empty value
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]+)`));
    return match && match[1] && match[1].trim().length > 0;
  });
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Whitelist public routes
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

  // Redirect authenticated users away from login page
  if (isAuthPage) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Maintenance mode check is handled in server components/actions, not middleware.
  // This avoids DB calls that cause MIDDLEWARE_INVOCATION_TIMEOUT on Vercel.

  // Redirect root to dashboard
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
