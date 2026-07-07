import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  /** Label displayed above the metric value */
  title: React.ReactNode;
  /** The metric number or formatted string */
  value: string | number;
  /** Icon rendered alongside the title */
  icon: React.ReactNode;
  /** Optional trend indicator with percentage and direction */
  trend?: { value: number; direction: "up" | "down" };
  /** Color for left border accent. Defaults to "#4F6F52" (primary sage) */
  colorScheme?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable stat/metric card component.
 * Displays a titled metric with icon, optional trend indicator,
 * and a left border accent colored by `colorScheme`.
 */
export function StatCard({
  title,
  value,
  icon,
  trend,
  colorScheme = "#4F6F52",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border border-[#D6DED2] dark:border-[#1F2E26] bg-white dark:bg-[#151E1A] p-4 shadow-sm",
        className
      )}
      style={{ borderLeftWidth: "4px", borderLeftColor: colorScheme }}
    >
      {/* Header: icon + title */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DDE8D8]/60 dark:bg-[#1C2B22] text-[#4F6F52] dark:text-[#8FAF9A]">
          {icon}
        </span>
        <span className="text-sm font-medium">{title}</span>
      </div>

      {/* Value + Trend */}
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold tracking-tight text-[#243028] dark:text-[#E3EAE6]">
          {value}
        </span>

        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
              trend.direction === "up"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-600"
            )}
          >
            {trend.direction === "up" ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}
