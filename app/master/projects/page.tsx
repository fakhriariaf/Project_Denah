import { db } from "@/db"
import { projects, units } from "@/db/schema/master"
import { requireAuth, getSessionRole } from "@/server/permissions"
import { redirect } from "next/navigation"
import { ProjectsShell } from "./projects-shell"

export default async function ProjectsPage() {
  const activeUser = await requireAuth()
  const {
    isSuperAdmin,
    isAdminKantor,
    isMarketing,
    isKeuangan,
    isDireksi,
    isPengawas,
    isViewer,
    isEditor,
  } = await getSessionRole(activeUser.id)

  const hasAccess = isSuperAdmin || isAdminKantor || isMarketing || isKeuangan || isDireksi || isPengawas || isViewer
  if (!hasAccess) {
    redirect("/unauthorized")
  }

  const data = await db.select().from(projects).orderBy(projects.createdAt)
  const allUnits = await db.select({
    projectId: units.projectId,
    status: units.status,
  }).from(units)

  return (
    <ProjectsShell
      initialProjects={data}
      allUnits={allUnits}
      isEditor={isEditor}
    />
  )
}
