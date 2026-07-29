/**
 * INTERNAL SERVICE — SPK notification fan-out.
 *
 * SECURITY BOUNDARY (P0): this module intentionally does NOT carry "use server".
 * `notifySpkCreated` previously lived in `server/actions/production.ts`, which is a
 * "use server" module, so it was a browser-callable RPC endpoint with no guard:
 * any authenticated (or even anonymous) client could pass an arbitrary spkId and
 * broadcast a notification to every "Pengawas Lapangan" plus the assigned vendor.
 *
 * Callers are trusted server-side flows only (createSpk in production.ts,
 * auto-SPK generation in master.ts) which already enforce their own role guards.
 */

import { db } from "@/db";
import { spks } from "@/db/schema/production";
import { units, projects } from "@/db/schema/master";
import { vendorProfiles } from "@/db/schema/auth";
import { eq } from "drizzle-orm";
import { createNotification, notifyUsersWithRoles } from "./notification.service";

/**
 * Best-effort notification fan-out for a newly created SPK.
 * Never throws — a notification failure must not roll back SPK creation.
 */
export async function notifySpkCreated(spkId: string, isAuto = false): Promise<void> {
  try {
    const [spkDetails] = await db
      .select({
        spk: spks,
        unit: units,
        project: projects,
      })
      .from(spks)
      .innerJoin(units, eq(spks.unitId, units.id))
      .innerJoin(projects, eq(spks.projectId, projects.id))
      .where(eq(spks.id, spkId))
      .limit(1);

    if (!spkDetails) return;

    const sourceText = isAuto ? "Otomatis" : "Manual";

    // 1. Notify Pengawas Lapangan
    await notifyUsersWithRoles({
      roleNames: ["Pengawas Lapangan"],
      type: "info",
      title: `SPK Baru Diterbitkan (${sourceText})`,
      message: `Surat Perintah Kerja ${spkDetails.spk.spkNumber} untuk pekerjaan "${spkDetails.spk.title}" di kavling ${spkDetails.unit.code} (${spkDetails.project.name}) telah diterbitkan.`,
      entityId: spkId,
      entityType: "spk",
    });

    // 2. Notify Vendor if they have a user account
    if (spkDetails.spk.vendorId) {
      const matchedVendorUser = await db
        .select({ userId: vendorProfiles.userId })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.vendorId, spkDetails.spk.vendorId))
        .limit(1);

      if (matchedVendorUser.length > 0) {
        await createNotification({
          userId: matchedVendorUser[0].userId,
          type: "info",
          title: `SPK Baru Ditugaskan (${sourceText})`,
          message: `Anda mendapat tugas SPK baru ${spkDetails.spk.spkNumber} untuk pekerjaan "${spkDetails.spk.title}" di kavling ${spkDetails.unit.code} (${spkDetails.project.name}).`,
          entityId: spkId,
          entityType: "spk",
        });
      }
    }
  } catch (err) {
    console.error("[Notification] Failed to notify on new SPK:", err);
  }
}
