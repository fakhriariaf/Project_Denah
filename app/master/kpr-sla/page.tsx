import { db } from "@/db"
import { projects } from "@/db/schema/master"
import { requireAuth, getSessionRole } from "@/server/permissions"
import { redirect } from "next/navigation"
import { getKprSlaConfigs } from "@/server/actions/kpr-sla"
import type { KprSlaConfigRow } from "@/server/services/kpr-sla/queries"
import { KprSlaShell, type SlaConfig } from "./kpr-sla-shell"

const MASTER_SLA_LOAD_ERROR =
  "Sistem tetap menggunakan SLA legacy. Coba lagi atau hubungi administrator."

export const revalidate = 0

/**
 * Serialize a query-layer config row (Date fields) into the client-safe
 * shape expected by KprSlaShell (ISO string timestamps).
 */
function serializeConfig(row: KprSlaConfigRow): SlaConfig {
  return {
    id: row.id,
    scope: row.scope,
    projectId: row.projectId,
    stage: row.stage,
    workingDays: row.workingDays,
    isActive: row.isActive,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: row.updatedByName,
    projectName: row.projectName,
  }
}

export default async function KprSlaPage() {
  const activeUser = await requireAuth()
  const session = await getSessionRole(activeUser.id)

  // Same access as /marketing/kpr
  const hasAccess =
    session.isSuperAdmin ||
    session.isAdminKantor ||
    session.isMarketingManager ||
    session.isMarketing ||
    session.isDireksi
  if (!hasAccess) redirect("/unauthorized")

  // Fetch project list for perumahan dropdown
  const projectList = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name)

  // Fetch SLA configs and serialize Date fields for the client shell.
  let configs: SlaConfig[] = []
  let fetchError: string | null = null
  try {
    const result = await getKprSlaConfigs()
    if (result.success && result.data) {
      configs = result.data.map(serializeConfig)
    } else {
      fetchError = result.error ?? MASTER_SLA_LOAD_ERROR
    }
  } catch {
    fetchError = MASTER_SLA_LOAD_ERROR
  }

  return (
    <KprSlaShell
      configs={configs}
      projectList={projectList}
      isSuperAdmin={session.isSuperAdmin}
      fetchError={fetchError}
    />
  )
}
