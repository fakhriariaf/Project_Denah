import { requireAuth, getSessionRole } from "@/server/permissions"
import { getWaitingList } from "@/server/actions/waiting-list"
import { db } from "@/db"
import { projects, customers } from "@/db/schema/master"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format-utils"
import {
  Clock, CheckCircle2, XCircle, Tag, Building2,
  Phone, ListFilter,
} from "lucide-react"
import { WaitingListActions } from "./waiting-list-actions"
import { AddToWaitingListDialog } from "./add-waiting-list-dialog"
import { Translate } from "@/components/translate"
import { DataTablePagination } from "@/components/ui/data-table-pagination"

export const revalidate = 0

const STATUS_CONFIG: Record<string, { labelKey: string; className: string; icon: React.ElementType }> = {
  waiting:   { labelKey: "status_waiting",   className: "bg-amber-500/10 border-amber-500/30 text-amber-600",   icon: Clock },
  offered:   { labelKey: "status_offered",   className: "bg-sky-500/10 border-sky-500/30 text-sky-600",           icon: Tag },
  converted: { labelKey: "status_converted", className: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600", icon: CheckCircle2 },
  cancelled: { labelKey: "status_cancelled", className: "bg-muted border-border text-muted-foreground",                             icon: XCircle },
}

const KPI_KEYS = ["kpi_total", "kpi_waiting", "kpi_offered", "kpi_converted"] as const

export default async function WaitingListPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const { page } = searchParams ? await searchParams : { page: undefined };
  const currentPage = Number(page) || 1;
  const itemsPerPage = 20;
  const activeUser = await requireAuth()
  const session = await getSessionRole(activeUser.id)

  const hasAccess = session.isSuperAdmin || session.isAdminKantor || session.isMarketing || session.isMarketingManager || session.isDireksi
  if (!hasAccess) redirect("/unauthorized")

  const [waitList, projectList, customerList] = await Promise.all([
    getWaitingList(),
    db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(projects.name),
    db.select({ id: customers.id, name: customers.name, phone: customers.phone }).from(customers).orderBy(customers.name),
  ])

  const activeCount    = waitList.filter(w => w.status === "waiting").length
  const offeredCount   = waitList.filter(w => w.status === "offered").length
  const convertedCount = waitList.filter(w => w.status === "converted").length

  const totalFilteredItems = waitList.length;
  const paginatedList = waitList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const kpiValues = [waitList.length, activeCount, offeredCount, convertedCount]
  const kpiIcons  = [ListFilter, Clock, Tag, CheckCircle2]
  const kpiColors = [
    "bg-secondary text-primary",
    "bg-amber-500/10 text-amber-600",
    "bg-sky-500/10 text-sky-600",
    "bg-emerald-500/10 text-emerald-600",
  ]

  const formatRupiah = (n: number | null | undefined) => n
    ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)
    : "—"

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-border shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">
                <Translate namespace="waiting" translationKey="title" />
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                <Translate namespace="waiting" translationKey="subtitle" />
              </p>
            </div>
          </div>
          <AddToWaitingListDialog projects={projectList} customers={customerList} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {KPI_KEYS.map((key, i) => {
          const Icon = kpiIcons[i]
          return (
            <div key={key} className="bg-card border border-border rounded-2xl p-5 shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium flex items-center gap-4">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${kpiColors[i]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  <Translate namespace="waiting" translationKey={key} />
                </p>
                <h3 className="text-2xl font-black font-mono text-foreground tabular-nums">{kpiValues[i]}</h3>
              </div>
            </div>
          )
        })}
      </div>

      {/* Waiting List Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sage">
        <div className="px-6 py-3.5 border-b border-border bg-muted/30/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <Translate namespace="waiting" translationKey="list_title" />
            </span>
            <span className="text-xs font-mono text-primary/70 tabular-nums">
              <Translate namespace="waiting" translationKey="entries" values={{ count: waitList.length.toString() }} />
            </span>
          </div>
        </div>

        {waitList.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <p className="font-bold text-foreground"><Translate namespace="waiting" translationKey="empty" /></p>
            <p className="text-xs text-muted-foreground mt-1"><Translate namespace="waiting" translationKey="empty_desc" /></p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-[#D6DED2]/60">
              {paginatedList.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status]
              const StatusIcon = statusCfg.icon
              return (
                <div key={item.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30/60 transition-colors">
                  {/* Priority badge */}
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-black text-amber-600 font-mono">#{item.priority}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-foreground text-sm">{item.customerName}</p>
                      <Badge className={`border text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${statusCfg.className}`}>
                        <StatusIcon className="h-3 w-3" />
                        <Translate namespace="waiting" translationKey={statusCfg.labelKey as any} />
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 text-primary/70" />
                        {item.projectName}
                      </span>
                      {item.customerPhone && (
                        <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                          <Phone className="h-3 w-3 text-primary/70" />
                          {item.customerPhone}
                        </span>
                      )}
                      {item.preferredType && (
                        <span className="text-xs text-muted-foreground">
                          <Translate namespace="waiting" translationKey="pref_type" /> <strong>{item.preferredType}</strong>
                        </span>
                      )}
                      {(item.budgetMin || item.budgetMax) && (
                        <span className="text-xs text-muted-foreground">
                          <Translate namespace="waiting" translationKey="budget" />{" "}
                          {formatRupiah(item.budgetMin)}{" "}
                          <Translate namespace="waiting" translationKey="budget_separator" />{" "}
                          {formatRupiah(item.budgetMax)}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/70 font-mono">{formatDate(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <WaitingListActions
                    id={item.id}
                    currentStatus={item.status}
                    canManage={session.isSuperAdmin || session.isAdminKantor || session.isMarketing || session.isMarketingManager}
                  />
                </div>
              )
            })}
            </div>
            <DataTablePagination totalItems={totalFilteredItems} itemsPerPage={itemsPerPage} />
          </>
        )}
      </div>
    </div>
  )
}
