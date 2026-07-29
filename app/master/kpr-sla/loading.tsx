import { Skeleton } from "@/components/ui/skeleton"

export default function KprSlaLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header skeleton */}
      <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <Skeleton className="h-12 w-12 rounded-2xl bg-[#8FAF9A]/20" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-56 bg-[#243028]/10" />
              <Skeleton className="h-4 w-44 bg-[#A8B0AA]/10" />
            </div>
          </div>
          <Skeleton className="h-9 w-32 bg-[#8FAF9A]/20 rounded-xl" />
        </div>
      </div>

      {/* Filter skeletons */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-[160px] bg-slate-100 rounded-xl" />
        <Skeleton className="h-9 w-[160px] bg-slate-100 rounded-xl" />
        <Skeleton className="h-9 w-[140px] bg-slate-100 rounded-xl" />
      </div>

      {/* Table skeleton */}
      <div className="bg-white border border-[#D6DED2] rounded-2xl overflow-hidden shadow-sage">
        <div className="px-6 py-3.5 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-40 bg-slate-100" />
            <Skeleton className="h-4 w-24 bg-slate-100" />
          </div>
        </div>
        <div className="divide-y divide-[#D6DED2]/60">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <Skeleton className="h-4 w-24 bg-slate-100" />
              <Skeleton className="h-4 w-32 bg-slate-100" />
              <Skeleton className="h-4 w-28 bg-slate-100" />
              <Skeleton className="h-4 w-12 bg-slate-100" />
              <Skeleton className="h-5 w-16 bg-[#DDE8D8]/40 rounded-full" />
              <Skeleton className="h-4 w-28 bg-slate-100 flex-1" />
              <Skeleton className="h-4 w-32 bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
