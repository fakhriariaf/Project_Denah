import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function WorkItemsLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Button */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-8 w-64 bg-[#243028]/10 rounded animate-pulse" />
          <div className="h-4 w-72 bg-[#A8B0AA]/10 rounded animate-pulse" />
        </div>
        <Skeleton className="h-9 w-36 bg-[#8FAF9A]/20" />
      </div>

      <Card className="border-[#D6DED2] bg-white shadow-sage">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-[#243028]">Data Item Pekerjaan &amp; RAB</CardTitle>
          <CardDescription className="text-xs text-[#66736A]">Daftar item pekerjaan konstruksi dan anggaran biaya</CardDescription>

          {/* Filters Placeholder */}
          <div className="flex flex-wrap gap-3 pt-4 items-center justify-between">
            <div className="flex items-center gap-2 flex-1 flex-wrap max-w-xl">
              <Skeleton className="h-8 w-[240px] bg-slate-100" />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-xl border border-[#D6DED2] overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-[#D6DED2] hover:bg-transparent">
                  <TableHead className="font-semibold text-xs text-[#66736A]">Nama Item Pekerjaan</TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A]">Satuan</TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A] text-right">Harga Satuan</TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A]">Kategori</TableHead>
                  <TableHead className="font-semibold text-xs text-[#66736A] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex} className="border-[#D6DED2] hover:bg-slate-50/20">
                    <TableCell>
                      <Skeleton className="h-4.5 w-48 bg-slate-100" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4.5 w-16 bg-slate-100" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-4.5 w-28 bg-[#A8B0AA]/10 font-mono ml-auto" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5.5 w-24 bg-[#DDE8D8]/40 border border-[#8FAF9A]/10 rounded-full" />
                    </TableCell>
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
