import { db } from "@/db"
import { vendors } from "@/db/schema/master"
import { requireAuth, getSessionRole } from "@/server/permissions"
import { redirect } from "next/navigation"
import { VendorForm } from "./vendor-form"
import { deleteVendor } from "@/server/actions/master"
import { DeleteConfirm } from "@/components/delete-confirm"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { VendorInput } from "@/server/validators/master"
import { Store, Users, CheckCircle2, XCircle } from "lucide-react"
import { Translate } from "@/components/translate"
import { SearchInput } from "@/components/ui/search-input"
import { getTableColumns, eq, sql } from "drizzle-orm"
import { user as userTable, vendorProfiles } from "@/db/schema/auth"
import { VendorAccountButton } from "./vendor-account-button"

export const revalidate = 0

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  active:   { label: "Aktif",     className: "bg-[#DDE8D8] text-[#4F6F52] border-[#8FAF9A]/30" },
  inactive: { label: "Nonaktif",  className: "bg-[#E7E9E7] text-[#5F6861] border-[#5F6861]/20" },
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
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

  const hasAccess = isSuperAdmin || isAdminKantor || isKeuangan || isDireksi || isPengawas
  if (!hasAccess) {
    redirect("/unauthorized")
  }

  const { q = "", status = "" } = await searchParams

  const data = await db
    .select({
      ...getTableColumns(vendors),
      hasAccount: sql<number>`CASE WHEN ${vendorProfiles.id} IS NOT NULL THEN 1 ELSE 0 END`,
      accountStatus: userTable.status,
      accountEmail: userTable.email,
    })
    .from(vendors)
    .leftJoin(vendorProfiles, eq(vendorProfiles.vendorId, vendors.id))
    .leftJoin(userTable, eq(userTable.id, vendorProfiles.userId))
    .orderBy(vendors.createdAt)

  const filtered = data.filter((v) => {
    const matchQ = !q || v.name.toLowerCase().includes(q.toLowerCase()) || (v.phone ?? "").includes(q) || (v.email ?? "").toLowerCase().includes(q.toLowerCase())
    const matchStatus = !status || v.status === status
    return matchQ && matchStatus
  })

  // Calculate Metrics
  const totalVendors = data.length
  const activeCount = data.filter((v) => v.status === "active").length
  const inactiveCount = data.filter((v) => v.status === "inactive").length

  return (
    <div className="flex flex-col gap-6">
      
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Store className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#243028] tracking-tight"><Translate namespace="vendor" translationKey="title" /></h1>
              <p className="text-sm text-[#66736A] mt-0.5"><Translate namespace="vendor" translationKey="subtitle" /></p>
            </div>
          </div>
          {isEditor && (
            <div className="self-end md:self-center">
              <VendorForm />
            </div>
          )}
        </div>
      </div>

      {/* ── KPI METRIC CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Vendor */}
        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="vendor" translationKey="total" /></p>
              <h3 className="text-2xl font-black font-mono tracking-tight text-[#243028] tabular-nums">{totalVendors}</h3>
              <p className="text-[10px] text-[#8FAF9A]"><Translate namespace="vendor" translationKey="total_desc" /></p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Aktif */}
        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="vendor" translationKey="active" /></p>
              <h3 className="text-2xl font-black font-mono tracking-tight text-emerald-700 tabular-nums">{activeCount}</h3>
              <p className="text-[10px] text-emerald-500"><Translate namespace="vendor" translationKey="active_desc" /></p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Nonaktif */}
        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="vendor" translationKey="inactive" /></p>
              <h3 className="text-2xl font-black font-mono tracking-tight text-rose-700 tabular-nums">{inactiveCount}</h3>
              <p className="text-[10px] text-rose-500"><Translate namespace="vendor" translationKey="inactive_desc" /></p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="bg-white/70 backdrop-blur-md border border-[#D6DED2] rounded-2xl p-4 shadow-sage">
        <form method="GET" className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <SearchInput
              i18nKey="vendor.search_placeholder"
              name="q"
              defaultValue={q}
            />
            <input type="hidden" name="status" value={status} />
            
            <button type="submit" className="w-full md:w-auto h-10 px-5 bg-[#4F6F52] hover:bg-[#3F5941] text-white rounded-xl shadow-glow-sage hover:scale-[1.02] active:scale-[0.98] transition-all font-semibold text-sm">
              <Translate namespace="action" translationKey="search" />
            </button>

            {(q || status) ? (
              <a
                href="?"
                className="w-full md:w-auto h-10 px-4 flex items-center justify-center text-xs font-semibold rounded-xl border-[#D6DED2] text-[#66736A] hover:bg-[#F7F8F3] transition-colors"
              >
                <Translate namespace="action" translationKey="reset" />
              </a>
            ) : null}
          </div>

          {/* Status Pills */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-[#D6DED2]/40">
            {(["", "active", "inactive"] as const).map((s) => (
              <a
                key={s}
                href={`?q=${q}&status=${s}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 whitespace-nowrap
                  ${status === s || (!status && s === "")
                    ? "bg-[#4F6F52] text-white border-[#4F6F52] shadow-[0_2px_8px_rgba(79,111,82,0.3)]"
                    : "bg-white text-[#66736A] border-[#D6DED2] hover:border-[#8FAF9A] hover:text-[#4F6F52] hover:bg-[#DDE8D8]/30"
                  }`}
              >
                {s === "" ? <Translate namespace="vendor" translationKey="all_status" /> : <Translate namespace="vendor_form" translationKey={`status_${s}` as `vendor_form.status_${string}`} fallback={STATUS_MAP[s]?.label ?? s} />}
              </a>
            ))}
          </div>
        </form>
      </div>

      {/* ── DATA TABLE ── */}
      <div className="bg-white border border-[#D6DED2] rounded-2xl shadow-sage overflow-hidden">
        {/* Table Title Bar */}
        <div className="px-6 py-4 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#66736A] uppercase tracking-wider">
              <Translate namespace="vendor" translationKey="list_title" />
            </span>
            <span className="text-xs font-mono text-[#8FAF9A] tabular-nums">
              <Translate namespace="vendor" translationKey="found" values={{ count: filtered.length.toString() }} />
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center">
                <Store className="h-8 w-8 text-[#8FAF9A]" />
              </div>
              <div>
                <p className="font-semibold text-[#243028] text-sm"><Translate namespace="vendor" translationKey="not_found" /></p>
                <p className="text-xs text-[#66736A] mt-1">
                  {q || status 
                    ? <Translate namespace="vendor" translationKey="not_found_desc_1" />
                    : <Translate namespace="vendor" translationKey="not_found_desc_2" />}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D6DED2] text-[#66736A] text-xs font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-6"><Translate namespace="vendor" translationKey="col_name" /></th>
                  <th className="py-3.5 px-6"><Translate namespace="vendor" translationKey="col_phone" /></th>
                  <th className="py-3.5 px-6"><Translate namespace="vendor" translationKey="col_email" /></th>
                  <th className="py-3.5 px-6"><Translate namespace="vendor" translationKey="col_legal" /></th>
                  <th className="py-3.5 px-6 text-center"><Translate namespace="vendor" translationKey="col_status" /></th>
                  <th className="py-3.5 px-6 text-center">Status Akun</th>
                  {isEditor && <th className="py-3.5 px-6 text-right"><Translate namespace="vendor" translationKey="col_action" /></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DED2]/60 text-sm">
                {filtered.map((v) => {
                  const initials = v.name.slice(0, 2).toUpperCase()
                  const st = STATUS_MAP[v.status]
                  return (
                    <tr key={v.id} className="hover:bg-[#F7F8F3]/80 transition-colors duration-150 group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center font-bold text-xs shrink-0 border border-[#8FAF9A]/20">
                            {initials}
                          </div>
                          <span className="font-semibold text-[#243028] text-sm">{v.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-[#66736A] text-xs">
                        {v.phone || "—"}
                      </td>
                      <td className="py-4 px-6 text-[#66736A]">
                        {v.email || "—"}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-[#66736A]">
                        {v.legalDocNumber || "—"}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge className={`border font-semibold text-xs ${st?.className || "bg-slate-50"} flex items-center justify-center gap-1 w-fit mx-auto rounded-full px-2.5 py-0.5`}>
                          <Translate namespace="vendor_form" translationKey={`status_${v.status}`} fallback={st?.label ?? v.status} />
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {v.hasAccount === 1 ? (
                          v.accountStatus === "active" ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200/50 font-semibold text-xs flex items-center justify-center gap-1 w-fit mx-auto rounded-full px-2.5 py-0.5 border">
                              🟢 Sudah Punya Akun
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200/50 font-semibold text-xs flex items-center justify-center gap-1 w-fit mx-auto rounded-full px-2.5 py-0.5 border">
                              🟡 Akun Nonaktif
                            </Badge>
                          )
                        ) : (
                          <Badge className="bg-slate-50 text-slate-500 border-slate-200 font-semibold text-xs flex items-center justify-center gap-1 w-fit mx-auto rounded-full px-2.5 py-0.5 border">
                            ⚪ Belum Punya Akun
                          </Badge>
                        )}
                      </td>
                      {isEditor && (
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {!v.hasAccount && (
                              <VendorAccountButton vendorId={v.id} hasEmail={!!v.email} />
                            )}
                            <VendorForm
                              id={v.id}
                              initialData={{
                                name: v.name,
                                phone: v.phone || undefined,
                                email: v.email || undefined,
                                address: v.address || undefined,
                                legalDocNumber: v.legalDocNumber || undefined,
                                status: v.status as VendorInput["status"],
                                notes: v.notes || undefined,
                              }}
                            />
                            <DeleteConfirm
                              label={`vendor "${v.name}"`}
                              onConfirm={async () => {
                                "use server"
                                return deleteVendor(v.id)
                              }}
                            />
                          </div>
                        </td>
                      )}
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
