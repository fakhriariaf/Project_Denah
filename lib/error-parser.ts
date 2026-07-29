import { dictionaries } from "@/lib/dictionaries";

const dict = dictionaries.id;

/**
 * Extracts the field name from a database constraint error message.
 * Handles patterns like:
 * - SQLite: "UNIQUE constraint failed: users.email" → "email"
 * - SQLite: "NOT NULL constraint failed: bookings.customer_id" → "customer_id"
 * - PostgreSQL detail: 'Key (email)=(...) already exists' → "email"
 * Returns a generic placeholder if field cannot be extracted.
 */
function extractFieldName(msg: string): string {
  // SQLite pattern: "CONSTRAINT failed: tablename.columnname"
  const sqliteMatch = msg.match(/constraint failed:\s*\w+\.(\w+)/i);
  if (sqliteMatch?.[1]) {
    return sqliteMatch[1];
  }

  // PostgreSQL pattern: Key (fieldname)=
  const pgMatch = msg.match(/Key\s*\((\w+)\)/i);
  if (pgMatch?.[1]) {
    return pgMatch[1];
  }

  // PostgreSQL column reference: column "fieldname"
  const pgColMatch = msg.match(/column\s+"(\w+)"/i);
  if (pgColMatch?.[1]) {
    return pgColMatch[1];
  }

  return "data";
}

/**
 * Parses database constraint errors and returns user-friendly Indonesian messages.
 * Used by safeAction wrapper to translate DB errors for the client.
 *
 * Handles:
 * - UNIQUE constraint violations (SQLite + PostgreSQL)
 * - FOREIGN KEY constraint violations (SQLite + PostgreSQL)
 * - NOT NULL constraint violations (SQLite + PostgreSQL)
 *
 * Returns null for unrecognized errors.
 */
export function parseDbError(error: Error): string | null {
  const msg = error.message;

  // UNIQUE constraint violation
  if (msg.includes("UNIQUE constraint failed:") || msg.includes("unique_violation")) {
    const field = extractFieldName(msg);
    return `Data dengan ${field} tersebut sudah ada`;
  }

  // FOREIGN KEY constraint violation
  if (msg.includes("FOREIGN KEY constraint failed") || msg.includes("foreign_key_violation")) {
    return "Data terkait tidak ditemukan atau sedang digunakan";
  }

  // NOT NULL constraint violation
  if (msg.includes("NOT NULL constraint failed") || msg.includes("not_null_violation")) {
    const field = extractFieldName(msg);
    return `Field ${field} wajib diisi`;
  }

  return null;
}

export function parseServerError(err: unknown, fallback = dict["err.processing"]): string {
  if (!(err instanceof Error)) return fallback || dict["err.unknown"];

  const msg = err.message;

  if (
    msg.includes("Failed query:") ||
    msg.includes("\nparams:") ||
    msg.includes("DrizzleQueryError")
  ) {
    return fallback || "Terjadi kendala saat memproses data. Silakan coba lagi.";
  }

  // Try parseDbError first for consistent handling
  const dbError = parseDbError(err);
  if (dbError) return dbError;

  // Handle Zod JSON Arrays
  try {
    const parsed = JSON.parse(msg);
    if (Array.isArray(parsed)) {
      return parsed.map((e: { message?: string }) => e.message || dict["err.invalid_field"]).join(", ");
    }
    if (parsed.message) return parsed.message;
  } catch {
    // Not JSON, just continue
  }

  // Common NEXT errors
  if (msg.includes("NEXT_REDIRECT")) return dict["err.redirect"];

  return msg || fallback || dict["err.processing"];
}
