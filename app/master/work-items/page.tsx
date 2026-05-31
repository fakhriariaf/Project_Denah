import { requireAuth, getSessionRole } from "@/server/permissions"
import { getAllWorkItems } from "@/server/actions/production"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, Wrench, Percent } from "lucide-react"
import { WorkItemForm } from "./work-item-form"
import { DeleteConfirm } from "@/components/delete-confirm"
import { deleteWorkItem } from "@/server/actions/production"
import { Translate } from "@/components/translate"

export const revalidate = 0

export default async function WorkItemsPage() {
  const activeUser = await requireAuth()
  const session = await getSessionRole(activeUser.id)

  const hasAccess = session.isSuperAdmin || session.isAdminKantor || session.isDireksi
  if (!hasAccess) redirect("/unauthorized")

  const canManage = session.isSuperAdmin || session.isAdminKantor

  const items = await getAllWorkItems()
  const totalWeight = items.filter(i => i.status === "active").reduce((s, i) => s + i.defaultWeightPct, 0)
  const activeCount = items.filter(i => i.status === "active").length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#243028] tracking-tight"><Translate namespace="work_item" translationKey="title" /></h1>
              <p className="text-sm text-[#66736A] mt-0.5">
                <Translate namespace="work_item" translationKey="subtitle" />
              </p>
            </div>
          </div>
          {canManage && <WorkItemForm items={items} />}
        </div>
      </div>

      {/* Total Weight Indicator */}
      <div className="bg-white border border-[#D6DED2] rounded-2xl p-4 shadow-sage">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-[#4F6F52]" />
            <span className="text-xs font-bold text-[#243028] uppercase tracking-wider"><Translate namespace="work_item" translationKey="total_weight" /></span>
          </div>
          <span className={`text-xs font-bold font-mono tabular-nums px-2 py-0.5 rounded-full ${
            totalWeight === 100 ? "bg-emerald-50 text-emerald-600" :
            totalWeight > 100  ? "bg-rose-50 text-rose-600" :
            "bg-amber-50 text-amber-600"
          }`}>{totalWeight}% / 100%</span>
        </div>
        <div className="h-2 bg-[#DDE8D8] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${totalWeight === 100 ? "bg-emerald-500" : totalWeight > 100 ? "bg-rose-500" : "bg-amber-400"}`}
            style={{ width: `${Math.min(totalWeight, 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-[#66736A] mt-1">
          {totalWeight === 100
            ? <Translate namespace="work_item" translationKey="weight_100" />
            : totalWeight > 100
              ? <Translate namespace="work_item" translationKey="weight_over" />
              : <Translate namespace="work_item" translationKey="weight_under" values={{ current: totalWeight.toString(), remaining: (100 - totalWeight).toString() }} />}
        </p>
      </div>

      {/* Work Items Grid */}
      <div className="bg-white border border-[#D6DED2] rounded-2xl overflow-hidden shadow-sage">
        <div className="px-6 py-3.5 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#66736A] uppercase tracking-wider"><Translate namespace="work_item" translationKey="list_title" /></span>
            <span className="text-xs font-mono text-[#8FAF9A]"><Translate namespace="work_item" translationKey="found" values={{ active: activeCount.toString(), total: items.length.toString() }} /></span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/60 flex items-center justify-center mx-auto mb-4">
              <Wrench className="h-8 w-8 text-[#4F6F52]" />
            </div>
            <p className="font-bold text-[#243028]"><Translate namespace="work_item" translationKey="not_found" /></p>
            <p className="text-xs text-[#66736A] mt-1"><Translate namespace="work_item" translationKey="not_found_desc" /></p>
          </div>
        ) : (
          <div className="divide-y divide-[#D6DED2]/60">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#F7F8F3]/60 transition-colors">
                {/* Code */}
                <div className="shrink-0 min-w-[70px]">
                  <span className="font-mono text-xs font-bold text-[#4F6F52] bg-[#DDE8D8] px-2 py-1 rounded-lg">{item.code}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#243028] text-sm">{item.name}</p>
                    <Badge className={`border text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${item.status === "active" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                      {item.status === "active"
                        ? <><CheckCircle2 className="h-3 w-3" /><Translate namespace="work_item" translationKey="status_active" /></>
                        : <><XCircle className="h-3 w-3" /><Translate namespace="work_item" translationKey="status_inactive" /></>}
                    </Badge>
                  </div>
                  {item.description && <p className="text-xs text-[#66736A] mt-0.5">{item.description}</p>}
                </div>

                {/* Weight */}
                <div className="shrink-0 text-right">
                  <div className="text-lg font-black font-mono text-[#243028] tabular-nums">{item.defaultWeightPct}%</div>
                  <p className="text-[10px] text-[#8FAF9A]"><Translate namespace="work_item" translationKey="default_weight" /></p>
                </div>

                {/* Actions */}
                {canManage && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <WorkItemForm
                      id={item.id}
                      initialData={{
                        code: item.code,
                        name: item.name,
                        description: item.description ?? undefined,
                        defaultWeightPct: item.defaultWeightPct,
                        status: item.status as "active" | "inactive",
                      }}
                      items={items}
                    />
                    <DeleteConfirm
                      label={`item "${item.name}"`}
                      description={<Translate namespace="work_item" translationKey="delete_desc" />}
                      onConfirm={async () => {
                        "use server"
                        return deleteWorkItem(item.id)
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
