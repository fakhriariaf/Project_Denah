import { db } from "@/db"
import { units, projects, vendors } from "@/db/schema/master"
import { requireAuth, getSessionRole } from "@/server/permissions"
import { redirect } from "next/navigation"
import { UnitForm } from "./unit-form"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { eq } from "drizzle-orm"
import { UnitFilters } from "./unit-filters"
import { Building2, Sparkles, CircleDollarSign, Hammer } from "lucide-react"
import { UNIT_STATUS_BADGE } from "@/lib/siteplan-utils"
import { UnitTable } from "./unit-table"
import { Translate } from "@/components/translate"

export const revalidate = 0


export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; projectId?: string; page?: string }>
}) {
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

  const { q, status, projectId, page } = await searchParams
  const currentPage = Number(page) || 1
  const itemsPerPage = 20

  const data = await db
    .select({ unit: units, projectName: projects.name })
    .from(units)
    .leftJoin(projects, eq(units.projectId, projects.id))
    .orderBy(units.code)

  const filtered = data.filter(({ unit }) => {
    const matchQ = !q || unit.code.toLowerCase().includes(q.toLowerCase()) || (unit.cluster && unit.cluster.toLowerCase().includes(q.toLowerCase()))
    const matchStatus = !status || unit.status === status
    const matchProject = !projectId || unit.projectId === projectId
    return matchQ && matchStatus && matchProject
  })

  const totalFilteredItems = filtered.length
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const availableProjects = await db.select().from(projects).orderBy(projects.name)
  const availableVendors = await db.select().from(vendors).where(eq(vendors.status, "active")).orderBy(vendors.name)

  // Calculate Metrics
  const totalUnits = data.length
  const availableCount = data.filter(({ unit }) => unit.status === "available").length
  const soldCount = data.filter(({ unit }) => unit.status === "sold").length
  const constructionCount = data.filter(
    ({ unit }) => unit.status === "construction" || unit.status === "construction_done"
  ).length

  return (
    <div className="flex flex-col gap-6">
      
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#243028] tracking-tight"><Translate id="unit.title" /></h1>
              <p className="text-sm text-[#66736A] mt-0.5"><Translate id="unit.subtitle" /></p>
            </div>
          </div>
          {isEditor && (
            <div className="self-end md:self-center">
              <UnitForm projects={availableProjects} vendors={availableVendors} />
            </div>
          )}
        </div>
      </div>

      {/* ── KPI METRIC CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Unit */}
        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate id="unit.total" /></p>
              <h3 className="text-2xl font-black font-mono tracking-tight text-[#243028] tabular-nums">{totalUnits}</h3>
              <p className="text-[10px] text-[#8FAF9A]"><Translate id="unit.total_desc" /></p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Unit Tersedia */}
        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate id="unit.available" /></p>
              <h3 className="text-2xl font-black font-mono tracking-tight text-emerald-700 tabular-nums">{availableCount}</h3>
              <p className="text-[10px] text-emerald-500"><Translate id="unit.available_desc" /></p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Terjual */}
        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate id="unit.sold" /></p>
              <h3 className="text-2xl font-black font-mono tracking-tight text-rose-700 tabular-nums">{soldCount}</h3>
              <p className="text-[10px] text-rose-500"><Translate id="unit.sold_desc" /></p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <CircleDollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Proses Bangun */}
        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate id="unit.construction" /></p>
              <h3 className="text-2xl font-black font-mono tracking-tight text-[#4F6F52] tabular-nums">{constructionCount}</h3>
              <p className="text-[10px] text-[#8FAF9A]"><Translate id="unit.construction_desc" /></p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Hammer className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <UnitFilters projects={availableProjects} statusMap={UNIT_STATUS_BADGE} />

      {/* ── DATA TABLE WITH BULK DELETE CHECKBOXES ── */}
      <UnitTable
        paginated={paginated}
        totalFilteredItems={totalFilteredItems}
        itemsPerPage={itemsPerPage}
        isEditor={isEditor}
        availableProjects={availableProjects}
        availableVendors={availableVendors}
      />
    </div>
  )
}
