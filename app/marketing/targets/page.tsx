import { requireAuth, getSessionRole } from "@/server/permissions"
import { getMarketingTargets } from "@/server/actions/waiting-list"
import { db } from "@/db"
import { projects } from "@/db/schema/master"
import { user as userTable } from "@/db/schema/auth"
import { roles } from "@/db/schema/access"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Target, TrendingUp, TrendingDown, Users, Calendar } from "lucide-react"
import { AddMarketingTargetDialog } from "./add-target-dialog"
import { DeleteConfirm } from "@/components/delete-confirm"
import { deleteMarketingTarget } from "@/server/actions/waiting-list"
import { getI18n } from "@/lib/i18n-server"
import { Translate } from "@/components/translate"

export const revalidate = 0

const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]

export default async function MarketingTargetsPage() {
  const activeUser = await requireAuth()
  const session = await getSessionRole(activeUser.id)
  const { t } = await getI18n()

  const hasAccess = session.isSuperAdmin || session.isAdminKantor || session.isMarketingManager || session.isDireksi
  if (!hasAccess) redirect("/unauthorized")

  const currentYear = new Date().getFullYear()
  const [targets, projectList, marketingUsers] = await Promise.all([
    getMarketingTargets(currentYear),
    db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(projects.name),
    db.select({ id: userTable.id, name: userTable.name, roleId: userTable.roleId, roleName: roles.name })
       .from(userTable)
       .leftJoin(roles, eq(userTable.roleId, roles.id))
       .where(eq(roles.name, "Marketing"))
       .orderBy(userTable.name),
  ])

  const totalTargetUnits  = targets.reduce((s, t) => s + t.targetUnits, 0)
  const totalAchievedUnits = targets.reduce((s, t) => s + t.achievedUnits, 0)
  const totalTargetAmt    = targets.reduce((s, t) => s + t.targetAmount, 0)
  const totalAchievedAmt  = targets.reduce((s, t) => s + t.achievedAmount, 0)
  const achievementPct    = totalTargetUnits > 0 ? Math.round((totalAchievedUnits / totalTargetUnits) * 100) : 0

  const fmtRp = (n: number) => new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(n)
  const fmtRpFull = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#243028] tracking-tight">{t("targets.title")}</h1>
              <p className="text-sm text-[#66736A] mt-0.5">
                <Translate namespace="targets" translationKey="subtitle" values={{ year: currentYear.toString() }} components={{ span: <span className="font-bold" /> }} />
              </p>
            </div>
          </div>
          <AddMarketingTargetDialog projects={projectList} marketings={marketingUsers} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-[#D6DED2] rounded-2xl p-4 shadow-sage flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider">{t("targets.kpi_unit")}</p>
            <h3 className="text-xl font-black font-mono text-[#243028]">{totalTargetUnits}</h3>
          </div>
        </div>
        <div className="bg-card border border-[#D6DED2] rounded-2xl p-4 shadow-sage flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider">{t("targets.kpi_achieved")}</p>
            <h3 className="text-xl font-black font-mono text-[#243028]">{totalAchievedUnits}</h3>
          </div>
        </div>
        <div className="bg-card border border-[#D6DED2] rounded-2xl p-4 shadow-sage flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${achievementPct >= 80 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : achievementPct >= 50 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-rose-500/10 text-rose-500 dark:text-rose-400"}`}>
            {achievementPct >= 80 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider">{t("targets.kpi_pct")}</p>
            <h3 className="text-xl font-black font-mono text-[#243028]">{achievementPct}%</h3>
          </div>
        </div>
        <div className="bg-card border border-[#D6DED2] rounded-2xl p-4 shadow-sage flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider">{t("targets.kpi_team")}</p>
            <h3 className="text-xl font-black font-mono text-[#243028]">{marketingUsers.length}</h3>
          </div>
        </div>
      </div>

      {/* Targets Table */}
      <div className="bg-card border border-[#D6DED2] rounded-2xl overflow-hidden shadow-sage">
        <div className="px-6 py-3.5 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#66736A] uppercase tracking-wider">{t("targets.table_title", { year: currentYear.toString() })}</span>
            <span className="text-xs font-mono text-[#8FAF9A]">{t("targets.entries", { count: targets.length })}</span>
          </div>
        </div>

        {targets.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/60 flex items-center justify-center mx-auto mb-4">
              <Target className="h-8 w-8 text-[#4F6F52]" />
            </div>
            <p className="font-bold text-[#243028]">{t("targets.empty")}</p>
            <p className="text-xs text-[#66736A] mt-1">{t("targets.empty_desc", { year: currentYear.toString() })}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D6DED2] bg-[#F7F8F3]/50">
                  {[t("targets.col_marketing"), t("targets.col_project"), t("targets.col_period"), t("targets.col_target"), t("targets.col_achieved"), t("targets.col_pct"), t("targets.col_amount"), ""].map(h => (
                    <th key={h} className="py-3 px-4 text-xs font-bold text-[#66736A] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {targets.map(target => {
                  const pct = target.targetUnits > 0 ? Math.round((target.achievedUnits / target.targetUnits) * 100) : 0
                  return (
                    <tr key={target.id} className="border-b border-[#D6DED2]/60 hover:bg-[#F7F8F3]/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xs font-black">{target.marketingName?.[0]?.toUpperCase()}</div>
                          <span className="text-sm font-semibold text-[#243028]">{target.marketingName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-[#66736A]">{target.projectName}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-xs font-mono text-[#66736A]">
                          <Calendar className="h-3 w-3 text-[#8FAF9A]" />
                          {MONTHS[target.periodMonth - 1]} {target.periodYear}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm font-bold font-mono text-[#243028] tabular-nums">{target.targetUnits}</td>
                      <td className="py-3 px-4 text-sm font-bold font-mono text-emerald-600 tabular-nums">{target.achievedUnits}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-[60px] h-1.5 bg-[#DDE8D8] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className={`text-xs font-bold font-mono tabular-nums ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-rose-500"}`}>{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-[#66736A]">{fmtRp(target.targetAmount)}</td>
                      <td className="py-3 px-4">
                        {session.isSuperAdmin || session.isAdminKantor || session.isMarketingManager ? (
                          <DeleteConfirm
                            label={t("targets.delete_label", { marketing: target.marketingName || "", month: MONTHS[target.periodMonth-1] })}
                            description={t("targets.delete_desc")}
                            onConfirm={async () => { "use server"; return deleteMarketingTarget(target.id) }}
                          />
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
