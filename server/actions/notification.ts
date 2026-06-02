"use server";

import { db } from "@/db";
import { notifications } from "@/db/schema/system";
import { user as userTable } from "@/db/schema/auth";
import { roles as rolesTable } from "@/db/schema/access";
import { getCurrentUser, getUserRoleDetails } from "@/server/permissions";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type NotificationType = "approval_pending" | "kpr_sla" | "spk_overdue" | "progress_done" | "info" | "handover_waiting" | "handover_complete";

export async function createNotification({
  userId,
  type,
  title,
  message,
  entityId,
  entityType,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
}) {
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
 * Utility to notify multiple users who hold specific roles.
 * Very useful for broadcast actions (e.g. notify Direksi / Super Admin for approvals).
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

    // 2. Fetch all users having these role IDs
    const targetUsers = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(inArray(userTable.roleId, roleIds));

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

export async function getNotifications(isUnreadOnly = false, page = 1, pageSize = 50) {
  try {
    const activeUser = await getCurrentUser();
    if (!activeUser) return [];

    const details = await getUserRoleDetails(activeUser.id);
    if (details && details.status !== "active") return [];

    const conditions = [eq(notifications.userId, activeUser.id)];
    if (isUnreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const offset = (page - 1) * pageSize;

    const alerts = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset(offset);

    return alerts;
  } catch (err) {
    console.error("[Notification] Failed to retrieve notifications:", err);
    return [];
  }
}

export async function getUnreadCount() {
  try {
    const activeUser = await getCurrentUser();
    if (!activeUser) return 0;

    const details = await getUserRoleDetails(activeUser.id);
    if (details && details.status !== "active") return 0;

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, activeUser.id),
          eq(notifications.isRead, false)
        )
      );

    return result?.count ?? 0;
  } catch (err) {
    console.error("[Notification] Failed to count unread notifications:", err);
    return 0;
  }
}

export async function markAsRead(notificationId: string) {
  try {
    const activeUser = await getCurrentUser();
    if (!activeUser) return { success: false, error: "Unauthorized" };

    const details = await getUserRoleDetails(activeUser.id);
    if (details && details.status !== "active") return { success: false, error: "Unauthorized" };

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, activeUser.id)
        )
      );

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[Notification] Failed to mark as read:", err);
    return { success: false, error: "Gagal memperbarui status notifikasi" };
  }
}

export async function markAllAsRead() {
  try {
    const activeUser = await getCurrentUser();
    if (!activeUser) return { success: false, error: "Unauthorized" };

    const details = await getUserRoleDetails(activeUser.id);
    if (details && details.status !== "active") return { success: false, error: "Unauthorized" };

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, activeUser.id));

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[Notification] Failed to mark all as read:", err);
    return { success: false, error: "Gagal memperbarui semua notifikasi" };
  }
}
