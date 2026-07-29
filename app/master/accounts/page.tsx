import { db } from "@/db"
import { financeAccounts } from "@/db/schema/master"
import { transactions } from "@/db/schema/finance"
import { requireAuth, getSessionRole } from "@/server/permissions"
import { redirect } from "next/navigation"
import { eq, sql } from "drizzle-orm"
import { FinanceAccountForm } from "./account-form"
import { deleteFinanceAccount } from "@/server/actions/master"
import { DeleteConfirm } from "@/components/delete-confirm"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Landmark, Wallet, CreditCard, TrendingUp, TrendingDown, AlertCircle,
  CheckCircle2, XCircle, DollarSign,
} from "lucide-react"
import { SearchInput } from "@/components/ui/search-input"
import type { FinanceAccountInput } from "@/server/validators/master"
import { Translate } from "@/components/translate"
import { getAccountStatusLabel, getAccountTypeLabel } from "@/lib/label-helpers"

export const revalidate = 0

const TYPE_CONFIG: Record<string, { labelKey: string; icon: React.ElementType; iconBg: string; iconText: string }> = {
  cash:       { labelKey: "type_cash",       icon: Wallet,      iconBg: "bg-emerald-50",  iconText: "text-emerald-600" },
  bank:       { labelKey: "type_bank",       icon: Landmark,    iconBg: "bg-[#DDE8D8]",   iconText: "text-[#4F6F52]" },
  receivable: { labelKey: "type_receivable", icon: TrendingUp,  iconBg: "bg-sky-50",      iconText: "text-sky-600" },
  payable:    { labelKey: "type_payable",    icon: TrendingDown,iconBg: "bg-rose-50",     iconText: "text-rose-600" },
  income:     { labelKey: "type_income",     icon: DollarSign,  iconBg: "bg-amber-50",    iconText: "text-amber-600" },
  expense:    { labelKey: "type_expense",    icon: CreditCard,  iconBg: "bg-purple-50",   iconText: "text-purple-600" },
}

const STATUS_MAP = {
  active:   { label: "Aktif",     className: "bg-[#DDE8D8] text-[#4F6F52] border-[#8FAF9A]/30" },
  inactive: { label: "Nonaktif", className: "bg-[#E7E9E7] text-[#5F6861] border-[#5F6861]/20" },
}

function formatRp(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount)
}

export default async function FinanceAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string }>
}) {
  const activeUser = await requireAuth()
  const { isSuperAdmin, isAdminKantor, isKeuangan, isDireksi, isEditor } = await getSessionRole(activeUser.id)

  const hasAccess = isSuperAdmin || isAdminKantor || isKeuangan || isDireksi
  if (!hasAccess) redirect("/unauthorized")

  const { q = "", type = "", status = "" } = await searchParams

  // Fetch all accounts
  const allAccounts = await db.select().from(financeAccounts).orderBy(financeAccounts.code)

  // Compute current balance per account: openingBalance + sum income transactions - sum expense transactions
  const trxSums = await db
    .select({
      accountId: transactions.accountId,
      type: transactions.type,
      total: sql<number>`SUM(${transactions.amount})`.as("total"),
    })
    .from(transactions)
    .groupBy(transactions.accountId, transactions.type)

  // Build balance map
  const balanceMap: Record<string, number> = {}
  for (const acc of allAccounts) {
    balanceMap[acc.id] = acc.openingBalance ?? 0
  }
  for (const row of trxSums) {
    if (!balanceMap[row.accountId]) balanceMap[row.accountId] = 0
    if (row.type === "income") balanceMap[row.accountId] += row.total ?? 0
    if (row.type === "expense") balanceMap[row.accountId] -= row.total ?? 0
  }

  // Filter
  const filtered = allAccounts.filter((a) => {
    const matchQ = !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.code.toLowerCase().includes(q.toLowerCase())
    const matchType = !type || a.type === type
    const matchStatus = !status || a.status === status
    return matchQ && matchType && matchStatus
  })

  // KPI Metrics
  const totalAccounts = allAccounts.length
  const activeCount = allAccounts.filter((a) => a.status === "active").length
  const totalBalance = allAccounts
    .filter((a) => a.status === "active" && (a.type === "cash" || a.type === "bank"))
    .reduce((sum, a) => sum + (balanceMap[a.id] ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">

      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Landmark className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#243028] tracking-tight"><Translate namespace="account" translationKey="title" /></h1>
              <p className="text-sm text-[#66736A] mt-0.5">
                <Translate namespace="account" translationKey="subtitle" />
              </p>
            </div>
          </div>
          {isEditor && (
            <div className="self-end md:self-center">
              <FinanceAccountForm />
            </div>
          )}
        </div>
      </div>

      {/* ── KPI METRIC CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="account" translationKey="total" /></p>
              <h3 className="text-2xl font-black font-mono tracking-tight text-[#243028] tabular-nums">{totalAccounts}</h3>
              <p className="text-[10px] text-[#8FAF9A]"><Translate namespace="account" translationKey="total_desc" values={{ count: activeCount.toString() }} /></p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center shrink-0">
              <Landmark className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="account" translationKey="active" /></p>
              <h3 className="text-2xl font-black font-mono tracking-tight text-emerald-700 tabular-nums">{activeCount}</h3>
              <p className="text-[10px] text-emerald-500"><Translate namespace="account" translationKey="active_desc" /></p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="account" translationKey="balance" /></p>
              <h3 className="text-xl font-black font-mono tracking-tight text-[#243028] tabular-nums leading-tight">
                {formatRp(totalBalance)}
              </h3>
              <p className="text-[10px] text-[#8FAF9A]"><Translate namespace="account" translationKey="balance_desc" /></p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── FILTER & SEARCH ── */}
      <div className="bg-white/70 backdrop-blur-md border border-[#D6DED2] rounded-2xl p-4 shadow-sage">
        <form method="GET" className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <SearchInput
              i18nKey="account.search_placeholder"
              name="q"
              defaultValue={q}
            />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="status" value={status} />
            <button type="submit" className="w-full md:w-auto h-10 px-5 bg-[#4F6F52] hover:bg-[#3F5941] text-white rounded-xl btn-premium transition-all font-semibold text-sm">
              <Translate namespace="action" translationKey="search" />
            </button>
            {(q || type || status) && (
              <a href="?" className="w-full md:w-auto h-10 px-4 flex items-center justify-center text-xs font-semibold rounded-xl border border-[#D6DED2] text-[#66736A] hover:bg-[#F7F8F3] transition-colors">
                <Translate namespace="action" translationKey="reset" />
              </a>
            )}
          </div>

          {/* Type Pills */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-[#D6DED2]/40">
            {(["", "cash", "bank", "receivable", "payable", "income", "expense"] as const).map((t) => (
              <a
                key={t}
                href={`?q=${q}&type=${t}&status=${status}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 whitespace-nowrap
                  ${type === t || (!type && t === "")
                    ? "bg-[#4F6F52] text-white border-[#4F6F52] shadow-[0_2px_8px_rgba(79,111,82,0.3)]"
                    : "bg-white text-[#66736A] border-[#D6DED2] hover:border-[#8FAF9A] hover:text-[#4F6F52] hover:bg-[#DDE8D8]/30"
                  }`}
              >
                {t === "" ? <Translate namespace="account" translationKey="all_type" /> : <Translate namespace="account" translationKey={TYPE_CONFIG[t]?.labelKey as any ?? t} />}
              </a>
            ))}
          </div>
        </form>
      </div>

      {/* ── DATA TABLE ── */}
      <div className="bg-white border border-[#D6DED2] rounded-2xl shadow-sage overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#66736A] uppercase tracking-wider"><Translate namespace="account" translationKey="list_title" /></span>
            <span className="text-xs font-mono text-[#8FAF9A] tabular-nums"><Translate namespace="account" translationKey="found" values={{ count: filtered.length.toString() }} /></span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center">
                <Landmark className="h-8 w-8 text-[#8FAF9A]" />
              </div>
              <div>
                <p className="font-semibold text-[#243028] text-sm"><Translate namespace="account" translationKey="not_found" /></p>
                <p className="text-xs text-[#66736A] mt-1">
                  {q || type || status ? <Translate namespace="account" translationKey="not_found_desc_1" /> : <Translate namespace="account" translationKey="not_found_desc_2" />}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D6DED2] text-[#66736A] text-xs font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-6"><Translate namespace="account" translationKey="col_name" /></th>
                  <th className="py-3.5 px-6"><Translate namespace="account" translationKey="col_type" /></th>
                  <th className="py-3.5 px-6 text-right"><Translate namespace="account" translationKey="col_opening" /></th>
                  <th className="py-3.5 px-6 text-right"><Translate namespace="account" translationKey="col_current" /></th>
                  <th className="py-3.5 px-6 text-center"><Translate namespace="account" translationKey="col_status" /></th>
                  {isEditor && <th className="py-3.5 px-6 text-right"><Translate namespace="account" translationKey="col_action" /></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DED2]/60 text-sm">
                {filtered.map((acc) => {
                  const cfg = TYPE_CONFIG[acc.type]
                  const IconComp = cfg?.icon ?? Landmark
                  const currentBalance = balanceMap[acc.id] ?? 0
                  const balanceDiff = currentBalance - (acc.openingBalance ?? 0)
                  const st = STATUS_MAP[acc.status]
                  return (
                    <tr key={acc.id} className="hover:bg-[#F7F8F3]/80 transition-colors duration-150 group">
                      {/* Kode & Nama */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-xl ${cfg?.iconBg} ${cfg?.iconText} flex items-center justify-center shrink-0`}>
                            <IconComp className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-mono font-bold text-xs text-[#8FAF9A]">{acc.code}</p>
                            <p className="font-semibold text-[#243028] text-sm">{acc.name}</p>
                          </div>
                        </div>
                      </td>

                      {/* Tipe */}
                      <td className="py-4 px-6">
                        <span className="text-xs font-medium text-[#66736A]">{getAccountTypeLabel(acc.type)}</span>
                      </td>

                      {/* Saldo Awal */}
                      <td className="py-4 px-6 text-right font-mono text-sm text-[#66736A] tabular-nums">
                        {formatRp(acc.openingBalance ?? 0)}
                      </td>

                      {/* Saldo Berjalan */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`font-mono font-bold text-sm tabular-nums ${currentBalance < 0 ? "text-rose-600" : "text-[#243028]"}`}>
                            {formatRp(currentBalance)}
                          </span>
                          {balanceDiff !== 0 && (
                            <span className={`text-[10px] font-mono tabular-nums ${balanceDiff >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                              {balanceDiff >= 0 ? "+" : ""}{formatRp(balanceDiff)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 text-center">
                        <Badge className={`border font-semibold text-xs ${st?.className} flex items-center justify-center gap-1 w-fit mx-auto rounded-full px-2.5 py-0.5`}>
                          {st?.label ?? getAccountStatusLabel(acc.status)}
                        </Badge>
                      </td>

                      {/* Aksi */}
                      {isEditor && (
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end items-center gap-1">
                            <FinanceAccountForm
                              id={acc.id}
                              isEditOnly
                              initialData={{
                                code: acc.code,
                                name: acc.name,
                                type: acc.type as FinanceAccountInput["type"],
                                openingBalance: acc.openingBalance ?? 0,
                                status: acc.status as FinanceAccountInput["status"],
                              }}
                            />
                            <DeleteConfirm
                              label={`rekening "${acc.name}"`}
                              onConfirm={async () => {
                                "use server"
                                return deleteFinanceAccount(acc.id)
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

        <div className="px-6 py-3 border-t border-[#D6DED2]/40 bg-[#F7F8F3]/50">
          <div className="flex items-start gap-2 text-xs text-[#66736A]">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <span>
              <Translate namespace="account" translationKey="note" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
