"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { ProjectComparisonMetrics } from "@/server/actions/compare";

interface ComparisonChartProps {
  metrics: ProjectComparisonMetrics[];
  colors: string[];
}

export default function ComparisonChart({ metrics, colors }: ComparisonChartProps) {
  // Transform data for grouped bar chart
  // Each item in chartData is a metric with project values as keys
  const chartData = [
    {
      metric: "Total Unit",
      ...Object.fromEntries(metrics.map((m) => [m.projectName, m.totalUnits])),
    },
    {
      metric: "Terjual",
      ...Object.fromEntries(metrics.map((m) => [m.projectName, m.unitsSold])),
    },
    {
      metric: "Tersedia",
      ...Object.fromEntries(metrics.map((m) => [m.projectName, m.unitsAvailable])),
    },
    {
      metric: "Booking",
      ...Object.fromEntries(metrics.map((m) => [m.projectName, m.unitsBooked])),
    },
  ];

  const revenueData = [
    {
      metric: "Revenue (Juta)",
      ...Object.fromEntries(
        metrics.map((m) => [m.projectName, Math.round(m.totalRevenue / 1_000_000)])
      ),
    },
    {
      metric: "Potensi (Juta)",
      ...Object.fromEntries(
        metrics.map((m) => [m.projectName, Math.round(m.potentialRevenue / 1_000_000)])
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Units chart */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3">
          Penjualan Unit
        </p>
        <ResponsiveContainer width="100%" height={260} minWidth={0}>
          <BarChart data={chartData} barGap={2} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="metric" stroke="#66736A" fontSize={11} />
            <YAxis stroke="#66736A" fontSize={10} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            {metrics.map((m, idx) => (
              <Bar
                key={m.projectId}
                dataKey={m.projectName}
                fill={colors[idx]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue chart */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3">
          Revenue (dalam Juta Rupiah)
        </p>
        <ResponsiveContainer width="100%" height={220} minWidth={0}>
          <BarChart data={revenueData} barGap={2} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="metric" stroke="#66736A" fontSize={11} />
            <YAxis stroke="#66736A" fontSize={10} tickFormatter={(v) => `${v}M`} />
            <Tooltip formatter={(v) => `Rp ${Number(v).toLocaleString("id-ID")} Juta`} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            {metrics.map((m, idx) => (
              <Bar
                key={m.projectId}
                dataKey={m.projectName}
                fill={colors[idx]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
