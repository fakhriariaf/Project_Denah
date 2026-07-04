import { cache } from "react";
import { auth } from "../auth";
import { db } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { user as userTable } from "@/db/schema/auth";
import { roles, permissions as permissionsTable, rolePermissions } from "@/db/schema/access";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user || null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const details = await getUserRoleDetails(user.id);
  if (details && details.status !== "active") {
    redirect("/login?error=inactive");
  }
  return user;
}

// memoize role details per request cycle to avoid multiple DB roundtrips in a single request
export const getUserRoleDetails = cache(async (userId: string) => {
  const result = await db
    .select({ roleId: userTable.roleId, roleName: roles.name, status: userTable.status })
    .from(userTable)
    .leftJoin(roles, eq(userTable.roleId, roles.id))
    .where(eq(userTable.id, userId))
    .limit(1);

  return result[0] || null;
});

export const getUserRole = cache(async (userId: string): Promise<string | null> => {
  const details = await getUserRoleDetails(userId);
  return details?.roleName || null;
});

export async function hasRole(userId: string, roleName: string) {
  const userRole = await getUserRole(userId);
  if (!userRole) return false;

  // Super Admin has access to everything
  if (userRole === "Super Admin") return true;

  return userRole === roleName;
}

export async function requireRole(roleName: string) {
  const user = await requireAuth();
  const hasAccess = await hasRole(user.id, roleName);
  if (!hasAccess) {
    redirect("/unauthorized");
  }
  return user;
}

export async function hasAnyRole(userId: string, roleNames: string[]) {
  const userRole = await getUserRole(userId);
  if (!userRole) return false;

  if (userRole === "Super Admin") return true;

  return roleNames.includes(userRole);
}

export async function requireAnyRole(roleNames: string[]) {
  const user = await requireAuth();
  const hasAccess = await hasAnyRole(user.id, roleNames);
  if (!hasAccess) {
    redirect("/unauthorized");
  }
  return user;
}

export async function hasPermission(userId: string, permissionName: string): Promise<boolean> {
  const details = await getUserRoleDetails(userId);
  if (!details || !details.roleId) return false;

  const { roleId, roleName } = details;
  // Super Admin bypasses all permission checks — check by name, not hardcoded ID
  if (roleName === "Super Admin") return true;

  let actionMatch = permissionName;
  let resourceMatch: string | null = null;
  if (permissionName.includes(".")) {
    const parts = permissionName.split(".");
    resourceMatch = parts[0];
    actionMatch = parts[1];
  }

  const conditions = [eq(rolePermissions.roleId, roleId)];
  if (resourceMatch) {
    conditions.push(
      sql`(${permissionsTable.action} = ${permissionName} OR (${permissionsTable.resource} = ${resourceMatch} AND ${permissionsTable.action} = ${actionMatch}))`
    );
  } else {
    conditions.push(eq(permissionsTable.action, permissionName));
  }

  const permissionResult = await db
    .select({ id: rolePermissions.id })
    .from(rolePermissions)
    .innerJoin(permissionsTable, eq(rolePermissions.permissionId, permissionsTable.id))
    .where(and(...conditions))
    .limit(1);

  return permissionResult.length > 0;
}

export async function requirePermission(permissionName: string) {
  const user = await requireAuth();
  const allowed = await hasPermission(user.id, permissionName);
  if (!allowed) {
    redirect("/unauthorized");
  }
  return user;
}

export async function getSessionRole(userId: string) {
  const details = await getUserRoleDetails(userId);
  const role = details?.roleName || "Viewer";
  const roleId = details?.roleId || "";
  
  // BUG 10 FIX: Use role name consistently for all role checks — no hardcoded role IDs
  // Previously isPengawas used roleId === "role_pengawas" (hardcoded ID) while others used role name.
  // Unified to role name for consistency and resilience to seed changes.
  const isSuperAdmin = role === "Super Admin";
  const isAdminKantor = isSuperAdmin || role === "Admin Kantor";
  const isMarketingManager = isSuperAdmin || role === "Marketing Manager";
  const isMarketing = isSuperAdmin || role === "Marketing" || role === "Marketing Manager";
  const isKeuangan = isSuperAdmin || role === "Admin Keuangan";
  const isDireksi = isSuperAdmin || role === "Direksi / Manager";
  const isPengawas = isSuperAdmin || role === "Pengawas Lapangan";
  const isVendor = role === "Kontraktor / Vendor";
  const isViewer = isSuperAdmin || role === "Viewer";
  
  const isEditor = isSuperAdmin || role === "Admin Kantor";

  return {
    role,
    isSuperAdmin,
    isAdminKantor,
    isMarketingManager,
    isMarketing,
    isKeuangan,
    isDireksi,
    isPengawas,
    isVendor,
    isViewer,
    isEditor,
  };
}


