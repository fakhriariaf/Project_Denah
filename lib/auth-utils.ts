/**
 * Callback URL validation and safe redirect utilities.
 *
 * Pure utility module — no React, database, server action, or browser API imports.
 * Importable as `@/lib/auth-utils`.
 */

/**
 * Validates a callback URL for safe internal redirect.
 * Returns true only for relative internal paths that won't cause open redirect.
 *
 * Rules:
 * 1. Must start with `/`
 * 2. Must not start with `//` (protocol-relative URL)
 * 3. Must not contain a URL scheme (https:, http:, javascript:, data:, etc.)
 * 4. Must not point to `/login` (avoid login loop)
 * 5. Internal query strings and hash fragments are allowed
 */
export function isValidCallbackUrl(url: string | null | undefined): boolean {
  if (url == null || url === "") {
    return false;
  }

  // Must start with `/`
  if (!url.startsWith("/")) {
    return false;
  }

  // Must not start with `//` (protocol-relative URL)
  if (url.startsWith("//")) {
    return false;
  }

  // Must not contain protocol schemes in the path portion (before query/hash).
  // We only check the path part so that colons in query strings or fragments
  // (e.g., /reports?time=10:00 or /finance?note=a:b) are safely allowed.
  const pathPortion = url.split("?")[0].split("#")[0].toLowerCase();
  if (/[a-z][a-z0-9+\-.]*:/.test(pathPortion)) {
    return false;
  }

  // Must not point to `/login` (exact match or with query/hash)
  const pathPart = url.split("?")[0].split("#")[0];
  if (pathPart === "/login" || pathPart === "/login/") {
    return false;
  }

  return true;
}

/**
 * Returns the safe redirect destination after login.
 * Falls back to `/dashboard` for missing/invalid callbackUrl.
 * Preserves query strings and hash fragments on valid internal paths.
 */
export function getSafeRedirectUrl(
  callbackUrl: string | null | undefined
): string {
  if (isValidCallbackUrl(callbackUrl)) {
    return callbackUrl!;
  }
  return "/dashboard";
}
