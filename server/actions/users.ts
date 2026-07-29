"use server";

import { db } from "@/db";
import { user as userTable, session as sessionTable, account as accountTable } from "@/db/schema/auth";
import { roles } from "@/db/schema/access";
import { requireRole, requireAuth } from "@/server/permissions";
import { auth } from "@/server/auth";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/server/services/audit.service";

const createUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  roleId: z.string().min(1, "Role wajib dipilih"),
});

export async function createUser(data: unknown) {
  await requireRole("Super Admin");

  const parsed = createUserSchema.parse(data);

  // Create via Better Auth
  const result = await auth.api.signUpEmail({
    body: {
      name: parsed.name,
      email: parsed.email,
      password: parsed.password,
    },
  });

  if (!result?.user) throw new Error("Gagal membuat akun");

  // Assign role
  await db.update(userTable)
    .set({ roleId: parsed.roleId })
    .where(eq(userTable.id, result.user.id));

  await writeAuditLog({
    action: "create",
    module: "auth",
    entityId: result.user.id,
    entityType: "user",
    details: { email: parsed.email, name: parsed.name },
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function updateUserRole(userId: string, roleId: string) {
  await requireRole("Super Admin");

  if (!roleId) throw new Error("Role wajib dipilih");

  await db.update(userTable).set({ roleId }).where(eq(userTable.id, userId));

  await writeAuditLog({
    action: "update",
    module: "auth",
    entityId: userId,
    entityType: "user",
    details: { newRoleId: roleId },
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function deleteUser(userId: string) {
  const currentUser = await requireRole("Super Admin");

  if (userId === currentUser.id) {
    throw new Error("Anda tidak dapat menghapus akun Anda sendiri!");
  }

  // Invalidate ALL active sessions for the target user BEFORE deleting the account.
  // Prevents ghost sessions where deleted users retain valid auth tokens.
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId));

  await db.delete(userTable).where(eq(userTable.id, userId));

  await writeAuditLog({
    action: "delete",
    module: "auth",
    entityId: userId,
    entityType: "user",
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function getRoles() {
  return db.select().from(roles).orderBy(roles.name);
}

export async function resetUserPassword(userId: string, newPassword: string) {
  await requireRole("Super Admin");

  if (!newPassword || newPassword.length < 8) {
    throw new Error("Password minimal 8 karakter");
  }

  const hashedPassword = await hashPassword(newPassword);

  await db
    .update(accountTable)
    .set({
      password: hashedPassword,
      updatedAt: new Date(),
    })
    .where(eq(accountTable.userId, userId));

  await db
    .delete(sessionTable)
    .where(eq(sessionTable.userId, userId));

  const [targetUser] = await db
    .select({ name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  await writeAuditLog({
    action: "update",
    module: "auth",
    entityId: userId,
    entityType: "user_password",
    details: { email: targetUser?.email ?? "", name: targetUser?.name ?? "" },
  });

  return { success: true };
}

export async function changeOwnPassword(newPassword: string) {
  const activeUser = await requireAuth();

  if (!newPassword || newPassword.length < 8) {
    throw new Error("Password minimal 8 karakter");
  }

  const hashedPassword = await hashPassword(newPassword);

  await db
    .update(accountTable)
    .set({
      password: hashedPassword,
      updatedAt: new Date(),
    })
    .where(eq(accountTable.userId, activeUser.id));

  await db
    .delete(sessionTable)
    .where(eq(sessionTable.userId, activeUser.id));

  await writeAuditLog({
    action: "update",
    module: "auth",
    entityId: activeUser.id,
    entityType: "change_password_own",
    details: { email: activeUser.email, name: activeUser.name },
  });

  return { success: true };
}
