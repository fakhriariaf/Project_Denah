import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Translate } from "@/components/translate"

export default function CustomersLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Button */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight text-[#243028]"><Translate namespace="cust" translationKey="title" /></h2>
          <div className="h-4 w-60 bg-[#A8B0AA]/10 rounded animate-pulse" />
        </div>
        <Skeleton className="h-9 w-32 bg-[#8FAF9A]/20" />
      </div>

      <Card className="border-[#D6DED2] bg-white shadow-sage">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-[#243028]"><Translate namespace="cust" translationKey="list_title" /></CardTitle>
          <CardDescription className="text-xs text-[#66736A]"><Translate namespace="cust" translationKey="list_desc" /></CardDescription>
          
          {/* Filters Placeholder */}
          <div className="flex flex-wrap gap-3 pt-4 items-center justify-between">
            <div className="flex items-center gap-2 flex-1 flex-wrap max-w-xl">
              <Skeleton className="h-8 w-[240px] bg-slate-100" />
            </div>
            {/* Status Filter Badges Skeletons */}
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-16 bg-slate-100/80 rounded" />
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-xl border border-[#D6DED2] overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-[#D6DED2] hover:bg-transparent">
                  <TableHead className="font-semibold text-xs text-[#66736A]"><Translate namespace="cust" translationKey="col_name" /></TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A]"><Translate namespace="cust" translationKey="col_phone" /></TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A]"><Translate namespace="cust" translationKey="col_source" /></TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A]"><Translate namespace="cust" translationKey="col_status" /></TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A] text-right"><Translate namespace="cust" translationKey="col_action" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex} className="border-[#D6DED2] hover:bg-slate-50/20">
                    {/* Nama */}
                    <TableCell>
                      <Skeleton className="h-4.5 w-40 bg-slate-100" />
                    </TableCell>
                    {/* No. HP */}
                    <TableCell>
                      <Skeleton className="h-4.5 w-28 bg-[#A8B0AA]/10 font-mono" />
                    </TableCell>
                    {/* Sumber */}
                    <TableCell>
                      <Skeleton className="h-4.5 w-20 bg-slate-100" />
                    </TableCell>
                    {/* Status */}
                    <TableCell>
                      <Skeleton className="h-5.5 w-24 bg-[#DCECF7]/40 border border-[#33627A]/10 rounded-full" />
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
