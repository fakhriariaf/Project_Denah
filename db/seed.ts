import { db } from "./index";
import { roles } from "./schema/access";
import { user } from "./schema/auth";
import { financeCategories } from "./schema/master";
import { kprSlaConfigs } from "./schema/marketing";
import { auth } from "../server/auth";

/**
 * Seed the two global "Koreksi & Pembalikan" finance categories used by the
 * ledger correction/reversal flow (Phase 4). The reversal action resolves the
 * category whose `type` matches the inverse adjustment type, so both an income
 * and an expense variant are required. Categories are global (finance_categories
 * has no projectId) and idempotent — only inserted when a category with the
 * same name + type does not already exist.
 */
export async function seedReversalCategories() {
  const { and, eq } = await import("drizzle-orm");

  const reversalCategories: Array<{ name: string; type: "income" | "expense" }> = [
    { name: "Koreksi & Pembalikan (Pemasukan)", type: "income" },
    { name: "Koreksi & Pembalikan (Pengeluaran)", type: "expense" },
  ];

  for (const cat of reversalCategories) {
    try {
      const existing = await db
        .select()
        .from(financeCategories)
        .where(and(eq(financeCategories.name, cat.name), eq(financeCategories.type, cat.type)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(financeCategories).values({
          id: crypto.randomUUID(),
          name: cat.name,
          type: cat.type,
          status: "active",
          createdAt: new Date(),
        });
        console.log(`Reversal category created: ${cat.name} (${cat.type})`);
      } else {
        console.log(`Reversal category already exists: ${cat.name} (${cat.type})`);
      }
    } catch (err) {
      console.error(`Failed to seed reversal category ${cat.name}:`, err);
    }
  }
}

/**
 * Seed the 5 default global KPR SLA configurations for measured stages.
 * Each config sets the target working days for a stage at the global scope.
 * Idempotent: skips insertion when an active global config for the same stage
 * already exists, preserving any user-modified values.
 *
 * Stages seeded: bi_checking (2), pemberkasan (5), proses_bank (7),
 * offering (3), approved (3).
 * NOT seeded: akad, rejected, realisasi (terminal SLA stages).
 */
export async function seedKprSlaGlobalDefaults() {
  const { and, eq } = await import("drizzle-orm");

  const globalDefaults: Array<{
    stage: "bi_checking" | "pemberkasan" | "proses_bank" | "offering" | "approved";
    workingDays: number;
  }> = [
    { stage: "bi_checking", workingDays: 2 },
    { stage: "pemberkasan", workingDays: 5 },
    { stage: "proses_bank", workingDays: 7 },
    { stage: "offering", workingDays: 3 },
    { stage: "approved", workingDays: 3 },
  ];

  for (const config of globalDefaults) {
    try {
      // Check if an active global config for this stage already exists
      const existing = await db
        .select()
        .from(kprSlaConfigs)
        .where(
          and(
            eq(kprSlaConfigs.scope, "global"),
            eq(kprSlaConfigs.stage, config.stage),
            eq(kprSlaConfigs.isActive, true)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(kprSlaConfigs).values({
          id: crypto.randomUUID(),
          scope: "global",
          projectId: null,
          stage: config.stage,
          workingDays: config.workingDays,
          isActive: true,
          createdBy: null,
          updatedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`KPR SLA global default created: ${config.stage} = ${config.workingDays} hari kerja`);
      } else {
        console.log(`KPR SLA global default already exists: ${config.stage} (skipped)`);
      }
    } catch (err) {
      console.error(`Failed to seed KPR SLA global default for ${config.stage}:`, err);
    }
  }
}

async function main() {
  console.log("Seeding database...");

  // 1. Roles
  const defaultRoles = [
    { id: "role_super_admin", name: "Super Admin", description: "Akses penuh ke seluruh sistem" },
    { id: "role_admin_kantor", name: "Admin Kantor", description: "Akses operasional kantor" },
    { id: "role_marketing_manager", name: "Marketing Manager", description: "Akses penjualan, customer, dan pendelegasian PIC" },
    { id: "role_marketing", name: "Marketing", description: "Akses penjualan dan customer" },
    { id: "role_admin_keuangan", name: "Admin Keuangan", description: "Akses kas dan invoice" },
    { id: "role_direksi", name: "Direksi / Manager", description: "Akses laporan dan approval" },
    { id: "role_pengawas", name: "Pengawas Lapangan", description: "Akses update progress lapangan" },
    { id: "role_vendor", name: "Kontraktor / Vendor", description: "Akses SPK dan tagihan" },
    { id: "role_viewer", name: "Viewer", description: "Akses lihat data saja" },
  ];

  for (const role of defaultRoles) {
    try {
      await db.insert(roles).values({
        ...role,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();
    } catch {
      console.log(`Failed to seed role ${role.name}`);
    }
  }

  // 2. Create Users for every single role
  const defaultUsers = [
    { email: "admin@denahproperty.com", name: "Super Admin User", roleId: "role_super_admin" },
    { email: "kantor@denahproperty.com", name: "Admin Kantor User", roleId: "role_admin_kantor" },
    { email: "marketing_manager@denahproperty.com", name: "Marketing Manager User", roleId: "role_marketing_manager" },
    { email: "marketing@denahproperty.com", name: "Marketing User", roleId: "role_marketing" },
    { email: "keuangan@denahproperty.com", name: "Keuangan User", roleId: "role_admin_keuangan" },
    { email: "direksi@denahproperty.com", name: "Direksi User", roleId: "role_direksi" },
    { email: "pengawas@denahproperty.com", name: "Pengawas Lapangan User", roleId: "role_pengawas" },
    { email: "vendor@denahproperty.com", name: "Vendor User", roleId: "role_vendor" },
    { email: "viewer@denahproperty.com", name: "Viewer User", roleId: "role_viewer" },
  ];

  const { eq } = await import("drizzle-orm");

  for (const u of defaultUsers) {
    try {
      // Check if user already exists
      const existingUser = await db.select().from(user).where(eq(user.email, u.email)).limit(1);
      
      if (existingUser.length === 0) {
        console.log(`Creating user for ${u.name}...`);
        const { user: newUser } = await auth.api.signUpEmail({
          body: {
            email: u.email,
            password: "password123",
            name: u.name,
          }
        });

        if (newUser) {
          // Assign roleId
          await db.update(user)
            .set({ roleId: u.roleId })
            .where(eq(user.id, newUser.id));
          
          console.log(`User created. Email: ${u.email}, Role: ${u.roleId}`);
        }
      } else {
        // Just make sure roleId is set correctly even if user existed
        await db.update(user)
          .set({ roleId: u.roleId })
          .where(eq(user.id, existingUser[0].id));
        console.log(`User ${u.email} already exists, verified role matches.`);
      }
    } catch (error) {
      console.error(`Error creating user ${u.email}:`, error);
    }
  }

  // 3. Permissions Seeding
  console.log("Seeding permissions...");
  const { permissions, rolePermissions } = await import("./schema/access");

  const systemPermissions = [
    { id: "perm_user_read", action: "user.read", resource: "user", description: "Melihat daftar dan detail pengguna" },
    { id: "perm_user_create", action: "user.create", resource: "user", description: "Membuat akun pengguna baru" },
    { id: "perm_user_update", action: "user.update", resource: "user", description: "Mengedit akun pengguna" },
    { id: "perm_user_delete", action: "user.delete", resource: "user", description: "Menghapus akun pengguna" },
    { id: "perm_user_assign_role", action: "user.assign_role", resource: "user", description: "Mengubah role pengguna" },
    { id: "perm_profile_read", action: "profile.read", resource: "profile", description: "Melihat profil pengguna" },
    { id: "perm_profile_update_own", action: "profile.update_own", resource: "profile", description: "Mengedit profil diri sendiri" },
    { id: "perm_profile_update_any", action: "profile.update_any", resource: "profile", description: "Mengedit profil pengguna mana saja" },
    { id: "perm_employment_read", action: "employment.read", resource: "employment", description: "Melihat data kepegawaian" },
    { id: "perm_employment_update", action: "employment.update", resource: "employment", description: "Mengedit data kepegawaian" },
    { id: "perm_vendor_profile_read", action: "vendor_profile.read", resource: "vendor_profile", description: "Melihat profil kontraktor/vendor" },
    { id: "perm_vendor_profile_update", action: "vendor_profile.update", resource: "vendor_profile", description: "Mengedit profil kontraktor/vendor" },
    { id: "perm_account_security_read", action: "account.security.read", resource: "account", description: "Melihat riwayat login dan status keamanan" },
    { id: "perm_account_status_update", action: "account.status.update", resource: "account", description: "Menonaktifkan atau mengaktifkan status akun" },
  ];

  for (const perm of systemPermissions) {
    try {
      await db.insert(permissions).values({
        id: perm.id,
        action: perm.action,
        resource: perm.resource,
        description: perm.description,
        createdAt: new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.log(`Failed to seed permission ${perm.action}`);
    }
  }

  // 4. Role Permissions Mapping
  console.log("Seeding role permission mappings...");
  const rolePermissionsMap: Record<string, string[]> = {
    role_super_admin: systemPermissions.map(p => p.id),
    role_admin_kantor: [
      "perm_user_read", "perm_user_create", "perm_user_update",
      "perm_profile_read", "perm_profile_update_any",
      "perm_employment_read", "perm_employment_update",
      "perm_vendor_profile_read", "perm_vendor_profile_update",
      "perm_account_security_read"
    ],
    role_direksi: [
      "perm_user_read",
      "perm_profile_read",
      "perm_employment_read",
      "perm_vendor_profile_read",
      "perm_account_security_read"
    ],
    role_viewer: [
      "perm_profile_read",
      "perm_account_security_read"
    ],
    role_marketing_manager: [
      "perm_profile_read", "perm_profile_update_own", "perm_user_read"
    ],
    role_marketing: [
      "perm_profile_read", "perm_profile_update_own"
    ],
    role_admin_keuangan: [
      "perm_profile_read", "perm_profile_update_own"
    ],
    role_pengawas: [
      "perm_profile_read", "perm_profile_update_own"
    ],
    role_vendor: [
      "perm_profile_read", "perm_profile_update_own",
      "perm_vendor_profile_read", "perm_vendor_profile_update"
    ],
  };

  for (const [roleId, permIds] of Object.entries(rolePermissionsMap)) {
    for (const permId of permIds) {
      try {
        await db.insert(rolePermissions).values({
          id: `rp_${roleId}_${permId}`,
          roleId,
          permissionId: permId,
          createdAt: new Date(),
        }).onConflictDoNothing();
      } catch (err) {
        // Ignored if mapping already exists
      }
    }
  }

  // 5. Reversal / correction finance categories (Phase 4)
  console.log("Seeding reversal finance categories...");
  await seedReversalCategories();

  // 6. KPR SLA global default configurations (5 measured stages)
  console.log("Seeding KPR SLA global defaults...");
  await seedKprSlaGlobalDefaults();

  console.log("Seeding complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seeding failed", err);
  process.exit(1);
});
