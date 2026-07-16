"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ChartTooltip,
} from "recharts";

const PIE_COLORS = ["#8FAF9A", "#FFF2C2", "#DCECF7", "#FBE4C9", "#F3D1D1", "#E9DDF7", "#D4EEE7", "#F8D4DA", "#E7E9E7"];

const STATUS_COLOR_MAP: Record<string, string> = {
  "Belum Siap": "#AAB5AF",
  "Tersedia": "#8FAF9A",
  "Tersedia (Indent)": "#8FAF9A",
  "Tersedia - Ready Stock": "#3F5941",
  "Tersedia Siap Huni": "#3F5941",
  "Booking": "#E9C46A",
  "Proses KPR": "#8FB8D8",
  "Pending Bayar": "#FBE4C9",
  "Terjual": "#D77A7A",
  "Proses Bangun": "#B8A4D9",
  "Proses Bangun - Ready Stock": "#4B286D",
  "Bangun - Ready Stock": "#4B286D",
  "Sedang Dibangun untuk Ready Stock": "#4B286D",
  "Selesai Bangun": "#7AA874",
  "Overdue": "#E8A0A8",
  "Batal": "#A8B0AA",
};

interface DashboardPieChartProps {
  data: any[];
  totalUnits: number;
  unitsLabel: string;
}

export default function DashboardPieChart({ data, totalUnits, unitsLabel }: DashboardPieChartProps) {
  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer width="100%" height={300} minWidth={0}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={95}
            paddingAngle={3}
            dataKey="Jumlah"
          >
            {data.map((entry: any, index: number) => {
              const color = STATUS_COLOR_MAP[entry.name] || PIE_COLORS[index % PIE_COLORS.length];
              return (
                <Cell key={`cell-${index}`} fill={color} stroke="var(--card)" strokeWidth={2} />
              );
            })}
          </Pie>
          <ChartTooltip formatter={(v, name) => [`${v} Unit`, name]} />
        </PieChart>
      </ResponsiveContainer>
      {/* Central Statistics Indicator */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-extrabold text-foreground font-mono tracking-tight">{totalUnits}</span>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{unitsLabel}</span>
      </div>
    </div>
  );
}

export { STATUS_COLOR_MAP, PIE_COLORS };
