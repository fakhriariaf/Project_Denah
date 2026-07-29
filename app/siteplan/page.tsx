import { db } from "@/db"
import { projects, siteplans } from "@/db/schema/master"
import { requireAuth } from "@/server/permissions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { eq, count } from "drizzle-orm"
import { MapPin, Layers, Building2 } from "lucide-react"
import { Translate } from "@/components/translate"
import { ProjectStatusGate } from "./project-status-gate"
import { getProjectStatusLabel } from "@/lib/label-helpers"

export default async function SiteplanPage() {
  await requireAuth()

  // Tampilkan SEMUA proyek — aktif, non-aktif, maupun selesai
  const projectList = await db
    .select({
      project: projects,
      siteplanCount: count(siteplans.id),
    })
    .from(projects)
    .leftJoin(siteplans, eq(siteplans.projectId, projects.id))
    .groupBy(projects.id)
    .orderBy(projects.createdAt)

  // Stats
  const totalProjects = projectList.length
  const totalSiteplans = projectList.reduce((sum, item) => sum + item.siteplanCount, 0)
  const activeProjects = projectList.filter(item => item.project.status === "active").length
  const withSiteplan = projectList.filter(item => item.siteplanCount > 0).length

  return (
    <div className="flex flex-col gap-6 p-1 sm:p-2">
      {/* Premium Header Banner with Mesh Gradient */}
      <div className="relative overflow-hidden rounded-3xl border border-[#D6DED2] bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#F7F8F3] p-6 shadow-sage">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#8FAF9A]/10 blur-2xl" />
        <div className="absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-[#4F6F52]/5 blur-2xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1.5">
            <Badge className="bg-[#4F6F52] hover:bg-[#4F6F52]/90 text-white font-mono tracking-widest text-[9px] uppercase px-2.5 py-0.5 rounded-full shadow-sm">
              ERP SITEPLAN HUB
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#243028] font-sans">
              <Translate id="siteplan.title" />
            </h2>
            <p className="text-xs sm:text-sm text-[#66736A] font-medium leading-relaxed max-w-xl">
              <Translate id="siteplan.subtitle" />
            </p>
          </div>

          {/* Quick Stats Panel */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-[#D6DED2]/60 shrink-0">
            <div className="px-3 py-1 border-r border-[#D6DED2]/50 text-center sm:text-left">
              <span className="text-[9px] font-bold text-[#66736A] uppercase block">Total Proyek</span>
              <span className="font-mono text-base sm:text-lg font-extrabold text-[#4F6F52]">{totalProjects}</span>
            </div>
            <div className="px-3 py-1 border-r border-[#D6DED2]/50 text-center sm:text-left">
              <span className="text-[9px] font-bold text-[#66736A] uppercase block">Aktif</span>
              <span className="font-mono text-base sm:text-lg font-extrabold text-[#4F6F52]">{activeProjects}</span>
            </div>
            <div className="px-3 py-1 text-center sm:text-left">
              <span className="text-[9px] font-bold text-[#66736A] uppercase block">Punya Siteplan</span>
              <span className="font-mono text-base sm:text-lg font-extrabold text-[#4F6F52]">{withSiteplan}</span>
            </div>
          </div>
        </div>
      </div>

      {projectList.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-[#D6DED2] rounded-3xl bg-white/50 backdrop-blur-sm p-8 max-w-md mx-auto mt-6">
          <div className="h-12 w-12 rounded-2xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-[#243028] text-base mb-1"><Translate id="siteplan.no_projects" /></h3>
          <p className="text-xs text-[#66736A] leading-relaxed mb-6">
            <Translate id="siteplan.no_projects_desc" />
          </p>
          <Button size="sm" className="bg-[#4F6F52] hover:bg-[#4F6F52]/90 text-white font-bold rounded-xl btn-premium" nativeButton={false} render={
            <Link href="/master/projects">
              <Translate id="siteplan.create_project" />
            </Link>
          } />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projectList.map(({ project: p, siteplanCount }) => {
            const hasSiteplan = siteplanCount > 0
            return (
              <Card 
                key={p.id} 
                className="group relative overflow-hidden backdrop-blur-md bg-white/90 border-[#D6DED2] hover:border-[#8FAF9A]/60 shadow-sage hover:shadow-sage-lg rounded-2xl transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between"
              >
                {/* Decorative border highlight on hover */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#8FAF9A] to-[#4F6F52] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                
                <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg font-bold text-[#243028] truncate group-hover:text-[#4F6F52] transition-colors duration-200">
                        {p.name}
                      </CardTitle>
                      <CardDescription className="font-mono text-[10px] font-semibold text-[#8FAF9A] uppercase tracking-wider block flex gap-1">
                        <Translate id="siteplan.code_prefix" /> {p.code}
                      </CardDescription>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[9px] font-extrabold rounded-lg px-2 py-0.5 border shrink-0 ${
                        p.status === "active"
                          ? "bg-[#DDE8D8] text-[#4F6F52] border-[#8FAF9A]/30"
                          : p.status === "completed"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {getProjectStatusLabel(p.status)}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="px-5 pb-5 pt-0 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Location element with custom layout */}
                    <div className="flex items-start gap-2 bg-[#F7F8F3]/60 p-2.5 rounded-xl border border-[#D6DED2]/40 text-xs text-[#66736A] font-semibold">
                      <MapPin className="h-4 w-4 text-[#4F6F52] shrink-0 mt-0.5 group-hover:animate-bounce" />
                      <span className="truncate leading-normal">{p.location || <Translate id="siteplan.location_empty" />}</span>
                    </div>

                    {/* Dynamic siteplan progress indicators */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-extrabold text-[#66736A]">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5 text-[#8FAF9A]" />
                          <Translate id="siteplan.integration_status" />
                        </span>
                        <span className={hasSiteplan ? "text-[#4F6F52] font-mono" : "text-amber-600 font-mono"}>
                          {hasSiteplan ? <>{siteplanCount} <Translate id="siteplan.active_siteplan" /></> : <Translate id="siteplan.no_siteplan" />}
                        </span>
                      </div>
                      
                      {/* Interactive Visual Progress Bar */}
                      <div className="h-2 w-full bg-[#E7E9E7] rounded-full overflow-hidden border border-[#D6DED2]/30 shadow-inner">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${hasSiteplan ? "bg-[#4F6F52] w-full" : "bg-amber-500 w-[15%]"}`} 
                        />
                      </div>

                      <div className="flex justify-between items-center text-[9px] font-semibold text-[#8FAF9A] pt-0.5">
                        <span><Translate id="siteplan.mapping_status" /></span>
                        <span className="font-bold">{hasSiteplan ? <Translate id="siteplan.mapped_full" /> : <Translate id="siteplan.mapped_draft" />}</span>
                      </div>
                    </div>
                  </div>

                  {/* Call-to-action button — perilaku berbeda per status */}
                  <div className="pt-5 mt-auto border-t border-[#D6DED2]/40 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-[#8FAF9A] font-mono">
                      {p.status === "active"
                        ? (hasSiteplan ? <Translate id="siteplan.ready_market" /> : <Translate id="siteplan.need_siteplan" />)
                        : p.status === "completed"
                        ? "Proyek telah selesai · View Only"
                        : "Proyek tidak aktif · Hubungi Admin"
                      }
                    </span>
                    <ProjectStatusGate
                      projectId={p.id}
                      projectName={p.name}
                      status={p.status as "active" | "inactive" | "completed"}
                      hasSiteplan={hasSiteplan}
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
