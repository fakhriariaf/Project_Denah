"use server";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/system";
import { user as userTable } from "@/db/schema/auth";
import { desc, eq, and, gte, lte, lt } from "drizzle-orm";
import { getCurrentUser, requireAnyRole } from "@/server/permissions";
import { headers } from "next/headers";
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


export async function writeAuditLog({
  action,
  module,
  entityId,
  entityType,
  details,
  level = "log",
  status = "success",
  responseCode = 200,
  durationMs,
  endpoint,
}: {
  action: string;
  module: string;
  entityId?: string;
  entityType?: string;
  details?: Record<string, unknown>;
  level?: "log" | "info" | "error";
  status?: "success" | "failed";
  responseCode?: number;
  durationMs?: number;
  endpoint?: string;
}) {
  try {
    const user = await getCurrentUser();
    const hdrs = await headers();
    const rawIp = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "unknown";
    const ip = rawIp.includes(",") ? rawIp.split(",")[0].trim() : rawIp;

    // Auto-detect endpoint from referer or next-url header if not explicitly provided
    const resolvedEndpoint = endpoint
      ?? hdrs.get("x-invoke-path")
      ?? hdrs.get("next-url")
      ?? hdrs.get("referer")
      ?? null;

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId: user?.id ?? null,
      action,
      module,
      entityId: entityId ?? null,
      entityType: entityType ?? null,
      details: details ?? null,
      ipAddress: ip,
      endpoint: resolvedEndpoint,
      level,
      status,
      responseCode,
      durationMs: durationMs ?? null,
      createdAt: new Date(),
    });
  } catch (err) {
    // Audit log failure must never break the main action
    console.warn("[AuditLog] Failed to write audit log:", err);
  }
}

export async function safeWriteBlockedTransitionLog(payload: {
  module: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
}) {
  try {
    await writeAuditLog({
      action: "blocked_transition",
      module: payload.module,
      entityType: payload.entityType,
      entityId: payload.entityId,
      details: payload.details,
    });
  } catch (err) {
    console.error("Failed to write blocked transition audit log:", err);
  }
}

