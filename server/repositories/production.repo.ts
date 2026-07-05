/**
 * production.repo.ts
 *
 * Read-only query helpers for the Production (SPK/SPMB) domain.
 * These wrappers consolidate the common SPK lookups used across
 * production server actions so the logic lives in one place.
 *
 * Usage: import from "@/server/repositories" or directly from this file.
 */

import { db } from "@/db";
import {
  spks,
  workItems,
  spkWorkItemWeights,
  spkProgressLogs,
} from "@/db/schema/production";
import { units, projects, vendors } from "@/db/schema/master";
import { attachments } from "@/db/schema/system";
import { eq, desc, or, and, inArray } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal SPK row — only the columns you need for a quick existence check. */
export type SpkBasic = typeof spks.$inferSelect;

/** SPK with its joined project, unit, and vendor rows plus work-item weights and progress logs. */
export type SpkWithDetails = {
  spk: typeof spks.$inferSelect;
  project: typeof projects.$inferSelect;
  unit: typeof units.$inferSelect;
  vendor: typeof vendors.$inferSelect;
  weights: Array<{
    weight: typeof spkWorkItemWeights.$inferSelect;
    workItem: typeof workItems.$inferSelect;
  }>;
  logs: Array<{
    log: typeof spkProgressLogs.$inferSelect;
    workItem: typeof workItems.$inferSelect;
    attachments: Array<typeof attachments.$inferSelect>;
    /** First attachment — kept for backwards compatibility with existing consumers. */
    attachment: typeof attachments.$inferSelect | null;
  }>;
};

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Fetch a single SPK by its ID (minimal row, no JOINs).
 * Returns `null` when the SPK does not exist.
 */
export async function getSpkById(spkId: string): Promise<SpkBasic | null> {
  const [row] = await db
    .select()
    .from(spks)
    .where(eq(spks.id, spkId))
    .limit(1);

  return row ?? null;
}

/**
 * Fetch an SPK with its full JOIN tree: project, unit, vendor, work-item weights,
 * and progress logs (with photo attachments).
 *
 * This is a typed wrapper around the existing `getSpkDetails` server action that
 * can be called outside the "use server" boundary (e.g. from other repo/service files).
 *
 * Returns `null` when the SPK does not exist.
 */
export async function getSpkWithDetails(spkId: string): Promise<SpkWithDetails | null> {
  const results = await db
    .select({
      spk: spks,
      project: projects,
      unit: units,
      vendor: vendors,
    })
    .from(spks)
    .innerJoin(projects, eq(spks.projectId, projects.id))
    .innerJoin(units, eq(spks.unitId, units.id))
    .innerJoin(vendors, eq(spks.vendorId, vendors.id))
    .where(eq(spks.id, spkId))
    .limit(1);

  if (results.length === 0) return null;

  // Work-item weights
  const weights = await db
    .select({
      weight: spkWorkItemWeights,
      workItem: workItems,
    })
    .from(spkWorkItemWeights)
    .innerJoin(workItems, eq(spkWorkItemWeights.workItemId, workItems.id))
    .where(eq(spkWorkItemWeights.spkId, spkId));

  // Progress logs
  const logsRaw = await db
    .select({
      log: spkProgressLogs,
      workItem: workItems,
    })
    .from(spkProgressLogs)
    .innerJoin(workItems, eq(spkProgressLogs.workItemId, workItems.id))
    .where(eq(spkProgressLogs.spkId, spkId))
    .orderBy(desc(spkProgressLogs.progressDate));

  // Photo attachments — keyed by log ID or SPK ID
  const logIds = logsRaw.map((l) => l.log.id);
  let allAttachments: Array<typeof attachments.$inferSelect> = [];

  if (logIds.length > 0) {
    allAttachments = await db
      .select()
      .from(attachments)
      .where(
        or(
          and(eq(attachments.entityId, spkId), eq(attachments.entityType, "spk_progress")),
          and(inArray(attachments.entityId, logIds), eq(attachments.entityType, "progress_log"))
        )
      );
  } else {
    allAttachments = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.entityId, spkId), eq(attachments.entityType, "spk_progress")));
  }

  const logs = logsRaw.map((row) => {
    const rowAttachments = allAttachments.filter(
      (att) =>
        att.id === row.log.photoAttachmentId ||
        (att.entityId === row.log.id && att.entityType === "progress_log")
    );
    return {
      log: row.log,
      workItem: row.workItem,
      attachments: rowAttachments,
      attachment: rowAttachments[0] ?? null,
    };
  });

  return { ...results[0], weights, logs };
}
