"use server";

import { db } from "@/db";
import { user as userTable, userProfiles, userEmployments, vendorProfiles } from "@/db/schema/auth";
import { auditLogs } from "@/db/schema/system";
import { roles } from "@/db/schema/access";
import { vendors } from "@/db/schema/master";
import { getCurrentUser, hasPermission } from "@/server/permissions";
import { eq, and, ne, desc, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "./audit";

// 1. Zod Validation Schemas
const basicProfileSchema = z.object({
  fullName: z.string().min(2, "Nama lengkap minimal 2 karakter"),
  phone: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  gender: z.enum(["male", "female"]).nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
});

const employmentProfileSchema = z.object({
  employeeNumber: z.string().min(2, "NIP minimal 2 karakter"),
  position: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  joinedDate: z.string().nullable().optional(),
  employmentStatus: z.enum(["permanent", "contract", "intern"]).nullable().optional(),
  supervisorId: z.string().nullable().optional(),
  workLocation: z.string().nullable().optional(),
});

const vendorProfileSchema = z.object({
  vendorCode: z.string().min(2, "Kode Vendor minimal 2 karakter"),
  companyName: z.string().min(2, "Nama Perusahaan minimal 2 karakter"),
  picName: z.string().nullable().optional(),
  picPhone: z.string().nullable().optional(),
  vendorType: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

// Helper for clean validation errors
function validateWithSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMsg = result.error.issues.map((e) => e.message).join(", ");
    throw new Error(errorMsg);
  }
  return result.data;
}

// 2. Fetch Aggregated Profile Data
export async function getUserProfileData(targetUserId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Unauthorized");

  // Gating check: Must have user.read or be querying their own profile
  const isOwnProfile = currentUser.id === targetUserId;
  const canReadAnyUser = await hasPermission(currentUser.id, "user.read");

  if (!isOwnProfile && !canReadAnyUser) {
    throw new Error("Anda tidak memiliki izin untuk melihat profil ini.");
  }

  // Query User Details
  const userDetails = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      roleId: userTable.roleId,
      roleName: roles.name,
      status: userTable.status,
      lastLogin: userTable.lastLogin,
      createdAt: userTable.createdAt,
      image: userTable.image,
    })
    .from(userTable)
    .leftJoin(roles, eq(userTable.roleId, roles.id))
    .where(eq(userTable.id, targetUserId))
    .limit(1);

  if (userDetails.length === 0) {
    throw new Error("Pengguna tidak ditemukan.");
  }

  // Query Sub-Profiles
  const [profile, employment, vendor, targetAuditLogs, internalUsersList] = await Promise.all([
    db.select().from(userProfiles).where(eq(userProfiles.userId, targetUserId)).limit(1),
    db.select().from(userEmployments).where(eq(userEmployments.userId, targetUserId)).limit(1),
    db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, targetUserId)).limit(1),
    
    // Fetch logs specific to the target user
    db.select({
      id: auditLogs.id,
      action: auditLogs.action,
      module: auditLogs.module,
      details: auditLogs.details,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      userName: userTable.name,
    })
    .from(auditLogs)
    .leftJoin(userTable, eq(auditLogs.userId, userTable.id))
    .where(
      or(
        eq(auditLogs.userId, targetUserId),
        eq(auditLogs.entityId, targetUserId)
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(20),

    // Fetch potential supervisors (Admin, Super Admin, Direksi)
    db.select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .leftJoin(roles, eq(userTable.roleId, roles.id))
      .where(and(
        ne(userTable.id, targetUserId),
        eq(userTable.status, "active")
      ))
      .orderBy(userTable.name)
  ]);

  return {
    user: userDetails[0],
    profile: profile[0] || null,
    employment: employment[0] || null,
    vendor: vendor[0] || null,
    auditLogs: targetAuditLogs,
    usersList: internalUsersList,
  };
}

// 3. Update Basic Profile
export async function updateBasicProfile(targetUserId: string, data: unknown) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Unauthorized");

  const isOwnProfile = currentUser.id === targetUserId;
  const canUpdateAny = await hasPermission(currentUser.id, "profile.update_any");
  const canUpdateOwn = await hasPermission(currentUser.id, "profile.update_own");

  if (!canUpdateAny && !(canUpdateOwn && isOwnProfile)) {
    throw new Error("Anda tidak memiliki izin untuk mengedit profil ini.");
  }

  const parsed = validateWithSchema(basicProfileSchema, data);

  // Update user base fields
  await db
    .update(userTable)
    .set({
      name: parsed.fullName,
      image: parsed.avatarUrl || null,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, targetUserId));

  // Upsert profile record
  const existingProfile = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, targetUserId))
    .limit(1);

  const profileValues = {
    fullName: parsed.fullName,
    avatarUrl: parsed.avatarUrl || null,
    phone: parsed.phone || null,
    birthDate: parsed.birthDate && !isNaN(Date.parse(parsed.birthDate)) ? new Date(parsed.birthDate) : null,
    gender: parsed.gender || null,
    address: parsed.address || null,
    city: parsed.city || null,
    province: parsed.province || null,
    updatedAt: new Date(),
  };

  if (existingProfile.length > 0) {
    await db
      .update(userProfiles)
      .set(profileValues)
      .where(eq(userProfiles.userId, targetUserId));
  } else {
    await db.insert(userProfiles).values({
      id: crypto.randomUUID(),
      userId: targetUserId,
      ...profileValues,
      createdAt: new Date(),
    });
  }

  await writeAuditLog({
    action: "update",
    module: "profile",
    entityId: targetUserId,
    entityType: "user_profile",
    details: { fullName: parsed.fullName },
  });

  revalidatePath(`/dashboard/users/${targetUserId}`);
  revalidatePath("/dashboard/account");
  revalidatePath("/dashboard/users");

  return { success: true };
}

// 4. Update Employment Profile (Staff Only)
export async function updateEmploymentProfile(targetUserId: string, data: unknown) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Unauthorized");

  const canUpdate = await hasPermission(currentUser.id, "employment.update");
  if (!canUpdate) {
    throw new Error("Anda tidak memiliki izin untuk memperbarui profil pekerjaan karyawan.");
  }

  const parsed = validateWithSchema(employmentProfileSchema, data);

  // Check unique employeeNumber NIP
  const duplicateNip = await db
    .select({ id: userEmployments.id })
    .from(userEmployments)
    .where(and(
      eq(userEmployments.employeeNumber, parsed.employeeNumber),
      ne(userEmployments.userId, targetUserId)
    ))
    .limit(1);

  if (duplicateNip.length > 0) {
    throw new Error(`NIP "${parsed.employeeNumber}" sudah digunakan oleh karyawan lain.`);
  }

  const existingEmployment = await db
    .select()
    .from(userEmployments)
    .where(eq(userEmployments.userId, targetUserId))
    .limit(1);

  const employmentValues = {
    employeeNumber: parsed.employeeNumber,
    position: parsed.position || null,
    department: parsed.department || null,
    joinedDate: parsed.joinedDate && !isNaN(Date.parse(parsed.joinedDate)) ? new Date(parsed.joinedDate) : null,
    employmentStatus: parsed.employmentStatus || null,
    supervisorId: parsed.supervisorId || null,
    workLocation: parsed.workLocation || null,
    updatedAt: new Date(),
  };

  if (existingEmployment.length > 0) {
    await db
      .update(userEmployments)
      .set(employmentValues)
      .where(eq(userEmployments.userId, targetUserId));
  } else {
    await db.insert(userEmployments).values({
      id: crypto.randomUUID(),
      userId: targetUserId,
      ...employmentValues,
      createdAt: new Date(),
    });
  }

  await writeAuditLog({
    action: "update",
    module: "employment",
    entityId: targetUserId,
    entityType: "user_employment",
    details: { employeeNumber: parsed.employeeNumber, position: parsed.position },
  });

  revalidatePath(`/dashboard/users/${targetUserId}`);
  revalidatePath("/dashboard/account");

  return { success: true };
}

// 5. Update Vendor Profile (Contractors Only)
export async function updateVendorProfile(targetUserId: string, data: unknown) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Unauthorized");

  const isOwnProfile = currentUser.id === targetUserId;
  const canUpdateAny = await hasPermission(currentUser.id, "vendor_profile.update");

  if (!canUpdateAny && !isOwnProfile) {
    throw new Error("Anda tidak memiliki izin untuk mengedit data profil vendor ini.");
  }

  const parsed = validateWithSchema(vendorProfileSchema, data);

  // Fetch existing vendor profile to lock status and vendorCode for self-edits
  const [existingVendor] = await db
    .select()
    .from(vendorProfiles)
    .where(eq(vendorProfiles.userId, targetUserId))
    .limit(1);

  if (isOwnProfile && !canUpdateAny && existingVendor) {
    if (parsed.status !== existingVendor.status) {
      throw new Error("Anda tidak memiliki wewenang untuk mengubah status aktif vendor Anda sendiri.");
    }
    if (parsed.vendorCode !== existingVendor.vendorCode) {
      throw new Error("Anda tidak memiliki wewenang untuk mengubah Kode Vendor Anda sendiri.");
    }
  }

  // Check unique vendorCode
  const duplicateCode = await db
    .select({ id: vendorProfiles.id })
    .from(vendorProfiles)
    .where(and(
      eq(vendorProfiles.vendorCode, parsed.vendorCode),
      ne(vendorProfiles.userId, targetUserId)
    ))
    .limit(1);

  if (duplicateCode.length > 0) {
    throw new Error(`Kode Vendor "${parsed.vendorCode}" sudah digunakan oleh vendor lain.`);
  }

  // Resolve vendorId based on companyName
  const [matchedVendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.name, parsed.companyName))
    .limit(1);

  const vendorValues = {
    vendorCode: parsed.vendorCode,
    companyName: parsed.companyName,
    picName: parsed.picName || null,
    picPhone: parsed.picPhone || null,
    vendorType: parsed.vendorType || null,
    address: parsed.address || null,
    status: parsed.status,
    vendorId: matchedVendor?.id || null,
    updatedAt: new Date(),
  };

  if (existingVendor) {
    await db
      .update(vendorProfiles)
      .set(vendorValues)
      .where(eq(vendorProfiles.userId, targetUserId));
  } else {
    await db.insert(vendorProfiles).values({
      id: crypto.randomUUID(),
      userId: targetUserId,
      ...vendorValues,
      createdAt: new Date(),
    });
  }

  await writeAuditLog({
    action: "update",
    module: "vendor_profile",
    entityId: targetUserId,
    entityType: "vendor_profile",
    details: { vendorCode: parsed.vendorCode, companyName: parsed.companyName },
  });

  revalidatePath(`/dashboard/users/${targetUserId}`);
  revalidatePath("/dashboard/account");

  return { success: true };
}

// 6. Update Account Status & Role
export async function updateAccountStatus(
  targetUserId: string,
  payload: { status: "active" | "inactive" | "suspended"; roleId: string }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Unauthorized");

  const canUpdateStatus = await hasPermission(currentUser.id, "account.status.update");
  const canAssignRole = await hasPermission(currentUser.id, "user.assign_role");

  if (!canUpdateStatus || !canAssignRole) {
    throw new Error("Anda tidak memiliki izin admin untuk mengubah status atau role akun.");
  }

  if (targetUserId === currentUser.id) {
    throw new Error("Anda tidak dapat menonaktifkan atau mengubah role akun Anda sendiri.");
  }

  // Update
  await db
    .update(userTable)
    .set({
      status: payload.status,
      roleId: payload.roleId,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, targetUserId));

  await writeAuditLog({
    action: "update_access",
    module: "auth",
    entityId: targetUserId,
    entityType: "user",
    details: { newStatus: payload.status, newRoleId: payload.roleId },
  });

  revalidatePath(`/dashboard/users/${targetUserId}`);
  revalidatePath("/dashboard/users");

  return { success: true };
}
