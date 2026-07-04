import { toast } from "sonner";

/**
 * Standard return type for all Server Actions.
 * Success case contains typed data, failure case contains error message
 * and optional per-field validation errors.
 */
export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Handles a Server Action result by displaying appropriate toast notifications.
 * Acts as a type guard — returns true if the result is successful.
 *
 * - Success: calls toast.success with custom or default message ("Operasi berhasil")
 * - Failure: calls toast.error with the error message (duration: 6000ms)
 *
 * @example
 * const result = await createBooking(data);
 * if (handleActionResult(result, { successMessage: "Booking berhasil dibuat" })) {
 *   // result is narrowed to { success: true; data: T }
 *   router.push(`/bookings/${result.data.id}`);
 * }
 */
export function handleActionResult<T>(
  result: ActionResult<T>,
  options?: { successMessage?: string }
): result is { success: true; data: T } {
  if (result.success) {
    toast.success(options?.successMessage || "Operasi berhasil");
    return true;
  } else {
    toast.error(result.error, { duration: 6000 });
    return false;
  }
}
