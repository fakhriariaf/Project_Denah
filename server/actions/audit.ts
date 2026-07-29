"use server";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/system";
import { user as userTable } from "@/db/schema/auth";
import { desc, eq, and, gte, lte, lt } from "drizzle-orm";
import { requireAnyRole } from "@/server/permissions";
import type { CursorPaginationParams, CursorPaginatedResult } from "@/lib/pagination";

export async function getAuditLogs(filters?: {
  userId?: string;
  module?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  level?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  // RBAC: only admin-level roles can view audit logs
  await requireAnyRole(["Super Admin", "Admin Kantor", "Direksi / Manager"]);

  try {
    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.module) {
      conditions.push(eq(auditLogs.module, filters.module));
    }
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.level) {
      conditions.push(eq(auditLogs.level, filters.level));
    }
    if (filters?.status) {
      conditions.push(eq(auditLogs.status, filters.status));
    }
    if (filters?.startDate) {
      const parsedStart = new Date(filters.startDate);
      if (!isNaN(parsedStart.getTime())) {
        conditions.push(gte(auditLogs.createdAt, parsedStart));
      }
    }
    if (filters?.endDate) {
      const parsedEnd = new Date(filters.endDate);
      if (!isNaN(parsedEnd.getTime())) {
        // Include full day
        parsedEnd.setHours(23, 59, 59, 999);
        conditions.push(lte(auditLogs.createdAt, parsedEnd));
      }
    }

    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 100;
    const offset = (page - 1) * pageSize;

    const query = db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        module: auditLogs.module,
        entityId: auditLogs.entityId,
        entityType: auditLogs.entityType,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        endpoint: auditLogs.endpoint,
        createdAt: auditLogs.createdAt,
        userName: userTable.name,
        userEmail: userTable.email,
        level: auditLogs.level,
        status: auditLogs.status,
        responseCode: auditLogs.responseCode,
        durationMs: auditLogs.durationMs,
      })
      .from(auditLogs)
      .leftJoin(userTable, eq(auditLogs.userId, userTable.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }

    return await query;
  } catch (err) {
    console.error("Gagal mengambil log audit:", err);
    return [];
  }
}

/**
 * Type for audit log items returned by paginated queries.
 */
export type AuditLogItem = {
  id: string;
  userId: string | null;
  action: string;
  module: string;
  entityId: string | null;
  entityType: string | null;
  details: unknown;
  ipAddress: string | null;
  endpoint: string | null;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
  level: string;
  status: string;
  responseCode: number | null;
  durationMs: number | null;
};

/**
 * Cursor-based paginated query for audit logs.
 * Uses `createdAt` as the cursor (ISO timestamp string, descending order).
 * Page size defaults to 100.
 * If cursor is provided but no records match (non-existent cursor), returns first page.
 */
export async function getAuditLogsPaginated(
  params: CursorPaginationParams,
  filters?: {
    userId?: string;
    module?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    level?: string;
    status?: string;
  }
): Promise<CursorPaginatedResult<AuditLogItem>> {
  // RBAC: only admin-level roles can view audit logs
  await requireAnyRole(["Super Admin", "Admin Kantor", "Direksi / Manager"]);

  const pageSize = params.pageSize > 0 ? params.pageSize : 100;

  try {
    const conditions = [];
    // BUG 6 FIX: Store cursor condition explicitly — don't rely on array index for removal
    let cursorCondition: ReturnType<typeof lt> | null = null;

    // Apply cursor filter: records with createdAt strictly less than cursor (descending order)
    if (params.cursor) {
      const cursorDate = new Date(params.cursor);
      if (!isNaN(cursorDate.getTime())) {
        cursorCondition = lt(auditLogs.createdAt, cursorDate);
        conditions.push(cursorCondition);
      }
    }

    // Apply optional filters
    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.module) {
      conditions.push(eq(auditLogs.module, filters.module));
    }
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.level) {
      conditions.push(eq(auditLogs.level, filters.level));
    }
    if (filters?.status) {
      conditions.push(eq(auditLogs.status, filters.status));
    }
    if (filters?.startDate) {
      const parsedStart = new Date(filters.startDate);
      if (!isNaN(parsedStart.getTime())) {
        conditions.push(gte(auditLogs.createdAt, parsedStart));
      }
    }
    if (filters?.endDate) {
      const parsedEnd = new Date(filters.endDate);
      if (!isNaN(parsedEnd.getTime())) {
        parsedEnd.setHours(23, 59, 59, 999);
        conditions.push(lte(auditLogs.createdAt, parsedEnd));
      }
    }

    // Fetch pageSize + 1 to determine if there are more pages
    const query = db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        module: auditLogs.module,
        entityId: auditLogs.entityId,
        entityType: auditLogs.entityType,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        endpoint: auditLogs.endpoint,
        createdAt: auditLogs.createdAt,
        userName: userTable.name,
        userEmail: userTable.email,
        level: auditLogs.level,
        status: auditLogs.status,
        responseCode: auditLogs.responseCode,
        durationMs: auditLogs.durationMs,
      })
      .from(auditLogs)
      .leftJoin(userTable, eq(auditLogs.userId, userTable.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize + 1);

    let results: AuditLogItem[];
    if (conditions.length > 0) {
      results = await query.where(and(...conditions));
    } else {
      results = await query;
    }

    // If cursor was provided but no records returned, fall back to first page (no cursor filter)
    // BUG 6 FIX: Remove cursor condition by explicit reference, not by array index
    if (params.cursor && results.length === 0) {
      const fallbackConditions = cursorCondition
        ? conditions.filter((c) => c !== cursorCondition)
        : conditions;

      const fallbackQuery = db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          action: auditLogs.action,
          module: auditLogs.module,
          entityId: auditLogs.entityId,
          entityType: auditLogs.entityType,
          details: auditLogs.details,
          ipAddress: auditLogs.ipAddress,
          endpoint: auditLogs.endpoint,
          createdAt: auditLogs.createdAt,
          userName: userTable.name,
          userEmail: userTable.email,
          level: auditLogs.level,
          status: auditLogs.status,
          responseCode: auditLogs.responseCode,
          durationMs: auditLogs.durationMs,
        })
        .from(auditLogs)
        .leftJoin(userTable, eq(auditLogs.userId, userTable.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(pageSize + 1);

      if (fallbackConditions.length > 0) {
        results = await fallbackQuery.where(and(...fallbackConditions));
      } else {
        results = await fallbackQuery;
      }
    }

    // Determine if there are more pages
    const hasMore = results.length > pageSize;

    // Trim to pageSize
    const data = hasMore ? results.slice(0, pageSize) : results;

    // nextCursor = createdAt of the last included record (ISO string), or null if no more pages
    const nextCursor = hasMore && data.length > 0
      ? data[data.length - 1].createdAt.toISOString()
      : null;

    return {
      data,
      nextCursor,
      hasMore,
    };
  } catch (err) {
    console.error("Gagal mengambil log audit (paginated):", err);
    return {
      data: [],
      nextCursor: null,
      hasMore: false,
    };
  }
}

export async function getAuditUsers() {
  // RBAC: this returns name + email for EVERY user (PII) and only feeds the audit
  // page filter, so it must match the audit page's own role gate.
  await requireAnyRole(["Super Admin", "Admin Kantor", "Direksi / Manager"]);

  try {
    return await db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
      })
      .from(userTable)
      .orderBy(userTable.name);
  } catch (err) {
    console.error("Gagal mengambil daftar pengguna untuk filter:", err);
    return [];
  }
}


/**
 * SECURITY BOUNDARY (P0): audit WRITERS intentionally no longer live here.
 *
 * This file carries "use server", so every exported function is a browser-callable
 * RPC endpoint. `writeAuditLog` / `safeWriteBlockedTransitionLog` accept plain
 * serialisable objects and had no guard, which let any client forge audit rows.
 *
 * They now live in `server/services/audit.service.ts` (no "use server").
 * Import audit writers from there. This module is READ-ONLY.
 */

