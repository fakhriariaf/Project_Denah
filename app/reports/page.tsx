import { db } from "@/db";
import { projects as projectsTable } from "@/db/schema/master";
import { requireAuth } from "@/server/permissions";
import ReportsShell from "./reports-shell";
import { getFinancialReport } from "@/server/actions/finance";

export const revalidate = 0;

export default async function ReportsPage() {
  await requireAuth();

  // Fetch all projects to let users switch reports
  const projectsList = await db.select().from(projectsTable);

  // Prefetch 'all' projects report by default
  const initialReport = await getFinancialReport("all");

  return (
    <ReportsShell
      projects={projectsList}
      initialReport={initialReport}
    />
  );
}
