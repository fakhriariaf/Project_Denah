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
export function safeAction<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<ActionResult<TOutput>> {
  return async (input: TInput) => {
    try {
      const data = await fn(input);
      return { success: true, data };
    } catch (error) {
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
