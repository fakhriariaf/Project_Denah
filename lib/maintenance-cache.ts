import { db } from "@/db";
import { appSettings } from "@/db/schema/system";
import { eq } from "drizzle-orm";

/**
 * In-memory cache for maintenance mode status.
 * Avoids a DB query on every middleware request by caching the
 * `system_maintenance` value with a 30-second TTL.
 */

interface MaintenanceCacheEntry {
  value: boolean;
  cachedAt: number; // Unix timestamp in milliseconds
}

const CACHE_TTL_MS = 30_000; // 30 seconds

let maintenanceCache: MaintenanceCacheEntry | null = null;

/**
 * Returns whether maintenance mode is currently active.
 * Reads from the in-memory cache if the entry is still fresh (< 30s old),
 * otherwise queries the database for the `system_maintenance` app setting.
 *
 * On any DB error, defaults to `false` (maintenance OFF) to avoid
 * accidentally locking all users out.
 */
export async function isMaintenanceMode(): Promise<boolean> {
  const now = Date.now();

  // Return cached value if still within TTL
  if (maintenanceCache && now - maintenanceCache.cachedAt < CACHE_TTL_MS) {
    return maintenanceCache.value;
  }

  try {
    const result = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, "system_maintenance"))
      .limit(1);

    const isActive = result[0]?.value === "true";

    // Update cache
    maintenanceCache = { value: isActive, cachedAt: now };

    return isActive;
  } catch (error) {
    console.error("[maintenance-cache] Error querying maintenance status:", error);
    // Default to maintenance OFF on error to avoid blocking all access
    return false;
  }
}

/**
 * Forces the maintenance cache to be invalidated.
 * Call this after updating the `system_maintenance` setting so the change
 * takes effect immediately (within the same process) instead of waiting
 * for the TTL to expire.
 */
export function invalidateMaintenanceCache(): void {
  maintenanceCache = null;
}
