import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function NotificationsLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header Skeleton */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
            <Bell className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="h-7 w-40 bg-[#DDE8D8] rounded animate-pulse" />
            <div className="h-4 w-64 bg-[#DDE8D8]/60 rounded mt-2 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Filter Skeleton */}
      <Card className="border-[#D6DED2]">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="h-9 w-40 bg-[#DDE8D8]/50 rounded-lg animate-pulse" />
            <div className="h-9 w-36 bg-[#DDE8D8]/50 rounded-lg animate-pulse" />
            <div className="h-9 w-36 bg-[#DDE8D8]/50 rounded-lg animate-pulse" />
          </div>
        </CardContent>
      </Card>

      {/* List Skeleton */}
      <Card className="border-[#D6DED2]">
        <CardContent className="p-0 divide-y divide-[#D6DED2]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-4">
              <div className="w-9 h-9 rounded-lg bg-[#DDE8D8]/50 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 bg-[#DDE8D8]/50 rounded animate-pulse" />
                <div className="h-3 w-full bg-[#DDE8D8]/30 rounded animate-pulse" />
                <div className="h-3 w-24 bg-[#DDE8D8]/30 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
