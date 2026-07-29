import { ZodError } from "zod";
import { parseDbError } from "@/lib/error-parser";
import type { ActionResult } from "@/lib/action-utils";

/**
 * Wraps a server action function with consistent error handling.
 *
 * Handles:
 * (a) Successful execution → { success: true, data }
 * (b) ZodError → { success: false, error, fieldErrors }
 * (c) Database constraint error → { success: false, error: indonesian message }
 * (d) Unexpected exception → logged + generic error message
 *
 * All return values conform to ActionResult<TOutput>.
 */
/**
 * Next.js signals `redirect()` / `notFound()` by throwing a control-flow error
 * carrying a `digest`. Swallowing it turns an authorization redirect (from
 * requireAuth/requireAnyRole) into a generic "system error" toast and prevents
 * the framework from ever navigating. These must always be re-thrown.
 */
function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND";
}

export function safeAction<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<ActionResult<TOutput>> {
  return async (input: TInput) => {
    try {
      const data = await fn(input);
      return { success: true, data };
    } catch (error) {
      if (isNextControlFlowError(error)) {
        throw error;
      }

      if (error instanceof ZodError) {
        const fieldErrors: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const path = issue.path.join(".");
          if (!fieldErrors[path]) fieldErrors[path] = [];
          fieldErrors[path].push(issue.message);
        }
        return {
          success: false,
          error: "Validasi input gagal",
          fieldErrors,
        };
      }

      if (error instanceof Error) {
        const dbError = parseDbError(error);
        if (dbError) {
          return { success: false, error: dbError };
        }
      }

      console.error("[safeAction] Unexpected error:", error);
      return {
        success: false,
        error: "Terjadi kesalahan sistem. Silakan coba lagi.",
      };
    }
  };
}
