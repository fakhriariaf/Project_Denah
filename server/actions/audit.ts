"use server";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/system";
import { user as userTable } from "@/db/schema/auth";
import { desc, eq, and, sql } from "drizzle-orm";
import { getCurrentUser } from "@/server/permissions";
import { headers } from "next/headers";

export async function getAuditLogs(filters?: {
  userId?: string;
  module?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
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
    if (filters?.startDate) {
      const parsedStart = Date.parse(filters.startDate);
      if (!isNaN(parsedStart)) {
        conditions.push(sql`${auditLogs.createdAt} >= ${parsedStart}`);
      }
    }
    if (filters?.endDate) {
      const parsedEnd = Date.parse(filters.endDate);
      if (!isNaN(parsedEnd)) {
        // Include full day (86400000ms - 1ms)
        const endWithTime = parsedEnd + 86400000 - 1;
        conditions.push(sql`${auditLogs.createdAt} <= ${endWithTime}`);
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
        createdAt: auditLogs.createdAt,
        userName: userTable.name,
        userEmail: userTable.email,
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
}: {
  action: string;
  module: string;
  entityId?: string;
  entityType?: string;
  details?: Record<string, unknown>;
}) {
  try {
    const user = await getCurrentUser();
    const hdrs = await headers();
    const rawIp = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "unknown";
    const ip = rawIp.includes(",") ? rawIp.split(",")[0].trim() : rawIp;

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId: user?.id ?? null,
      action,
      module,
      entityId: entityId ?? null,
      entityType: entityType ?? null,
      details: details ?? null,
      ipAddress: ip,
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

