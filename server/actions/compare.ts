"use server";

import { db } from "@/db";
import { projects, units } from "@/db/schema/master";
import { bookings } from "@/db/schema/marketing";
import { payments } from "@/db/schema/finance";
import { spks } from "@/db/schema/production";
import { requireAnyRole } from "@/server/permissions";
import { eq, and, inArray, count, sum, avg, sql } from "drizzle-orm";

export interface ProjectComparisonMetrics {
  projectId: string;
  projectName: string;
  // Sales metrics
  totalUnits: number;
  unitsSold: number;
  unitsBooked: number;
  unitsAvailable: number;
  salesVelocity: number;
  // Revenue metrics
  totalRevenue: number;
  potentialRevenue: number;
  avgUnitPrice: number;
  // Construction metrics
  avgConstructionProgress: number;
  spksActive: number;
  spksCompleted: number;
  // Booking metrics
  activeBookings: number;
  cancelledBookings: number;
  completedBookings: number;
}

export async function getProjectsList(): Promise<{ id: string; name: string }[]> {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Direksi / Manager"]);

  const result = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name);

  return result;
}

export async function getProjectComparisonData(
  projectIds: string[]
): Promise<ProjectComparisonMetrics[]> {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Direksi / Manager"]);

  if (!projectIds || projectIds.length === 0) return [];
  // Max 4 projects
  const ids = projectIds.slice(0, 4);

  const metrics: ProjectComparisonMetrics[] = [];

  for (const projectId of ids) {
    // Get project name
    const [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) continue;

    // Unit metrics
    const unitRows = await db
      .select({ status: units.status, price: units.price })
      .from(units)
      .where(eq(units.projectId, projectId));

    const totalUnits = unitRows.length;
    const unitsSold = unitRows.filter(
      (u) => u.status === "sold" || u.status === "handover_complete"
    ).length;
    const unitsBooked = unitRows.filter(
      (u) =>
        u.status === "booking" ||
        u.status === "kpr_process" ||
        u.status === "payment_pending"
    ).length;
    const unitsAvailable = unitRows.filter(
      (u) => u.status === "available"
    ).length;

    const potentialRevenue = unitRows.reduce((acc, u) => acc + (u.price || 0), 0);
    const avgUnitPrice = totalUnits > 0 ? potentialRevenue / totalUnits : 0;

    // Sales velocity: units sold / months since first booking
    let salesVelocity = 0;
    const [firstBooking] = await db
      .select({ minDate: sql<string>`MIN(${bookings.bookingDate})` })
      .from(bookings)
      .where(eq(bookings.projectId, projectId));

    if (firstBooking?.minDate && unitsSold > 0) {
      const firstDate = new Date(firstBooking.minDate);
      const now = new Date();
      const monthsDiff =
        (now.getFullYear() - firstDate.getFullYear()) * 12 +
        (now.getMonth() - firstDate.getMonth());
      const months = Math.max(monthsDiff, 1);
      salesVelocity = parseFloat((unitsSold / months).toFixed(2));
    }

    // Revenue: sum of verified payments
    const [revenueResult] = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(
        and(eq(payments.projectId, projectId), eq(payments.status, "verified"))
      );
    const totalRevenue = parseFloat(revenueResult?.total || "0");

    // Construction metrics
    const spkRows = await db
      .select({ status: spks.status, progressPct: spks.progressPct })
      .from(spks)
      .where(eq(spks.projectId, projectId));

    const activeSpkStatuses = ["active", "proses_konstruksi", "draft"];
    const spksActive = spkRows.filter((s) =>
      activeSpkStatuses.includes(s.status!)
    ).length;
    const spksCompleted = spkRows.filter(
      (s) => s.status === "completed" || s.status === "selesai_konstruksi"
    ).length;

    const activeSpks = spkRows.filter((s) =>
      activeSpkStatuses.includes(s.status!)
    );
    const avgConstructionProgress =
      activeSpks.length > 0
        ? Math.round(
            activeSpks.reduce((acc, s) => acc + (s.progressPct || 0), 0) /
              activeSpks.length
          )
        : 0;

    // Booking metrics
    const bookingRows = await db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.projectId, projectId));

    const activeBookings = bookingRows.filter(
      (b) => b.status === "active"
    ).length;
    const cancelledBookings = bookingRows.filter(
      (b) => b.status === "cancelled"
    ).length;
    const completedBookings = bookingRows.filter(
      (b) => b.status === "completed" || b.status === "akad"
    ).length;

    metrics.push({
      projectId,
      projectName: project.name,
      totalUnits,
      unitsSold,
      unitsBooked,
      unitsAvailable,
      salesVelocity,
      totalRevenue,
      potentialRevenue,
      avgUnitPrice,
      avgConstructionProgress,
      spksActive,
      spksCompleted,
      activeBookings,
      cancelledBookings,
      completedBookings,
    });
  }

  return metrics;
}
