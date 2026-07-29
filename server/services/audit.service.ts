/**
 * Audit write service — INTERNAL ONLY.
 *
 * SECURITY BOUNDARY (P0):
 * This module deliberately has NO "use server" directive. Functions here are
 * plain server-side helpers and are therefore NOT reachable as RPC endpoints
 * from the browser.
 *
 * Previously `writeAuditLog` and `safeWriteBlockedTransitionLog` lived in
 * `server/actions/audit.ts` ("use server"), which made every exported function
 * a callable HTTP endpoint. Because both accept a plain serialisable object and
 * had no auth/role guard, any client could forge arbitrary audit-log rows
 * (arbitrary `action`, `module`, `entityType`, `details`), polluting the very
 * trail used for incident investigation.
 *
 * Rule: mutations must import audit writers from THIS module, never from
 * `server/actions/audit.ts` (which is now read-only).
 */

import { db } from "@/db";
import { auditLogs } from "@/db/schema/system";
import { getCurrentUser } from "@/server/permissions";
import { headers } from "next/headers";

export type AuditLevel = "log" | "info" | "error";
export type AuditStatus = "success" | "failed";

export interface WriteAuditLogInput {
  action: string;
  module: string;
  entityId?: string;
  entityType?: string;
  details?: Record<string, unknown>;
  level?: AuditLevel;
  status?: AuditStatus;
  responseCode?: number;
  durationMs?: number;
  endpoint?: string;
}

/**
 * Writes one audit-log row for the CURRENT session user.
 *
 * `userId` is always resolved server-side from the session and can never be
 * supplied by the caller — this is what prevents attribution spoofing.
 *
 * Failure policy: audit logging must never break the main action, so all errors
 * are logged and swallowed.
 */
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
}: WriteAuditLogInput) {
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

/**
 * Records a blocked state transition attempt. Best-effort; never throws.
 */
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
