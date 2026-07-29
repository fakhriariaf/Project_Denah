"use server";

import { db } from "@/db";
import { notifications } from "@/db/schema/system";
import { getCurrentUser, getUserRoleDetails } from "@/server/permissions";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type { NotificationType } from "@/server/services/notification.service";

/**
 * SECURITY BOUNDARY (P0): notification WRITERS intentionally no longer live here.
 *
 * This file carries "use server", so every exported function is a browser-callable
 * RPC endpoint. `createNotification` / `notifyUsersWithRoles` accept plain
 * serialisable objects and had no guard, which let any client inject a forged
 * notification into any userId — or broadcast an attacker-controlled message to
 * every Super Admin / Direksi. Because it renders in the trusted in-app
 * notification UI, that is a credible internal-phishing vector.
 *
 * They now live in `server/services/notification.service.ts` (no "use server").
 *
 * Everything below is user-facing and strictly scoped to the CURRENT session
 * user — never to a caller-supplied userId.
 */

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


/**
 * Lightweight endpoint for polling: returns the most recent notification
 * created after a given ISO timestamp, or null if none exist.
 * This avoids fetching ALL notifications just to check for new ones.
 */
export async function getLatestNotificationAfter(timestamp: string): Promise<NotificationItem | null> {
  try {
    const activeUser = await getCurrentUser();
    if (!activeUser) return null;

    const details = await getUserRoleDetails(activeUser.id);
    if (details && details.status !== "active") return null;

    const since = new Date(timestamp);

    const [result] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, activeUser.id),
          gte(notifications.createdAt, since)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(1);

    if (!result) return null;

    return result as NotificationItem;
  } catch (err) {
    console.error("[Notification] Failed to get latest notification after timestamp:", err);
    return null;
  }
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  entityId: string | null;
  entityType: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface PaginatedNotificationResult {
  data: NotificationItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getNotificationsPaginated(params: {
  type?: string;
  startDate?: string;
  endDate?: string;
  isUnreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedNotificationResult> {
  const { type, startDate, endDate, isUnreadOnly = false, page = 1, pageSize = 20 } = params;

  try {
    const activeUser = await getCurrentUser();
    if (!activeUser) return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };

    const details = await getUserRoleDetails(activeUser.id);
    if (details && details.status !== "active") return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };

    const conditions = [eq(notifications.userId, activeUser.id)];

    if (isUnreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    if (type && type !== "all") {
      conditions.push(eq(notifications.type, type));
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(notifications.createdAt, start));
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(notifications.createdAt, end));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(whereClause);

    const totalCount = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(totalCount / pageSize);
    const offset = (page - 1) * pageSize;

    // Get paginated data
    const data = await db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      data: data as NotificationItem[],
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  } catch (err) {
    console.error("[Notification] Failed to retrieve paginated notifications:", err);
    return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };
  }
}
