/**
 * Notification write service — INTERNAL ONLY.
 *
 * SECURITY BOUNDARY (P0):
 * This module deliberately has NO "use server" directive, so nothing here is
 * reachable as an RPC endpoint from the browser.
 *
 * Previously `createNotification` and `notifyUsersWithRoles` lived in
 * `server/actions/notification.ts` ("use server"). Both accept a plain
 * serialisable object and had no auth/role guard, which made them directly
 * callable from any client:
 *   - `createNotification` could inject a forged notification into ANY userId.
 *   - `notifyUsersWithRoles(["Super Admin", "Direksi / Manager"])` could
 *     broadcast an attacker-controlled title/message to all management users.
 * Because the payload renders inside the trusted in-app notification UI, this is
 * a credible internal-phishing vector.
 *
 * Rule: mutations must import notification writers from THIS module.
 * `server/actions/notification.ts` keeps only the user-facing, session-scoped
 * read/mark actions.
 */

import { db } from "@/db";
import { notifications } from "@/db/schema/system";
import { user as userTable } from "@/db/schema/auth";
import { roles as rolesTable } from "@/db/schema/access";
import { eq, and, inArray } from "drizzle-orm";

export type NotificationType =
  | "approval_pending"
  | "kpr_sla"
  | "spk_overdue"
  | "progress_done"
  | "info"
  | "handover_waiting"
  | "handover_complete";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
}

/**
 * Creates a single notification for one target user.
 * Internal use only — the caller is responsible for having already authorised
 * the surrounding business action.
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  entityId,
  entityType,
}: CreateNotificationInput) {
  try {
    const id = crypto.randomUUID();
    await db.insert(notifications).values({
      id,
      userId,
      type,
      title,
      message,
      entityId: entityId || null,
      entityType: entityType || null,
      isRead: false,
      createdAt: new Date(),
    });
    return { success: true, id };
  } catch (err) {
    console.error("[Notification] Failed to create notification:", err);
    return { success: false, error: "Gagal membuat notifikasi" };
  }
}

/**
 * Notifies every ACTIVE user holding any of the given roles.
 * Used for broadcast events (e.g. pending approvals for Direksi / Super Admin).
 * Internal use only — never expose this as a server action.
 */
export async function notifyUsersWithRoles({
  roleNames,
  type,
  title,
  message,
  entityId,
  entityType,
}: {
  roleNames: string[];
  type: NotificationType;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
}) {
  try {
    // 1. Get the matching role IDs
    const matchedRoles = await db
      .select({ id: rolesTable.id })
      .from(rolesTable)
      .where(inArray(rolesTable.name, roleNames));

    if (matchedRoles.length === 0) return { success: true, count: 0 };
    const roleIds = matchedRoles.map((r) => r.id);

    // 2. Fetch all active users having these role IDs
    const targetUsers = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(and(inArray(userTable.roleId, roleIds), eq(userTable.status, "active")));

    if (targetUsers.length === 0) return { success: true, count: 0 };

    const batchValues = targetUsers.map((targetUser) => ({
      id: crypto.randomUUID(),
      userId: targetUser.id,
      type,
      title,
      message,
      entityId: entityId || null,
      entityType: entityType || null,
      isRead: false,
      createdAt: new Date(),
    }));

    if (batchValues.length === 0) return { success: true, count: 0 };

    await db.insert(notifications).values(batchValues);
    return { success: true, count: targetUsers.length };
  } catch (err) {
    console.error("[Notification] Failed to notify users with roles:", err);
    return { success: false, count: 0 };
  }
}
