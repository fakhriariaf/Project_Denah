import { and, desc, eq } from "drizzle-orm";
import { History } from "lucide-react";
import type { ReactNode } from "react";
import { db } from "@/db";
import { financeActivityHistory } from "@/db/schema/finance";
import { auditLogs } from "@/db/schema/system";
import { user } from "@/db/schema/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActivityActionLabel } from "@/lib/label-helpers";
import { sortTimelineEntriesNewestFirst } from "@/lib/finance-timeline";
import { cn } from "@/lib/utils";

/**
 * FinanceTimeline
 *
 * Server component that renders the Finance_Activity_History timeline for a
 * single finance entity in reverse chronological order (newest first).
 *
 * Design / requirements:
 * - Requirement 2.5: shows all `finance_activity_history` records for the
 *   entity newest-first, each with actor name, timestamp, and reason/notes
 *   where available.
 * - Requirement 2.6: when there are zero history records, renders a fallback
 *   state without crashing — either a limited `created` event derived from the
 *   generic `audit_logs` (module = 'finance') or the message
 *   "Data dibuat sebelum timeline finance aktif".
 * - Requirement 2.7: absence of history records never blocks rendering; the
 *   fallback derivation is best-effort and swallows its own errors.
 * - Requirement 2.13: reverse chronological order is the standard for all
 *   entity-specific finance timelines.
 *
 * Sage Green design system, light theme only, Bahasa Indonesia labels via
 * `lib/label-helpers.ts`, `tabular-nums` for the timestamp.
 */

export type FinanceTimelineEntityType =
  | "invoice"
  | "payment"
  | "transaction"
  | "approval"
  | "budget";

export interface FinanceTimelineProps {
  entityType: FinanceTimelineEntityType;
  entityId: string;
  /** Optional card title override. */
  title?: string;
  /** Optional card description override. */
  description?: string;
  /** Optional empty-state content override for context-specific entities. */
  emptyState?: ReactNode;
  className?: string;
}

const EMPTY_MESSAGE = "Data dibuat sebelum timeline finance aktif";

interface TimelineEntry {
  id: string;
  action: string;
  reason: string | null;
  actorName: string | null;
  createdAt: Date;
  /** Marks an event reconstructed from the generic audit log fallback. */
  derived?: boolean;
}

/** Format a timestamp consistently with the app locale: "22 Mei 2026, 14:30". */
function formatTimestamp(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) return "\u2014";
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Best-effort derivation of a single limited `created` event from the generic
 * `audit_logs` table for legacy entities that predate the finance timeline.
 * Never throws: any failure returns an empty list so the detail page still
 * renders (Req 2.6, 2.7).
 */
async function deriveFallbackFromAuditLogs(
  entityType: FinanceTimelineEntityType,
  entityId: string,
): Promise<TimelineEntry[]> {
  try {
    const [earliest] = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorName: user.name,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(user, eq(auditLogs.userId, user.id))
      .where(
        and(
          eq(auditLogs.module, "finance"),
          eq(auditLogs.entityType, entityType),
          eq(auditLogs.entityId, entityId),
        ),
      )
      .orderBy(auditLogs.createdAt)
      .limit(1);

    if (!earliest) return [];

    return [
      {
        id: `audit-${earliest.id}`,
        action: "created",
        reason: null,
        actorName: earliest.actorName ?? null,
        createdAt: earliest.createdAt,
        derived: true,
      },
    ];
  } catch {
    // Swallow: fallback derivation must never block detail-page rendering.
    return [];
  }
}

export async function FinanceTimeline({
  entityType,
  entityId,
  title = "Timeline Aktivitas",
  description = "Riwayat aktivitas finance dari terbaru ke terlama",
  emptyState,
  className,
}: FinanceTimelineProps) {
  const rows = await db
    .select({
      id: financeActivityHistory.id,
      action: financeActivityHistory.action,
      reason: financeActivityHistory.reason,
      actorName: user.name,
      createdAt: financeActivityHistory.createdAt,
    })
    .from(financeActivityHistory)
    .leftJoin(user, eq(financeActivityHistory.actorId, user.id))
    .where(
      and(
        eq(financeActivityHistory.entityType, entityType),
        eq(financeActivityHistory.entityId, entityId),
      ),
    )
    .orderBy(desc(financeActivityHistory.createdAt));

  let entries: TimelineEntry[] = rows.map((row) => ({
    id: row.id,
    action: row.action,
    reason: row.reason,
    actorName: row.actorName ?? null,
    createdAt: row.createdAt,
  }));

  // Empty-state fallback (Req 2.6): try to derive a limited "created" event
  // from the generic finance audit log before showing the plain message.
  if (entries.length === 0) {
    entries = await deriveFallbackFromAuditLogs(entityType, entityId);
  }

  // Enforce the standard newest-first order (Req 2.5, 2.13, 7.10) through the
  // single pure ordering helper so the rule holds regardless of source (DB
  // rows and/or derived fallback entries).
  entries = sortTimelineEntriesNewestFirst(entries);

  const isEmpty = entries.length === 0;

  return (
    <Card className={cn("border-border", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <History className="h-5 w-5 text-primary/70" />
          {title}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          emptyState ?? (
            <div className="rounded-md border border-dashed border-border bg-[#F7F8F3] px-4 py-8 text-center">
              <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{EMPTY_MESSAGE}</p>
            </div>
          )
        ) : (
          <ol className="relative space-y-6 border-l border-border pl-6">
            {entries.map((entry) => (
              <li key={entry.id} className="relative">
                {/* Timeline node */}
                <span
                  className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary"
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-foreground">
                    {getActivityActionLabel(entry.action)}
                  </span>
                  {entry.derived && (
                    <span className="text-xs text-muted-foreground">
                      (dari audit log)
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{entry.actorName ?? "\u2014"}</span>
                  <span aria-hidden="true">&middot;</span>
                  <time className="tabular-nums" dateTime={entry.createdAt.toISOString?.()}>
                    {formatTimestamp(entry.createdAt)}
                  </time>
                </div>
                {entry.reason && entry.reason.trim() !== "" && (
                  <p className="mt-1.5 rounded-md bg-[#F7F8F3] px-3 py-2 text-sm text-foreground">
                    {entry.reason}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export default FinanceTimeline;
