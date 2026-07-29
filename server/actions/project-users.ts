"use server";

import { db } from "@/db";
import { projectUsers } from "@/db/schema/master";
import { requireRole } from "@/server/permissions";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/server/services/audit.service";

export async function updateUserProjectAssignments(targetUserId: string, projectIds: string[]) {
  await requireRole("Super Admin");

  await db.transaction(async (tx) => {
    // 1. Delete existing project assignments for this user
    await tx
      .delete(projectUsers)
      .where(eq(projectUsers.userId, targetUserId));

    // 2. Insert new project assignments if array is not empty
    if (projectIds.length > 0) {
      const insertValues = projectIds.map((projectId) => ({
        id: crypto.randomUUID(),
        projectId: projectId,
        userId: targetUserId,
      }));
      await tx.insert(projectUsers).values(insertValues);
    }
  });

  // 3. Write audit log
  await writeAuditLog({
    action: "update",
    module: "auth",
    entityId: targetUserId,
    entityType: "user_projects",
    details: { assignedProjectIds: projectIds },
  });

  // 4. Revalidate cache
  revalidatePath(`/dashboard/users/${targetUserId}`);
  revalidatePath("/dashboard/users");
  revalidatePath("/production");

  return { success: true };
}
