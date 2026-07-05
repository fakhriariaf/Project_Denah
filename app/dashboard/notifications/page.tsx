import { requireAuth } from "@/server/permissions";
import { getNotificationsPaginated } from "@/server/actions/notification";
import { getI18n } from "@/lib/i18n-server";
import { Bell } from "lucide-react";
import { Translate } from "@/components/translate";
import { NotificationsClient } from "./notifications-client";

export const revalidate = 0;

interface SearchParamsProps {
  type?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsProps> | SearchParamsProps;
}) {
  // 1. Auth check
  await requireAuth();
  const { t } = await getI18n();

  // 2. Resolve search params
  const resolvedParams = await searchParams;
  const page = Math.max(1, parseInt(resolvedParams.page || "1", 10) || 1);
  const type = resolvedParams.type || "all";
  const startDate = resolvedParams.startDate || "";
  const endDate = resolvedParams.endDate || "";

  // 3. Fetch paginated notifications
  const result = await getNotificationsPaginated({
    type: type !== "all" ? type : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#243028] tracking-tight">Notifikasi</h2>
              <p className="text-sm text-[#66736A] mt-0.5">Riwayat semua notifikasi dan pemberitahuan sistem</p>
            </div>
          </div>
        </div>
      </div>

      {/* Client Component */}
      <NotificationsClient
        initialData={result.data}
        initialTotalCount={result.totalCount}
        initialPage={result.page}
        initialTotalPages={result.totalPages}
        initialType={type}
        initialStartDate={startDate}
        initialEndDate={endDate}
      />
    </div>
  );
}
