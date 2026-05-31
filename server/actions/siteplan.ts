"use server";

import { db } from "@/db";
import { siteplans, siteplanShapes, units } from "@/db/schema/master";
import { siteplanSchema, siteplanShapeSchema } from "../validators/siteplan";
import { requireRole } from "../permissions";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createSiteplan(data: unknown) {
  await requireRole("Super Admin");

  const parsed = siteplanSchema.parse(data);
  const id = crypto.randomUUID();

  await db.insert(siteplans).values({
    id,
    ...parsed,
    version: 1,
    isActive: true,
    createdAt: new Date(),
  });

  revalidatePath("/siteplan");
  return { success: true, id };
}

export async function updateSiteplanImage(siteplanId: string, imageUrl: string | null) {
  await requireRole("Super Admin");

  await db.update(siteplans)
    .set({ imageUrl: imageUrl || null })
    .where(eq(siteplans.id, siteplanId));

  revalidatePath(`/siteplan/${siteplanId}`);
  revalidatePath(`/siteplan`);
  return { success: true };
}

export async function saveShape(data: unknown) {
  await requireRole("Super Admin");

  const parsed = siteplanShapeSchema.parse(data);
  const id = crypto.randomUUID();

  await db.insert(siteplanShapes).values({
    id,
    siteplanId: parsed.siteplanId,
    unitId: parsed.unitId,
    shapeType: parsed.shapeType,
    coordinates: parsed.coordinates,
    label: parsed.label,
    colorOverride: parsed.colorOverride,
    createdAt: new Date(),
  });

  revalidatePath(`/siteplan`);
  return { success: true, id };
}

export async function saveMultipleShapes(data: unknown) {
  await requireRole("Super Admin");

  const parsed = z.array(siteplanShapeSchema).parse(data);
  if (parsed.length === 0) {
    return { success: true, count: 0 };
  }

  // Get projectId from siteplan
  const siteplanRows = await db.select().from(siteplans).where(eq(siteplans.id, parsed[0].siteplanId));
  const siteplan = siteplanRows[0];
  if (!siteplan) {
    throw new Error("Siteplan not found");
  }

  // Get existing units to avoid duplicates
  const existingUnits = await db.select().from(units).where(eq(units.projectId, siteplan.projectId));
  const unitMap = new Map(existingUnits.map(u => [u.code, u.id]));

  const valuesToInsert = [];

  for (const shape of parsed) {
    let finalUnitId = shape.unitId ?? null;

    // Automatically map to unit or create a new unit if it has a label but no unitId
    if (!finalUnitId && shape.label) {
      if (unitMap.has(shape.label)) {
        finalUnitId = unitMap.get(shape.label) || null;
      } else {
        const newUnitId = crypto.randomUUID();
        await db.insert(units).values({
          id: newUnitId,
          projectId: siteplan.projectId,
          code: shape.label,
          landArea: 0,
          buildingArea: 0,
          price: 0,
          status: "belum_siap",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        unitMap.set(shape.label, newUnitId);
        finalUnitId = newUnitId;
      }
    }

    valuesToInsert.push({
      id: crypto.randomUUID(),
      siteplanId: shape.siteplanId,
      unitId: finalUnitId,
      shapeType: shape.shapeType,
      coordinates: shape.coordinates,
      label: shape.label ?? null,
      colorOverride: shape.colorOverride ?? null,
      createdAt: new Date(),
    });
  }

  await db.insert(siteplanShapes).values(valuesToInsert);

  revalidatePath(`/siteplan`);
  return { success: true, count: valuesToInsert.length, inserted: valuesToInsert };
}

export async function updateShape(shapeId: string, data: unknown) {
  await requireRole("Super Admin");

  const parsed = siteplanShapeSchema.partial().parse(data);

  await db.update(siteplanShapes)
    .set(parsed)
    .where(eq(siteplanShapes.id, shapeId));

  revalidatePath(`/siteplan`);
  return { success: true };
}

export async function deleteShape(shapeId: string) {
  await requireRole("Super Admin");

  await db.delete(siteplanShapes).where(eq(siteplanShapes.id, shapeId));

  revalidatePath(`/siteplan`);
  return { success: true };
}

export async function deleteSiteplan(siteplanId: string) {
  await requireRole("Super Admin");

  // Fetch siteplan to get projectId for revalidation
  const rows = await db.select().from(siteplans).where(eq(siteplans.id, siteplanId));
  const siteplan = rows[0];
  if (!siteplan) {
    throw new Error("Siteplan tidak ditemukan");
  }

  // Explicitly delete all shapes first to avoid FK constraint failures
  // (SQLite cascade may not always fire reliably on migrated schemas)
  await db.delete(siteplanShapes).where(eq(siteplanShapes.siteplanId, siteplanId));

  // Now delete the siteplan record itself
  await db.delete(siteplans).where(eq(siteplans.id, siteplanId));

  revalidatePath(`/siteplan/${siteplan.projectId}`);
  revalidatePath("/siteplan");
  return { success: true };
}
