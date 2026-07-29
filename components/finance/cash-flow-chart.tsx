"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CashFlowDataPoint {
  /** Period label, e.g. "Jan 2025", "Feb 2025" */
  period: string;
  /** Total inflow (income) for this period */
  inflow: number;
  /** Total outflow (expense) for this period */
  outflow: number;
  /** Net flow = inflow - outflow */
  netFlow: number;
}

export interface CashFlowChartProps {
  /** Data series — pre-computed from transactions by consumer */
  data: CashFlowDataPoint[];
  /** Dynamic chart title from active filter */
  title: string;
  /** Date range label, e.g. "Jan 2025 - Jun 2025" */
  dateRange: string;
}

// ─── Design Tokens ───────────────────────────────────────────────────────────

const LINE_COLORS = {
  inflow: "#8FAF9A", // Sage Green — Arus Masuk
  outflow: "#DC2626", // Red — Arus Keluar
  netFlow: "#4F6F52", // Sage Dark — Arus Kas Bersih
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format Rupiah for tooltip/axis — abbreviated for readability */
function formatRupiahShort(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  }
  if (Math.abs(value) >= 1_000) {
    return `Rp ${(value / 1_000).toFixed(0)}rb`;
  }
  return `Rp ${value.toLocaleString("id-ID")}`;
}

/** Full Rupiah format for tooltip detail */
function formatRupiahFull(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  color: string;
  name: string;
  value: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-md">
      <p className="mb-2 text-xs font-semibold text-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {formatRupiahFull(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton Fallback ───────────────────────────────────────────────────────

export function CashFlowChartSkeleton() {
  return (
    <div
      className="h-[300px] w-full animate-pulse rounded-xl border border-border bg-secondary/30"
      aria-label="Memuat grafik arus kas..."
      role="img"
    >
      <div className="flex h-full items-center justify-center">
        <span className="text-xs text-muted-foreground">
          Memuat grafik...
        </span>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * CashFlowChart — presentational Client Component for cash flow line chart.
 *
 * Uses Recharts (existing dependency ^3.8.1).
 * Three lines: Arus Masuk (Sage Green), Arus Keluar (Red), Arus Kas Bersih (Sage Dark).
 * Tooltip and legend in Bahasa Indonesia.
 *
 * Does NOT use Date.now(), Math.random(), window, or dynamic imports.
 * The consumer (ReportsTab) is responsible for loading this via next/dynamic({ ssr: false }).
 */
export function CashFlowChart({ data, title, dateRange }: CashFlowChartProps) {
  // ─── Empty state ──────────────────────────────────────────────────────────
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center rounded-xl border border-border bg-secondary/20">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Tidak ada data untuk periode yang dipilih.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ubah filter periode untuk melihat grafik arus kas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Chart header */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{dateRange}</p>
      </div>

      {/* Chart container — fixed height to prevent layout shift */}
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#D6DED2" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11, fill: "#66736A" }}
              axisLine={{ stroke: "#D6DED2" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#66736A" }}
              axisLine={{ stroke: "#D6DED2" }}
              tickLine={false}
              tickFormatter={formatRupiahShort}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />
            <Line
              type="monotone"
              dataKey="inflow"
              name="Arus Masuk"
              stroke={LINE_COLORS.inflow}
              strokeWidth={2}
              dot={{ r: 4, fill: LINE_COLORS.inflow }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="outflow"
              name="Arus Keluar"
              stroke={LINE_COLORS.outflow}
              strokeWidth={2}
              dot={{ r: 4, fill: LINE_COLORS.outflow }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="netFlow"
              name="Arus Kas Bersih"
              stroke={LINE_COLORS.netFlow}
              strokeWidth={2.5}
              dot={{ r: 4, fill: LINE_COLORS.netFlow }}
              activeDot={{ r: 6 }}
              strokeDasharray="5 3"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default CashFlowChart;
