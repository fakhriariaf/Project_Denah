"use server";

import { db } from "@/db";
import { projects, siteplans, siteplanShapes, units } from "@/db/schema/master";
import { eq, and } from "drizzle-orm";
import {
  mapUnitStatusToPublicStatus,
  getPublicStatusColor,
  PublicSiteplanData,
  PublicSiteplanShape,
} from "@/lib/public-siteplan-utils";

export async function getPublicSiteplanData(projectId?: string): Promise<PublicSiteplanData> {
  try {
    // 1. Fetch all active + publicEnabled projects for the dropdown selector
    const activePublicProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        code: projects.code,
        isFeaturedPublic: projects.isFeaturedPublic,
      })
      .from(projects)
      .where(and(eq(projects.status, "active"), eq(projects.publicEnabled, true)));

    if (activePublicProjects.length === 0) {
      return {
        project: null,
        siteplan: null,
        shapes: [],
        projects: [],
      };
    }

    // 2. Select target project
    let targetProject = null;

    if (projectId) {
      targetProject = activePublicProjects.find((p) => p.id === projectId) || null;
    }

    if (!targetProject) {
      // Find featured project first
      targetProject = activePublicProjects.find((p) => p.isFeaturedPublic) || null;

      if (!targetProject) {
        // Find project with the most units
        // Query unit counts per active public project
        const unitCounts = await Promise.all(
          activePublicProjects.map(async (proj) => {
            const result = await db
              .select({ id: units.id })
              .from(units)
              .where(eq(units.projectId, proj.id));
            return { projectId: proj.id, count: result.length };
          })
        );

        // Sort by count descending
        unitCounts.sort((a, b) => b.count - a.count);
        const topProjectId = unitCounts[0]?.projectId;

        targetProject = activePublicProjects.find((p) => p.id === topProjectId) || activePublicProjects[0];
      }
    }

    // 3. Fetch active public siteplan for target project
    const activeSiteplans = await db
      .select({
        id: siteplans.id,
        projectId: siteplans.projectId,
        name: siteplans.name,
        imageUrl: siteplans.imageUrl,
        svgData: siteplans.svgData,
        width: siteplans.width,
        height: siteplans.height,
      })
      .from(siteplans)
      .where(
        and(
          eq(siteplans.projectId, targetProject.id),
          eq(siteplans.isActive, true),
          eq(siteplans.publicEnabled, true)
        )
      );

    const targetSiteplan = activeSiteplans[0] || null;

    if (!targetSiteplan) {
      return {
        project: {
          id: targetProject.id,
          name: targetProject.name,
          code: targetProject.code,
        },
        siteplan: null,
        shapes: [],
        projects: activePublicProjects.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
        })),
      };
    }

    // 4. Fetch shapes and sanitized unit details for target siteplan
    // EXPLICIT SELECT: DO NOT SELECT price, customer ID, booking ID, notes internal etc.
    const shapesRows = await db
      .select({
        id: siteplanShapes.id,
        siteplanId: siteplanShapes.siteplanId,
        unitId: siteplanShapes.unitId,
        shapeType: siteplanShapes.shapeType,
        coordinates: siteplanShapes.coordinates,
        label: siteplanShapes.label,
        colorOverride: siteplanShapes.colorOverride,
        unitIdField: units.id,
        unitCode: units.code,
        unitCluster: units.cluster,
        unitTypeName: units.typeName,
        unitLandArea: units.landArea,
        unitBuildingArea: units.buildingArea,
        unitStatus: units.status,
        unitConstructionProgress: units.constructionProgress,
      })
      .from(siteplanShapes)
      .leftJoin(units, eq(siteplanShapes.unitId, units.id))
      .where(eq(siteplanShapes.siteplanId, targetSiteplan.id));

    const shapes: PublicSiteplanShape[] = shapesRows.map((row) => {
      let unitData = null;
      if (row.unitIdField) {
        const publicStatus = mapUnitStatusToPublicStatus(row.unitStatus, row.unitConstructionProgress ?? 0);
        const publicColors = getPublicStatusColor(publicStatus);
        unitData = {
          code: row.unitCode || "",
          cluster: row.unitCluster,
          typeName: row.unitTypeName,
          landArea: row.unitLandArea ?? 0,
          buildingArea: row.unitBuildingArea ?? 0,
          status: row.unitStatus || "available",
          constructionProgress: row.unitConstructionProgress ?? 0,
          publicStatus,
          publicColors: {
            fill: publicColors.fill,
            stroke: publicColors.stroke,
            text: publicColors.text,
            dot: publicColors.dot,
          },
        };
      }

      return {
        id: row.id,
        siteplanId: row.siteplanId,
        unitId: row.unitId,
        shapeType: row.shapeType as "polygon" | "rect" | "path",
        coordinates: row.coordinates,
        label: row.label,
        colorOverride: row.colorOverride,
        unit: unitData,
      };
    });

    return {
      project: {
        id: targetProject.id,
        name: targetProject.name,
        code: targetProject.code,
      },
      siteplan: {
        id: targetSiteplan.id,
        name: targetSiteplan.name,
        imageUrl: targetSiteplan.imageUrl,
        svgData: targetSiteplan.svgData,
        width: targetSiteplan.width,
        height: targetSiteplan.height,
      },
      shapes,
      projects: activePublicProjects.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
      })),
    };
  } catch (error) {
    console.error("Error fetching public siteplan data:", error);
    return {
      project: null,
      siteplan: null,
      shapes: [],
      projects: [],
    };
  }
}
