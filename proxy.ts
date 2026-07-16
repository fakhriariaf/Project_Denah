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

/**
 * Builds a login redirect URL with callbackUrl preserving the original
 * pathname and query string.
 */
function buildLoginRedirectUrl(request: NextRequest): URL {
  const { pathname, search } = request.nextUrl;
  const originalPath = pathname + search;
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", originalPath);
  return loginUrl;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // --- Public routes: pass through without auth check ---
  const isPublicRoute =
    pathname === "/siteplan-public" ||
    pathname.startsWith("/siteplan-public/") ||
    pathname === "/api/public/siteplan" ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/maintenance" ||
    pathname === "/unauthorized" ||
    pathname.startsWith("/api/auth/");

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const isAuthenticated = hasSessionCookie(request);
  const isAuthPage = pathname.startsWith("/login");

  if (isAuthPage) {
    if (isAuthenticated) {
      // Allow login page access when reason=session-expired (stale cookie scenario)
      const reason = request.nextUrl.searchParams.get("reason");
      if (reason === "session-expired") {
        return NextResponse.next();
      }

      // Cookie exists but no session-expired reason: redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // No cookie on login page: allow access
    return NextResponse.next();
  }

  // --- Protected routes: require session cookie ---
  if (!isAuthenticated) {
    return NextResponse.redirect(buildLoginRedirectUrl(request));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Inject deterministic current-path request header for server-side `requireAuth()`
  // to build accurate callbackUrl without relying on referer.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-path", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/maintenance",
    "/unauthorized",
    "/siteplan-public",
    "/siteplan-public/:path*",
    "/api/public/siteplan",
    "/api/auth/:path*",
    "/chat",
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
