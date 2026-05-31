import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Translate } from "@/components/translate"

export default function UnitsLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Button */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight text-[#243028]"><Translate id="unit.title" /></h2>
          <div className="h-4 w-64 bg-[#A8B0AA]/10 rounded animate-pulse" />
        </div>
        <Skeleton className="h-9 w-28 bg-[#8FAF9A]/20" />
      </div>

      <Card className="border-[#D6DED2] bg-white shadow-sage">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-[#243028]"><Translate id="unit_table.title" /></CardTitle>
          <CardDescription className="text-xs text-[#66736A]"><Translate id="unit.subtitle" /></CardDescription>
          
          {/* Filters Placeholder */}
          <div className="flex flex-wrap gap-3 pt-4 items-center justify-between">
            <div className="flex items-center gap-2 flex-1 flex-wrap max-w-xl">
              <Skeleton className="h-8 w-[200px] bg-slate-100" />
              <Skeleton className="h-8 w-[160px] bg-slate-100" />
              <Skeleton className="h-8 w-14 bg-[#4F6F52]/10" />
            </div>
            {/* Status Filter Badges Skeletons */}
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-20 bg-slate-100/80 rounded" />
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-xl border border-[#D6DED2] overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-[#D6DED2] hover:bg-transparent">
                  <TableHead className="font-semibold text-xs text-[#66736A]"><Translate id="unit_table.col_project" /></TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A]"><Translate id="unit_table.col_block" /></TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A]"><Translate id="unit_table.col_type" /></TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A] text-right"><Translate id="unit_table.col_area" /></TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A] text-right"><Translate id="unit_table.col_price" /></TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A]"><Translate id="unit_table.col_status" /></TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A] text-right"><Translate id="unit_table.col_action" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex} className="border-[#D6DED2] hover:bg-slate-50/20">
                    {/* Project */}
                    <TableCell>
                      <Skeleton className="h-4.5 w-32 bg-slate-100" />
                    </TableCell>
                    {/* Blok/Unit */}
                    <TableCell>
                      <Skeleton className="h-4.5 w-16 bg-[#A8B0AA]/10 font-mono" />
                    </TableCell>
                    {/* Tipe */}
                    <TableCell>
                      <Skeleton className="h-4.5 w-24 bg-slate-100" />
                    </TableCell>
                    {/* LT/LB */}
                    <TableCell className="text-right">
                      <Skeleton className="h-4.5 w-12 bg-slate-100 ml-auto" />
                    </TableCell>
                    {/* Harga */}
                    <TableCell className="text-right">
                      <Skeleton className="h-4.5 w-24 bg-[#DDE8D8]/30 ml-auto" />
                    </TableCell>
                    {/* Status */}
                    <TableCell>
                      <Skeleton className="h-5.5 w-24 bg-[#DDE8D8]/40 border border-[#8FAF9A]/10 rounded-full" />
                    </TableCell>
                    {/* Aksi */}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Skeleton className="h-7 w-7 bg-slate-100 rounded" />
                        <Skeleton className="h-7 w-7 bg-rose-50 rounded" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
