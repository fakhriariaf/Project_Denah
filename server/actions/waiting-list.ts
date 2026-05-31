"use server";

import { db } from "@/db";
import { waitingLists, marketingTargets } from "@/db/schema/marketing";
import { projects, customers } from "@/db/schema/master";
import { requireAnyRole } from "../permissions";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "./audit";
import { z } from "zod";

// ─── WAITING LIST ───────────────────────────────────────────────────────────

const waitingListSchema = z.object({
  customerId: z.string().min(1, "Konsumen wajib dipilih"),
  projectId: z.string().min(1, "Proyek wajib dipilih"),
  preferredType: z.string().optional(),
  budgetMin: z.coerce.number().min(0).optional(),
  budgetMax: z.coerce.number().min(0).optional(),
  priority: z.coerce.number().int().min(1).max(999).default(1),
  status: z.enum(["waiting", "offered", "converted", "cancelled"]).default("waiting"),
});

export async function getWaitingList(projectId?: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager", "Admin Keuangan", "Direksi / Manager"]);
  
  const query = db
    .select({
      id: waitingLists.id,
      priority: waitingLists.priority,
      preferredType: waitingLists.preferredType,
      budgetMin: waitingLists.budgetMin,
      budgetMax: waitingLists.budgetMax,
      status: waitingLists.status,
      createdAt: waitingLists.createdAt,
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      projectId: projects.id,
      projectName: projects.name,
    })
    .from(waitingLists)
    .innerJoin(customers, eq(waitingLists.customerId, customers.id))
    .innerJoin(projects, eq(waitingLists.projectId, projects.id))
    .orderBy(waitingLists.priority, desc(waitingLists.createdAt));

  if (projectId) {
    return query.where(eq(waitingLists.projectId, projectId));
  }
  return query;
}

export async function createWaitingList(data: unknown) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);
  const parsed = waitingListSchema.parse(data);

  // Check duplicate active waiting list
  const existing = await db
    .select()
    .from(waitingLists)
    .where(
      and(
        eq(waitingLists.customerId, parsed.customerId),
        eq(waitingLists.projectId, parsed.projectId),
        eq(waitingLists.status, "waiting")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Konsumen ini sudah terdaftar dalam antrean aktif untuk proyek tersebut.");
  }

  const id = crypto.randomUUID();

  await db.insert(waitingLists).values({ id, ...parsed });

  await writeAuditLog({
    action: "create",
    module: "marketing",
    entityId: id,
    entityType: "waiting_list",
    details: { customerId: parsed.customerId, projectId: parsed.projectId },
  });

  revalidatePath("/marketing/waiting-list");
  return { success: true, id };
}

export async function updateWaitingListStatus(
  id: string,
  status: "waiting" | "offered" | "converted" | "cancelled"
) {
  const user = await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing", "Marketing Manager"]);

  await db.update(waitingLists).set({ status }).where(eq(waitingLists.id, id));

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: id,
    entityType: "waiting_list",
    details: { status },
  });

  revalidatePath("/marketing/waiting-list");
  return { success: true };
}

export async function deleteWaitingList(id: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor"]);

  await db.delete(waitingLists).where(eq(waitingLists.id, id));

  await writeAuditLog({
    action: "delete",
    module: "marketing",
    entityId: id,
    entityType: "waiting_list",
  });

  revalidatePath("/marketing/waiting-list");
  return { success: true };
}

// ─── MARKETING TARGETS ───────────────────────────────────────────────────────

const marketingTargetSchema = z.object({
  marketingId: z.string().min(1),
  projectId: z.string().min(1),
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2020).max(2099),
  targetUnits: z.coerce.number().int().min(0).default(0),
  targetAmount: z.coerce.number().min(0).default(0),
});

export async function getMarketingTargets(year?: number) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing Manager", "Direksi / Manager", "Admin Keuangan"]);

  const { user: userTable } = await import("@/db/schema/auth");

  const query = db
    .select({
      id: marketingTargets.id,
      periodMonth: marketingTargets.periodMonth,
      periodYear: marketingTargets.periodYear,
      targetUnits: marketingTargets.targetUnits,
      targetAmount: marketingTargets.targetAmount,
      achievedUnits: marketingTargets.achievedUnits,
      achievedAmount: marketingTargets.achievedAmount,
      marketingId: userTable.id,
      marketingName: userTable.name,
      projectId: projects.id,
      projectName: projects.name,
    })
    .from(marketingTargets)
    .innerJoin(userTable, eq(marketingTargets.marketingId, userTable.id))
    .innerJoin(projects, eq(marketingTargets.projectId, projects.id))
    .orderBy(marketingTargets.periodYear, marketingTargets.periodMonth);

  if (year) {
    return query.where(eq(marketingTargets.periodYear, year));
  }
  return query;
}

export async function createMarketingTarget(data: unknown) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing Manager"]);
  const parsed = marketingTargetSchema.parse(data);

  // Check duplicate target for same marketingId, projectId, periodMonth, periodYear
  const existing = await db
    .select()
    .from(marketingTargets)
    .where(
      and(
        eq(marketingTargets.marketingId, parsed.marketingId),
        eq(marketingTargets.projectId, parsed.projectId),
        eq(marketingTargets.periodMonth, parsed.periodMonth),
        eq(marketingTargets.periodYear, parsed.periodYear)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Target pemasaran untuk staf marketing ini pada proyek dan periode terpilih sudah terdaftar.");
  }

  const id = crypto.randomUUID();

  await db.insert(marketingTargets).values({ id, ...parsed });

  await writeAuditLog({
    action: "create",
    module: "marketing",
    entityId: id,
    entityType: "marketing_target",
    details: parsed,
  });

  revalidatePath("/marketing/targets");
  return { success: true, id };
}

export async function updateMarketingTarget(id: string, data: unknown) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing Manager"]);
  const parsed = marketingTargetSchema.parse(data);

  await db.update(marketingTargets).set(parsed).where(eq(marketingTargets.id, id));

  await writeAuditLog({
    action: "update",
    module: "marketing",
    entityId: id,
    entityType: "marketing_target",
    details: parsed,
  });

  revalidatePath("/marketing/targets");
  return { success: true };
}

export async function deleteMarketingTarget(id: string) {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Marketing Manager"]);

  await db.delete(marketingTargets).where(eq(marketingTargets.id, id));

  await writeAuditLog({
    action: "delete",
    module: "marketing",
    entityId: id,
    entityType: "marketing_target",
  });

  revalidatePath("/marketing/targets");
  return { success: true };
}
