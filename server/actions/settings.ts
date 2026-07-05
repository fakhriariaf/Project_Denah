"use server";

import { db } from "@/db";
import { appSettings } from "@/db/schema/system";
import { requireRole } from "@/server/permissions";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "./audit";
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

export async function updateAppSettings(settingsMap: Record<string, string>) {
  const activeUser = await requireRole("Super Admin");

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
