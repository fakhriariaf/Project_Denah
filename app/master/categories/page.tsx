import { db } from "@/db"
import { financeCategories } from "@/db/schema/master"
import { requireAuth, getSessionRole } from "@/server/permissions"
import { redirect } from "next/navigation"
import { CategoryForm } from "./category-form"
import { deleteFinanceCategory } from "@/server/actions/master"
import { DeleteConfirm } from "@/components/delete-confirm"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tag } from "lucide-react"
import { SearchInput } from "@/components/ui/search-input"
import type { FinanceCategoryInput } from "@/server/validators/master"
import { Translate } from "@/components/translate"

const TYPE_MAP: Record<string, { labelKey: string; className: string }> = {
  income:  { labelKey: "type_income",  className: "bg-[#DDE8D8] text-[#4F6F52] border-[#4F6F52]/20" },
  expense: { labelKey: "type_expense", className: "bg-[#F8D4DA] text-[#8B3443] border-[#8B3443]/20" },
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>
}) {
  const activeUser = await requireAuth()
  const {
    isSuperAdmin,
    isAdminKantor,
    isKeuangan,
    isDireksi,
    isEditor,
  } = await getSessionRole(activeUser.id)

  const hasAccess = isSuperAdmin || isAdminKantor || isKeuangan || isDireksi
  if (!hasAccess) {
    redirect("/unauthorized")
  }

  const { q, type } = await searchParams

  const data = await db.select().from(financeCategories).orderBy(financeCategories.name)

  const filtered = data.filter((c) => {
    const matchQ = !q || c.name.toLowerCase().includes(q.toLowerCase())
    const matchType = !type || c.type === type
    return matchQ && matchType
  })

  // Map to get parent names
  const categoryMap = new Map(data.map(c => [c.id, c.name]))

  return (
    <div className="flex flex-col gap-6">
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Tag className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#243028] tracking-tight"><Translate namespace="category" translationKey="title" /></h2>
              <p className="text-sm text-[#66736A] mt-0.5"><Translate namespace="category" translationKey="subtitle" /></p>
            </div>
          </div>
          {isEditor && (
            <div className="shrink-0 animate-in fade-in zoom-in-95 duration-200 self-end md:self-center">
              <CategoryForm categories={data} />
            </div>
          )}
        </div>
      </div>

      <Card className="border-[#D6DED2]/80 shadow-sage bg-white rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-[#D6DED2]/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-[#243028]"><Translate namespace="category" translationKey="list_title" /></CardTitle>
              <CardDescription className="text-xs text-[#66736A]"><Translate namespace="category" translationKey="subtitle" /></CardDescription>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <form method="GET" className="flex gap-2 flex-1">
                <SearchInput
                  i18nKey="category.search_placeholder"
                  name="q"
                  defaultValue={q ?? ""}
                  className="max-w-xs h-9 text-xs bg-[#F7F8F3]/50 border-[#D6DED2] rounded-xl pl-10 pr-4 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8FAF9A]/50 transition-premium"
                />
                <input type="hidden" name="type" value={type ?? ""} />
                <button type="submit" className="sr-only">Search</button>
              </form>
              <div className="flex items-center gap-1 bg-[#DDE8D8]/30 p-1 rounded-full border border-[#D6DED2] shrink-0">
                {(["", "income", "expense"] as const).map((t) => (
                  <a
                    key={t}
                    href={`?q=${q ?? ""}&type=${t}`}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${type === t || (!type && t === "") ? "bg-[#4F6F52] text-white shadow-sm" : "text-[#66736A] hover:bg-[#DDE8D8]/50"}`}
                  >
                    {t === "" ? <Translate namespace="category" translationKey="all_type" /> : <Translate namespace="category_form" translationKey={TYPE_MAP[t]?.labelKey as any ?? t} />}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {filtered.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/60 flex items-center justify-center mb-3">
                <Tag className="h-8 w-8 text-[#4F6F52]" />
              </div>
              <h3 className="font-bold text-[#243028] text-sm"><Translate namespace="category" translationKey="not_found" /></h3>
              <p className="text-xs text-[#66736A] mt-1">{q || type ? <Translate namespace="category" translationKey="not_found_desc_1" /> : <Translate namespace="category" translationKey="not_found_desc_2" />}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#D6DED2] overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-[#D6DED2] hover:bg-transparent">
                    <TableHead className="font-semibold text-xs text-[#66736A]"><Translate namespace="category" translationKey="col_name" /></TableHead>
                    <TableHead className="font-semibold text-xs text-[#66736A]"><Translate namespace="category" translationKey="col_type" /></TableHead>
                    <TableHead className="font-semibold text-xs text-[#66736A]"><Translate namespace="category" translationKey="col_parent" /></TableHead>
                    <TableHead className="font-semibold text-xs text-[#66736A] text-right"><Translate namespace="category" translationKey="col_action" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const st = TYPE_MAP[c.type]
                    const parentName = c.parentId ? categoryMap.get(c.parentId) : null

                    return (
                      <TableRow key={c.id} className="border-[#D6DED2] hover:bg-[#F7F8F3]/60 transition-colors">
                        <TableCell className="font-semibold text-[#243028] py-3">{c.name}</TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className={`font-semibold rounded-full px-2.5 py-0.5 text-[10px] ${st?.className}`}>
                            <Translate namespace="category_form" translationKey={st?.labelKey as any ?? c.type} />
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-[#66736A] py-3">
                          {parentName ? (
                            <span className="font-bold text-[#243028]">{parentName}</span>
                          ) : (
                            <span className="text-xs italic text-muted-foreground/60"><Translate namespace="category" translationKey="no_parent" /></span>
                          )}
                        </TableCell>

                        <TableCell className="text-right py-3">
                          {isEditor && (
                            <div className="flex justify-end gap-1.5">
                              <CategoryForm
                                id={c.id}
                                categories={data}
                                initialData={{
                                  name: c.name,
                                  type: c.type as FinanceCategoryInput["type"],
                                  parentId: c.parentId || undefined,
                                }}
                              />
                              <DeleteConfirm
                                label={`kategori "${c.name}"`}
                                onConfirm={async () => {
                                  "use server"
                                  return deleteFinanceCategory(c.id)
                                }}
                              />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
