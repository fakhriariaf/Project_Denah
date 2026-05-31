import { db } from "@/db"
import { bankPartners, bankSubmissions } from "@/db/schema/marketing"
import { requireAuth, getSessionRole } from "@/server/permissions"
import { redirect } from "next/navigation"
import { desc, count, eq } from "drizzle-orm"
import { Badge } from "@/components/ui/badge"
import { Building, Phone, User, Plus, CheckCircle2, XCircle, Banknote } from "lucide-react"
import { BankPartnerForm } from "./bank-partner-form"
import { DeleteConfirm } from "@/components/delete-confirm"
import { deleteBankPartner } from "@/server/actions/marketing"
import { Translate } from "@/components/translate"

export const revalidate = 0

export default async function BankPartnersPage() {
  const activeUser = await requireAuth()
  const session = await getSessionRole(activeUser.id)

  const hasAccess = session.isSuperAdmin || session.isAdminKantor || session.isMarketing || session.isMarketingManager || session.isKeuangan || session.isDireksi
  if (!hasAccess) redirect("/unauthorized")

  const canManage = session.isSuperAdmin || session.isAdminKantor

  // Fetch bank partners with submission counts
  const bankList = await db
    .select({
      id: bankPartners.id,
      name: bankPartners.name,
      contactPerson: bankPartners.contactPerson,
      phone: bankPartners.phone,
      status: bankPartners.status,
      createdAt: bankPartners.createdAt,
      submissionCount: count(bankSubmissions.id),
    })
    .from(bankPartners)
    .leftJoin(bankSubmissions, eq(bankSubmissions.bankPartnerId, bankPartners.id))
    .groupBy(bankPartners.id)
    .orderBy(bankPartners.name)

  const activeCount = bankList.filter((b) => b.status === "active").length
  const totalSubmissions = bankList.reduce((sum, b) => sum + b.submissionCount, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] rounded-2xl p-6 shadow-sage">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Banknote className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#243028] tracking-tight"><Translate namespace="bank" translationKey="title" /></h1>
              <p className="text-sm text-[#66736A] mt-0.5">
                <Translate namespace="bank" translationKey="subtitle" />
              </p>
            </div>
          </div>
          {canManage && <BankPartnerForm />}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#D6DED2] rounded-2xl p-5 shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="bank" translationKey="active" /></p>
            <h3 className="text-2xl font-black font-mono text-[#243028] tabular-nums">{activeCount}</h3>
            <p className="text-[10px] text-[#8FAF9A]"><Translate namespace="bank" translationKey="active_desc" values={{ count: bankList.length.toString() }} /></p>
          </div>
        </div>
        <div className="bg-white border border-[#D6DED2] rounded-2xl p-5 shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center shrink-0">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="bank" translationKey="total" /></p>
            <h3 className="text-2xl font-black font-mono text-[#243028] tabular-nums">{bankList.length}</h3>
            <p className="text-[10px] text-[#8FAF9A]"><Translate namespace="bank" translationKey="total_desc" /></p>
          </div>
        </div>
        <div className="bg-white border border-[#D6DED2] rounded-2xl p-5 shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="bank" translationKey="submissions" /></p>
            <h3 className="text-2xl font-black font-mono text-[#243028] tabular-nums">{totalSubmissions}</h3>
            <p className="text-[10px] text-[#8FAF9A]"><Translate namespace="bank" translationKey="submissions_desc" /></p>
          </div>
        </div>
      </div>

      {/* Bank List */}
      <div className="bg-white border border-[#D6DED2] rounded-2xl overflow-hidden shadow-sage">
        <div className="px-6 py-3.5 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#66736A] uppercase tracking-wider"><Translate namespace="bank" translationKey="list_title" /></span>
            <span className="text-xs font-mono text-[#8FAF9A] tabular-nums"><Translate namespace="bank" translationKey="found" values={{ count: bankList.length.toString() }} /></span>
          </div>
        </div>

        {bankList.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/60 flex items-center justify-center mx-auto mb-4">
              <Banknote className="h-8 w-8 text-[#8FAF9A]" />
            </div>
            <p className="font-bold text-[#243028]"><Translate namespace="bank" translationKey="not_found" /></p>
            <p className="text-xs text-[#66736A] mt-1"><Translate namespace="bank" translationKey="not_found_desc" /></p>
          </div>
        ) : (
          <div className="divide-y divide-[#D6DED2]/60">
            {bankList.map((bank) => (
              <div key={bank.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#F7F8F3]/60 transition-colors">
                {/* Icon */}
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${bank.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"}`}>
                  <Building className="h-5 w-5" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-[#243028] text-sm">{bank.name}</p>
                    <Badge className={`border text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${bank.status === "active" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                      {bank.status === "active"
                        ? <><CheckCircle2 className="h-3 w-3" /><Translate namespace="bank" translationKey="status_active" /></>
                        : <><XCircle className="h-3 w-3" /><Translate namespace="bank" translationKey="status_inactive" /></>
                      }
                    </Badge>
                    <span className="text-[10px] font-mono text-[#8FAF9A]"><Translate namespace="bank" translationKey="submission_count" values={{ count: bank.submissionCount.toString() }} /></span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {bank.contactPerson && (
                      <span className="flex items-center gap-1 text-xs text-[#66736A]">
                        <User className="h-3 w-3 text-[#8FAF9A]" />
                        {bank.contactPerson}
                      </span>
                    )}
                    {bank.phone && (
                      <span className="flex items-center gap-1 text-xs font-mono text-[#66736A]">
                        <Phone className="h-3 w-3 text-[#8FAF9A]" />
                        {bank.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {canManage && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <BankPartnerForm
                      id={bank.id}
                      initialData={{
                        name: bank.name,
                        contactPerson: bank.contactPerson ?? undefined,
                        phone: bank.phone ?? undefined,
                        status: bank.status as "active" | "inactive",
                      }}
                    />
                    <DeleteConfirm
                      label={`bank "${bank.name}"`}
                      description={<Translate namespace="bank" translationKey="delete_desc" />}
                      onConfirm={async () => {
                        "use server"
                        return deleteBankPartner(bank.id)
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
