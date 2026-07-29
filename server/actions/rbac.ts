"use server";

import { db } from "@/db";
import { roles, permissions, rolePermissions } from "@/db/schema/access";
import { requireAnyRole } from "../permissions";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/server/services/audit.service";

export async function grantPermission(roleId: string, permissionId: string) {
  await requireAnyRole(["Super Admin"]);

  // Check role exists
  const role = await db.select({ id: roles.id, name: roles.name }).from(roles).where(eq(roles.id, roleId)).limit(1);
  if (role.length === 0) throw new Error("Role tidak ditemukan.");
  if (role[0].name === "Super Admin") throw new Error("Super Admin selalu memiliki semua izin dan tidak dapat diubah.");

  // Check if already granted
  const existing = await db.select({ id: rolePermissions.id })
    .from(rolePermissions)
    .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)))
    .limit(1);
  if (existing.length > 0) return { success: true }; // already granted

  const id = crypto.randomUUID();
  await db.insert(rolePermissions).values({ id, roleId, permissionId });

  await writeAuditLog({
    action: "create",
    module: "access",
    entityId: id,
    entityType: "role_permission",
    details: { roleId, permissionId },
  });

  revalidatePath("/settings/roles");
  return { success: true };
}

export async function revokePermission(roleId: string, permissionId: string) {
  await requireAnyRole(["Super Admin"]);

  // Check role exists
  const role = await db.select({ id: roles.id, name: roles.name }).from(roles).where(eq(roles.id, roleId)).limit(1);
  if (role.length === 0) throw new Error("Role tidak ditemukan.");
  if (role[0].name === "Super Admin") throw new Error("Super Admin selalu memiliki semua izin dan tidak dapat diubah.");

  await db.delete(rolePermissions)
    .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));

  await writeAuditLog({
    action: "delete",
    module: "access",
    entityId: `${roleId}:${permissionId}`,
    entityType: "role_permission",
    details: { roleId, permissionId },
  });

  revalidatePath("/settings/roles");
  return { success: true };
}

export async function getAllRolesWithPermissions() {
  await requireAnyRole(["Super Admin"]);

  const [allRoles, allPermissions, allRolePerms] = await Promise.all([
    db.select().from(roles).orderBy(roles.name),
    db.select().from(permissions).orderBy(permissions.resource, permissions.action),
    db.select().from(rolePermissions),
  ]);

  return { roles: allRoles, permissions: allPermissions, rolePermissions: allRolePerms };
}
