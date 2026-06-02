import { z } from "zod";

export const siteplanSchema = z.object({
  projectId: z.string().min(1, "Project wajib dipilih"),
  name: z.string().trim().min(1, "Nama siteplan wajib diisi"),
  width: z.coerce.number().min(100).default(800),
  height: z.coerce.number().min(100).default(600),
  imageUrl: z.string().trim().optional().nullable(),
});
export type SiteplanInput = z.infer<typeof siteplanSchema>;

export const shapeCoordinateSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const siteplanShapeSchema = z.object({
  siteplanId: z.string().min(1),
  unitId: z.string().optional().nullable(),
  shapeType: z.enum(["polygon", "rect", "path"]).default("polygon"),
  coordinates: z.array(shapeCoordinateSchema).min(3, "Polygon butuh minimal 3 titik"),
  label: z.string().trim().optional().nullable(),
  colorOverride: z.string().trim().optional().nullable(),
});
export type SiteplanShapeInput = z.infer<typeof siteplanShapeSchema>;
