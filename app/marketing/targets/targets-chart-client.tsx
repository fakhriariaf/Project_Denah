"use client";

import dynamic from "next/dynamic";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";

export interface TargetChartItem {
  name: string;
  target: number;
  achieved: number;
}

interface TargetsChartInnerProps {
  data: TargetChartItem[];
  year: number;
}

function TargetsChartInner({ data, year }: TargetsChartInnerProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[260px] text-sm text-primary/70">
        Belum ada data target untuk tahun {year}.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280} minWidth={0}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        barCategoryGap="30%"
        barGap={4}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D6DED2" />
        <XAxis
          dataKey="name"
          stroke="#66736A"
          fontSize={11}
          tick={{ fill: "#66736A", fontFamily: "Inter, sans-serif" }}
          axisLine={{ stroke: "#D6DED2" }}
          tickLine={false}
        />
        <YAxis
          stroke="#66736A"
          fontSize={10}
          tick={{ fill: "#66736A", fontFamily: "ui-monospace, monospace" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => String(v)}
          allowDecimals={false}
        />
        <ChartTooltip
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid #D6DED2",
            backgroundColor: "rgba(255,255,255,0.97)",
            fontSize: "12px",
            fontFamily: "Inter, sans-serif",
            boxShadow: "0 4px 16px rgba(79,111,82,0.12)",
          }}
          formatter={(value: unknown, name: unknown) => [
            `${Number(value)} unit`,
            name === "target" ? "Target" : "Tercapai",
          ]}
          cursor={{ fill: "rgba(143,175,154,0.06)" }}
        />
        <Legend
          formatter={(value: string) => (value === "target" ? "Target Unit" : "Unit Tercapai")}
          wrapperStyle={{ fontSize: "11px", fontFamily: "Inter, sans-serif", color: "#66736A" }}
        />
        {/* Target bar — lighter sage */}
        <Bar dataKey="target" fill="#8FAF9A" radius={[4, 4, 0, 0]} name="target" maxBarSize={36} />
        {/* Achieved bar — dark sage */}
        <Bar dataKey="achieved" fill="#4F6F52" radius={[4, 4, 0, 0]} name="achieved" maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Export the component wrapped with next/dynamic to disable SSR (recharts requires browser APIs)
export const TargetsBarChart = dynamic(
  () => Promise.resolve(TargetsChartInner),
  { ssr: false }
);
