"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  CartesianGrid,
} from "recharts";

// BUG 11 FIX: Typed interface instead of any[] — catches dataKey typos at compile time
export interface FinanceBarItem {
  name: string;
  Nominal: number;
}

interface FinanceBarChartProps {
  data: FinanceBarItem[];
}

export default function FinanceBarChart({ data }: FinanceBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280} minWidth={0}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" stroke="#66736A" fontSize={12} />
        <YAxis stroke="#66736A" fontSize={10} tickFormatter={(v) => `Rp ${v.toLocaleString("id-ID")}`} />
        <ChartTooltip formatter={(v) => `Rp ${Number(v).toLocaleString("id-ID")}`} />
        <Bar dataKey="Nominal" fill="#8FAF9A" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
