import { dictionaries } from "@/lib/dictionaries";

const dict = dictionaries.id;

export function parseServerError(err: unknown): string {
  if (!(err instanceof Error)) return dict["err.unknown"];

  const msg = err.message;

  // Handle SQLite Unique Constraints
  if (msg.includes("UNIQUE constraint failed:")) {
    const field = msg.split(": ")[1]?.split(".").pop() || "Data";
    const capitalized = field.charAt(0).toUpperCase() + field.slice(1);
    return dict["err.unique"].replace("{field}", capitalized);
  }

  if (msg.includes("FOREIGN KEY constraint failed")) {
    return dict["err.foreign_key"];
  }

  // Handle Zod JSON Arrays
  try {
    const parsed = JSON.parse(msg);
    if (Array.isArray(parsed)) {
      return parsed.map((e: any) => e.message || dict["err.invalid_field"]).join(", ");
    }
    if (parsed.message) return parsed.message;
  } catch {
    // Not JSON, just continue
  }

  // Common NEXT errors
  if (msg.includes("NEXT_REDIRECT")) return dict["err.redirect"];

  return msg || dict["err.processing"];
}
