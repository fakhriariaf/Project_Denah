import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Translate } from "@/components/translate"

export default function BookingsLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight"><Translate namespace="booking" translationKey="title" /></h1>
          <div className="h-4 w-96 bg-[#A8B0AA]/10 rounded animate-pulse" />
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="shadow-sm border-slate-100 bg-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-24 bg-slate-100" />
                <Skeleton className={`h-6 w-32 ${i === 0 ? "bg-[#DDE8D8]" : "bg-slate-100"}`} />
              </div>
              <Skeleton className="h-10 w-10 bg-slate-100 rounded-xl" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FILTER & SEARCH */}
      <Card className="shadow-sm border-slate-100 bg-white">
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
          <Skeleton className="h-10 flex-1 bg-slate-50" />
          <Skeleton className="h-10 w-full md:w-[160px] bg-slate-50" />
          <Skeleton className="h-10 w-20 bg-[#4F6F52]/10" />
        </CardContent>
      </Card>

      {/* DATA TABLE VIEW */}
      <Card className="shadow-sm border-slate-100 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-slate-100 hover:bg-transparent">
                <TableHead className="py-4 px-6 text-xs font-semibold text-slate-500"><Translate namespace="booking" translationKey="col_number" /></TableHead>
                <TableHead className="py-4 px-6 text-xs font-semibold text-slate-500"><Translate namespace="booking" translationKey="col_customer_unit" /></TableHead>
                <TableHead className="py-4 px-6 text-xs font-semibold text-slate-500 text-right"><Translate namespace="booking" translationKey="col_amount" /></TableHead>
                <TableHead className="py-4 px-6 text-xs font-semibold text-slate-500 text-right"><Translate namespace="booking" translationKey="col_dp" /></TableHead>
                <TableHead className="py-4 px-6 text-xs font-semibold text-slate-500 text-center"><Translate namespace="booking" translationKey="col_scheme" /></TableHead>
                <TableHead className="py-4 px-6 text-xs font-semibold text-slate-500 text-center"><Translate namespace="booking" translationKey="col_status" /></TableHead>
                <TableHead className="py-4 px-6 text-xs font-semibold text-slate-500 text-right"><Translate namespace="booking" translationKey="col_action" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={rowIndex} className="border-slate-100 hover:bg-slate-50/20">
                  {/* Nomor Booking */}
                  <TableCell className="py-4 px-6">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-28 bg-[#A8B0AA]/10 font-mono" />
                      <Skeleton className="h-3 w-20 bg-slate-100" />
                    </div>
                  </TableCell>
                  {/* Konsumen / Unit */}
                  <TableCell className="py-4 px-6">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-36 bg-slate-100" />
                      <Skeleton className="h-3 w-48 bg-slate-100" />
                    </div>
                  </TableCell>
                  {/* BF */}
                  <TableCell className="py-4 px-6 text-right">
                    <Skeleton className="h-4 w-24 bg-slate-100 ml-auto" />
                  </TableCell>
                  {/* DP */}
                  <TableCell className="py-4 px-6 text-right">
                    <Skeleton className="h-4 w-24 bg-slate-100 ml-auto" />
                  </TableCell>
                  {/* Skema */}
                  <TableCell className="py-4 px-6 text-center">
                    <Skeleton className="h-5.5 w-14 bg-slate-100 rounded mx-auto" />
                  </TableCell>
                  {/* Status */}
                  <TableCell className="py-4 px-6 text-center">
                    <Skeleton className="h-5.5 w-20 bg-[#DDE8D8]/40 border border-[#8FAF9A]/10 rounded-full mx-auto" />
                  </TableCell>
                  {/* Aksi */}
                  <TableCell className="py-4 px-6 text-right">
                    <Skeleton className="h-8 w-24 bg-slate-100 rounded-md ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
