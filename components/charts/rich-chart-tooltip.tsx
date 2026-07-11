/**
 * Rich Chart Tooltip
 *
 * Reusable tooltip for Recharts charts that shows the current value plus a
 * period-over-period trend indicator (arrow + percentage change).
 *
 * The percentage calculation and trend logic are pure functions so they can be
 * unit/property tested independently of React.
 *
 * Validates: Requirements 10.2 (ui-beautification, Property 4)
 */

/**
 * Calculate the percentage change from `previous` to `current`.
 *
 * Formula: ((current - previous) / |previous|) × 100, rounded to one decimal.
 * Returns `null` when `previous` is 0 (division-by-zero guard).
 */
export function calculatePercentageChange(
  current: number,
  previous: number
): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100 * 10) / 10;
}

export interface TrendIndicator {
  /** Direction arrow: ↑ (up), ↓ (down), → (flat) */
  arrow: "↑" | "↓" | "→";
  /** Tailwind text color class for the trend */
  colorClass: string;
}

/**
 * Map a percentage change to a trend arrow and color class.
 * - positive → ↑ green
 * - negative → ↓ red
 * - zero     → → gray
 */
export function getTrendIndicator(percentageChange: number): TrendIndicator {
  if (percentageChange > 0) {
    return { arrow: "↑", colorClass: "text-emerald-600" };
  }
  if (percentageChange < 0) {
    return { arrow: "↓", colorClass: "text-red-500" };
  }
  return { arrow: "→", colorClass: "text-gray-400" };
}

export interface RichChartTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  /** Optional previous-period value used to compute the trend */
  payload?: Record<string, unknown> & { previousValue?: number };
}

export interface RichChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: RichChartTooltipPayloadItem[];
  /** Optional formatter for the displayed value (e.g. currency) */
  valueFormatter?: (value: number) => string;
  /** Key on the datum that holds the previous-period value for trend calc */
  previousKey?: string;
}

/**
 * Recharts-compatible custom tooltip. Renders each series value and, when a
 * previous-period value is available, a trend indicator next to it.
 */
export function RichChartTooltip({
  active,
  label,
  payload,
  valueFormatter,
  previousKey = "previousValue",
}: RichChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const format = valueFormatter ?? ((v: number) => v.toLocaleString("id-ID"));

  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-sage">
      {label !== undefined && (
        <p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((item, idx) => {
          const value = typeof item.value === "number" ? item.value : 0;
          const previous = item.payload?.[previousKey];
          const change =
            typeof previous === "number"
              ? calculatePercentageChange(value, previous)
              : null;
          const trend = change !== null ? getTrendIndicator(change) : null;

          return (
            <div key={idx} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-1.5">
                {item.color && (
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                <span className="text-muted-foreground">{item.name}</span>
              </span>
              <span className="flex items-center gap-1.5 font-mono font-semibold tabular-nums">
                {format(value)}
                {trend && change !== null && (
                  <span className={`text-xs font-bold ${trend.colorClass}`}>
                    {trend.arrow} {Math.abs(change)}%
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RichChartTooltip;
