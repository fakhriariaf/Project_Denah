import { db } from "@/db";
import { session as sessionTable, user as userTable } from "@/db/schema/auth";
import { roles } from "@/db/schema/access";
import { eq, and, gt } from "drizzle-orm";

/**
 * Checks whether the given session token belongs to a Super Admin user
 * with a valid (non-expired) session.
 *
 * Used by middleware to determine if the current request should bypass
 * maintenance mode restrictions.
 *
 * @param sessionToken - The raw session token string (from cookie)
 * @returns true if the session is valid, not expired, and belongs to a Super Admin
 */
export async function checkSessionIsSuperAdmin(
  sessionToken: string
): Promise<boolean> {
  try {
    if (!sessionToken) return false;

    const result = await db
      .select({ roleName: roles.name })
      .from(sessionTable)
      .innerJoin(userTable, eq(sessionTable.userId, userTable.id))
      .leftJoin(roles, eq(userTable.roleId, roles.id))
      .where(
        and(
          eq(sessionTable.token, sessionToken),
          gt(sessionTable.expiresAt, new Date())
        )
      )
      .limit(1);

    return result[0]?.roleName === "Super Admin";
  } catch {
    // On any error (DB failure, connection issue, etc.), default to non-Super Admin
    return false;
  }
}
