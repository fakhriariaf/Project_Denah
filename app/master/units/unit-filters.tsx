"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

interface Project {
  id: string;
  name: string;
}

interface StatusEntry {
  label: string;
  badgeClass?: string;
  dotColor?: string;
  /** legacy compat */
  className?: string;
}

interface UnitFiltersProps {
  projects: Project[];
  statusMap: Record<string, StatusEntry>;
}

export function UnitFilters({ projects, statusMap }: UnitFiltersProps) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") || "";
  const projectId = searchParams.get("projectId") || "";
  const status = searchParams.get("status") || "";

  const [searchVal, setSearchVal] = React.useState(q);
  const [selectedProjectId, setSelectedProjectId] = React.useState(projectId || "all");

  React.useEffect(() => { setSearchVal(q); }, [q]);
  React.useEffect(() => { setSelectedProjectId(projectId || "all"); }, [projectId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchVal) params.set("q", searchVal);
    if (selectedProjectId && selectedProjectId !== "all") params.set("projectId", selectedProjectId);
    if (status) params.set("status", status);
    router.push(`?${params.toString()}`);
  };

  const handleStatusClick = (statusVal: string) => {
    const params = new URLSearchParams();
    if (searchVal) params.set("q", searchVal);
    if (selectedProjectId && selectedProjectId !== "all") params.set("projectId", selectedProjectId);
    if (statusVal) params.set("status", statusVal);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="bg-background/70 backdrop-blur-md border border-border rounded-2xl p-4 shadow-sage animate-in fade-in duration-300">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-primary/70" />
            <input
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder={t("unit_filters.search_placeholder")}
              className="w-full pl-10 pr-4 h-10 rounded-xl border border-border bg-muted/30/60 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/40 transition-all duration-200 font-sans"
            />
          </div>

          <div className="w-full md:w-[240px]">
            <Select
              value={selectedProjectId}
              onValueChange={(val) => setSelectedProjectId(val || "all")}
            >
              <SelectTrigger className="w-full h-10 rounded-xl border-border bg-background/80 focus:ring-ring/50 focus:border-primary/40 text-foreground text-sm font-medium">
                <SelectValue placeholder={t("unit_filters.all_projects")}>
                  {selectedProjectId === "all"
                    ? t("unit_filters.all_projects")
                    : projects.find(p => p.id === selectedProjectId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border rounded-xl shadow-sage">
                <SelectItem value="all">{t("unit_filters.all_projects")}</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            className="w-full md:w-auto h-10 px-5 bg-primary hover:bg-[#3F5941] text-white rounded-xl btn-premium transition-all font-semibold text-sm"
          >
            {t("unit_filters.search_btn")}
          </Button>

          {(q || projectId || status) && (
            <Button
              type="button"
              onClick={() => { setSearchVal(""); setSelectedProjectId("all"); router.push("?"); }}
              variant="outline"
              className="w-full md:w-auto h-10 px-4 text-xs font-semibold rounded-xl border-border text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              {t("action.reset")}
            </Button>
          )}
        </div>

        {/* Status Pills Filter — colored dot indicators sesuai e2e_simulation_table */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-border/40">
          {/* "Semua" pill */}
          <button
            type="button"
            onClick={() => handleStatusClick("")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 whitespace-nowrap flex items-center gap-1.5
              ${!status
                ? "bg-primary text-white border-[#4F6F52] shadow-[0_2px_8px_rgba(79,111,82,0.3)]"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary hover:bg-secondary/30"
              }`}
          >
            {t("unit_filters.all_status")}
          </button>

          {Object.entries(statusMap).map(([s, entry]) => {
            const isActive = status === s;
            const dotColor = entry.dotColor ?? "#AAAAAA";
            // Parse fill color from Tailwind class e.g. bg-secondary
            const fillMatch = entry.badgeClass?.match(/bg-\[([^\]]+)\]/);
            const fillColor = fillMatch?.[1] ?? "#F7F8F3";
            const textMatch = entry.badgeClass?.match(/text-\[([^\]]+)\]/);
            const textColor = textMatch?.[1] ?? "#243028";
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleStatusClick(s)}
                title={s}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 hover:scale-105 active:scale-95 ${isActive ? "ring-2 ring-offset-1 ring-current/20 shadow-md font-extrabold" : "opacity-85 hover:opacity-100"}`}
                style={{
                  backgroundColor: isActive ? fillColor : fillColor + "55",
                  color: textColor,
                  borderColor: isActive ? dotColor : dotColor + "50",
                }}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0 transition-transform"
                  style={{ backgroundColor: dotColor, transform: isActive ? "scale(1.3)" : "scale(1)" }}
                />
                {t(`timeline.${s}` as any) || entry.label || s}
              </button>
            );
          })}
        </div>
      </form>
    </div>
  );
}
