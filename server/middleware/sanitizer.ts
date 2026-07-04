/**
 * Input Sanitizer Middleware
 *
 * Provides functions to sanitize user input by removing dangerous HTML elements,
 * event handlers, and javascript: URLs. Also validates input length against
 * predefined maximum limits.
 *
 * @module server/middleware/sanitizer
 */

// ─── Length Limits ─────────────────────────────────────────────────────────────

/**
 * Maximum allowed lengths for different field types.
 * Used by validateMaxLength and can be imported for reuse in Zod schemas.
 */
export const MAX_LENGTH = {
  /** Name fields (customer name, project name, unit name, etc.) */
  name: 255,
  /** Notes, descriptions, and long-form text fields */
  notes: 2000,
  /** Cancellation reasons */
  cancellationReason: 500,
} as const;

// ─── Sanitization ──────────────────────────────────────────────────────────────

/**
 * Sanitizes a string input by:
 * 1. Trimming leading/trailing whitespace
 * 2. Removing dangerous HTML tags: <script>, <iframe>, <object>, <embed>
 *    (including their content and self-closing variants)
 * 3. Removing on* event handler attributes from any remaining HTML
 * 4. Removing javascript: URL scheme references
 *
 * @param value - The raw input string to sanitize
 * @returns The sanitized string with dangerous content removed
 */
export function sanitizeInput(value: string): string {
  let sanitized = value.trim();

  // Remove <script>...</script> tags and their content (case-insensitive, dotAll)
  sanitized = sanitized.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  // Remove self-closing <script /> tags
  sanitized = sanitized.replace(/<script\b[^>]*\/?>/gi, "");

  // Remove <iframe>...</iframe> tags and their content
  sanitized = sanitized.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
  // Remove self-closing <iframe /> tags
  sanitized = sanitized.replace(/<iframe\b[^>]*\/?>/gi, "");

  // Remove <object>...</object> tags and their content
  sanitized = sanitized.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "");
  // Remove self-closing <object /> tags
  sanitized = sanitized.replace(/<object\b[^>]*\/?>/gi, "");

  // Remove <embed>...</embed> tags and their content
  sanitized = sanitized.replace(/<embed\b[^>]*>[\s\S]*?<\/embed>/gi, "");
  // Remove self-closing <embed /> tags
  sanitized = sanitized.replace(/<embed\b[^>]*\/?>/gi, "");

  // Remove on* event handler attributes (onclick, onerror, onload, etc.)
  // Matches: onXxx="..." or onXxx='...' or onXxx=value (no quotes)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Remove javascript: URL scheme (in href, src, action, etc.)
  sanitized = sanitized.replace(/javascript\s*:/gi, "");

  return sanitized;
}

// ─── Validation ────────────────────────────────────────────────────────────────

/**
 * Validates that a string does not exceed the specified maximum length.
 * Throws a descriptive error if the string exceeds the limit.
 *
 * @param value - The string to validate
 * @param maxLength - The maximum allowed length in characters
 * @param fieldName - The human-readable field name for the error message
 * @throws Error with descriptive message in Indonesian if length exceeds limit
 */
export function validateMaxLength(
  value: string,
  maxLength: number,
  fieldName: string
): void {
  if (value.length > maxLength) {
    throw new Error(
      `Field ${fieldName} melebihi batas maksimum ${maxLength} karakter`
    );
  }
}
