import { db } from "@/db";
import { projects, units, customers } from "@/db/schema/master";
import { eq } from "drizzle-orm";
import { cachedQuery } from "./cache";

/**
 * Cached reference data queries.
 * These wrap commonly-fetched reference data (projects, units, customers)
 * with `cachedQuery` for cross-request caching and request-level deduplication.
 * Invalidation happens via `revalidatePath` on the pages that use this data,
 * which triggers a fresh render and re-fetches data at TTL boundary.
 */

/** Fetch all projects (cached, tag: "projects") */
export function getCachedProjects() {
  return cachedQuery(
    () => db.select().from(projects),
    ["projects", "list"],
    { tags: ["projects"], revalidate: 300, fallback: [] }
  );
}

/** Fetch all available units (cached, tag: "units") */
export function getCachedAvailableUnits() {
  return cachedQuery(
    () =>
      db
        .select({
          id: units.id,
          code: units.code,
          projectId: units.projectId,
          price: units.price,
          status: units.status,
        })
        .from(units)
        .where(eq(units.status, "available")),
    ["units", "available"],
    { tags: ["units"], revalidate: 300, fallback: [] }
  );
}

/** Fetch all units (cached, tag: "units") */
export function getCachedAllUnits() {
  return cachedQuery(
    () => db.select().from(units),
    ["units", "all"],
    { tags: ["units"], revalidate: 300, fallback: [] }
  );
}

/** Fetch all customers (cached, tag: "customers") */
export function getCachedCustomers() {
  return cachedQuery(
    () =>
      db
        .select({ id: customers.id, name: customers.name, phone: customers.phone })
        .from(customers),
    ["customers", "list"],
    { tags: ["customers"], revalidate: 300, fallback: [] }
  );
}
