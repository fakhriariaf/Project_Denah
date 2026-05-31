"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { STATUS_COLORS, type UnitStatus } from "@/lib/siteplan-utils";
import { Filter, SlidersHorizontal, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function SiteplanFilters({ currentFilter }: { currentFilter?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const activeStatuses = currentFilter ? currentFilter.split(",").filter(Boolean) : [];

  const toggleStatus = (status: string) => {
    const next = activeStatuses.includes(status)
      ? activeStatuses.filter((s) => s !== status)
      : [...activeStatuses, status];

    const params = new URLSearchParams(searchParams.toString());
    if (next.length > 0) {
      params.set("status", next.join(","));
    } else {
      params.delete("status");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold">
      <div className="flex items-center gap-1 text-[#66736A] font-bold shrink-0">
        <SlidersHorizontal className="h-3.5 w-3.5 text-[#4F6F52]" />
        <span>{t("siteplan_filters.filter_status")}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={clearAll}
          className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all duration-300 hover:scale-105 ${
            activeStatuses.length === 0
              ? "bg-[#4F6F52] text-white border-[#4F6F52] shadow-sm shadow-[#4F6F52]/20"
              : "border-[#D6DED2] text-[#66736A] hover:bg-[#F7F8F3] hover:text-[#243028] bg-white"
          }`}
        >
          {t("siteplan_filters.all_lots")}
        </button>

        {Object.entries(STATUS_COLORS).map(([status, sc]) => {
          const isActive = activeStatuses.includes(status);
          return (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 transition-all duration-300 hover:scale-105 shadow-sm active:scale-95 ${
                isActive 
                  ? "ring-2 ring-[#4F6F52]/30 font-extrabold" 
                  : "opacity-80 hover:opacity-100"
              }`}
              style={{
                backgroundColor: isActive ? sc.fill : sc.fill + "40",
                color: sc.text,
                borderColor: isActive ? sc.stroke : sc.stroke + "25",
              }}
            >
              {/* Colored active bullet indicator */}
              <span 
                className={`h-1.5 w-1.5 rounded-full shrink-0 transition-transform ${isActive ? "scale-110" : "scale-100"}`}
                style={{ backgroundColor: sc.stroke }}
              />
              <span>{sc.label}</span>
              {isActive && <Check className="h-3 w-3 stroke-[3.5] text-[#4F6F52]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
