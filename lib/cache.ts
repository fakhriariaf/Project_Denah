import { cache } from "react";
import { unstable_cache } from "next/cache";

/**
 * A caching utility that combines React `cache()` for request-level deduplication
 * with Next.js `unstable_cache` for cross-request TTL caching with tag-based revalidation.
 *
 * - React `cache()`: Ensures the same query is only executed once per server render pass
 *   (request-level deduplication).
 * - `unstable_cache`: Enables cross-request caching with configurable TTL and selective
 *   revalidation via `revalidateTag`.
 *
 * If the query function throws, the error is logged to the server console and the
 * specified fallback value is returned (never propagates exceptions to the caller).
 *
 * @param queryFn - Async function that fetches data (e.g., a database query)
 * @param keyParts - Cache key segments for `unstable_cache` (e.g., ["projects", "list"])
 * @param options - Optional caching configuration
 * @param options.tags - Tags for selective revalidation via `revalidateTag()`
 * @param options.revalidate - TTL in seconds for cross-request cache (default: no TTL / indefinite)
 * @param options.fallback - Value to return if queryFn throws (default: inferred as [] or null)
 *
 * @example
 * // Cache project list with 5-minute TTL, revalidatable by "projects" tag
 * const projects = await cachedQuery(
 *   () => db.select().from(projectsTable),
 *   ["projects", "list"],
 *   { tags: ["projects"], revalidate: 300, fallback: [] }
 * );
 */
export function cachedQuery<T>(
  queryFn: () => Promise<T>,
  keyParts: string[],
  options?: {
    tags?: string[];
    revalidate?: number;
    fallback?: T;
  }
): Promise<T> {
  // Wrap queryFn with unstable_cache for cross-request TTL caching
  const crossRequestCached = unstable_cache(
    async () => {
      return await queryFn();
    },
    keyParts,
    {
      tags: options?.tags,
      revalidate: options?.revalidate,
    }
  );

  // Wrap with React cache() for request-level deduplication
  const requestDeduped = cache(async (): Promise<T> => {
    try {
      return await crossRequestCached() as T;
    } catch (error) {
      console.error(
        `[cachedQuery] Error fetching data for key [${keyParts.join(", ")}]:`,
        error
      );

      // Return fallback value without propagating the exception
      if (options?.fallback !== undefined) {
        return options.fallback;
      }

      // BUG 9 FIX: Return empty array as safe default instead of `null as T`
      // Returning null causes .map() crash in callers that expect T[]
      return [] as unknown as T;
    }
  });

  return requestDeduped();
}
