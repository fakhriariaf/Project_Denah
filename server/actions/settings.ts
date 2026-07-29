"use server";

import { db } from "@/db";
import { appSettings } from "@/db/schema/system";
import { requireRole } from "@/server/permissions";
import { z } from "zod";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/server/services/audit.service";
import { invalidateMaintenanceCache } from "@/lib/maintenance-cache";
import crypto from "crypto";

const DEFAULT_SETTINGS = [
  { key: "company_name", value: "PT. Denah Property Indonesia", description: "Nama resmi badan hukum perusahaan" },
  { key: "company_address", value: "Jl. Raya Cendana No. 12, Jakarta Selatan", description: "Alamat kantor operasional pusat" },
  { key: "company_phone", value: "+62 812-3456-7890", description: "Nomor WhatsApp Gateway operasional" },
  { key: "company_email", value: "info@denahproperty.com", description: "Email korespondensi resmi perusahaan" },
  { key: "kpr_sla_days", value: "5", description: "SLA target kelengkapan berkas fisik KPR (Hari Kerja)" },
  { key: "system_maintenance", value: "false", description: "Mengaktifkan/menonaktifkan mode pemeliharaan sistem" },
];

export async function getAppSettings() {
  await requireRole("Super Admin");

  const rows = await db.select().from(appSettings);

  // If no settings exist in db, initialize with defaults
  if (rows.length === 0) {
    const initialized: typeof rows = [];
    for (const def of DEFAULT_SETTINGS) {
      const id = crypto.randomUUID();
      const newRow = {
        id,
        key: def.key,
        value: def.value,
        description: def.description,
        updatedBy: null,
        updatedAt: new Date(),
      };
      await db.insert(appSettings).values(newRow).onConflictDoNothing();
      initialized.push(newRow);
    }
    return initialized;
  }

  // Ensure all default keys exist
  for (const def of DEFAULT_SETTINGS) {
    const exists = rows.some((r) => r.key === def.key);
    if (!exists) {
      const id = crypto.randomUUID();
      const newRow = {
        id,
        key: def.key,
        value: def.value,
        description: def.description,
        updatedBy: null,
        updatedAt: new Date(),
      };
      await db.insert(appSettings).values(newRow).onConflictDoNothing();
      rows.push(newRow);
    }
  }

  return rows;
}

/**
 * Whitelist + per-key value validation for app settings (P1 hardening).
 *
 * `updateAppSettings` used to accept any `Record<string, string>` and upsert it
 * verbatim, so a Super Admin session (or anything able to replay one) could write
 * unbounded values or invent arbitrary keys. `system_maintenance` in particular
 * feeds the maintenance middleware, so a malformed value there is a lockout risk.
 */
const APP_SETTING_VALUE_SCHEMAS: Record<string, z.ZodType<string>> = {
  company_name: z.string().trim().min(2, "Nama perusahaan minimal 2 karakter").max(150, "Nama perusahaan maksimal 150 karakter"),
  company_address: z.string().trim().min(5, "Alamat minimal 5 karakter").max(300, "Alamat maksimal 300 karakter"),
  company_phone: z
    .string()
    .trim()
    .min(6, "Nomor telepon minimal 6 karakter")
    .max(30, "Nomor telepon maksimal 30 karakter")
    .regex(/^[0-9+()\-\s]+$/, "Nomor telepon hanya boleh berisi angka, spasi, +, -, dan tanda kurung"),
  company_email: z.string().trim().max(150, "Email maksimal 150 karakter").email("Format email tidak valid"),
  kpr_sla_days: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "SLA KPR harus berupa angka hari")
    .refine((v) => Number(v) >= 1 && Number(v) <= 365, "SLA KPR harus antara 1 dan 365 hari"),
  // Stored as a string in app_settings; only the two canonical boolean strings are accepted.
  system_maintenance: z.enum(["true", "false"], {
    message: "Nilai mode pemeliharaan harus 'true' atau 'false'",
  }),
};

const ALLOWED_SETTING_KEYS = Object.keys(APP_SETTING_VALUE_SCHEMAS);

function parseSettingsMap(settingsMap: unknown): Record<string, string> {
  if (!settingsMap || typeof settingsMap !== "object" || Array.isArray(settingsMap)) {
    throw new Error("Data pengaturan tidak valid.");
  }

  const entries = Object.entries(settingsMap as Record<string, unknown>);
  if (entries.length === 0) {
    throw new Error("Tidak ada pengaturan yang dikirim.");
  }
  if (entries.length > ALLOWED_SETTING_KEYS.length) {
    throw new Error("Terlalu banyak pengaturan dikirim dalam satu permintaan.");
  }

  const validated: Record<string, string> = {};
  for (const [key, rawValue] of entries) {
    const schema = APP_SETTING_VALUE_SCHEMAS[key];
    if (!schema) {
      throw new Error(`Pengaturan "${key}" tidak dikenali dan tidak dapat diubah.`);
    }
    if (typeof rawValue !== "string") {
      throw new Error(`Nilai pengaturan "${key}" harus berupa teks.`);
    }
    const parsed = schema.safeParse(rawValue);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? `Nilai pengaturan "${key}" tidak valid.`);
    }
    validated[key] = parsed.data;
  }

  return validated;
}

export async function updateAppSettings(rawSettingsMap: Record<string, string>) {
  const activeUser = await requireRole("Super Admin");

  const settingsMap = parseSettingsMap(rawSettingsMap);

  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(settingsMap)) {
      await tx.insert(appSettings)
        .values({
          id: crypto.randomUUID(),
          key,
          value,
          description: `Pengaturan ${key}`,
          updatedBy: activeUser.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: {
            value,
            updatedBy: activeUser.id,
            updatedAt: new Date(),
          }
        })
        .run();
    }
  });

  // Invalidate maintenance cache if maintenance mode setting was updated
  if ("system_maintenance" in settingsMap) {
    invalidateMaintenanceCache();
  }

  await writeAuditLog({
    action: "update",
    module: "master",
    entityId: "app_settings",
    entityType: "system_settings",
    details: { keys: Object.keys(settingsMap) },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/maintenance");
  return { success: true };
}
