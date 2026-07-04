"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { formatRupiah } from "@/lib/format-utils";

interface ReportsBarChartProps {
  data: Array<{ name: string; Nominal: number; type?: string }>;
}

export default function ReportsBarChart({ data }: ReportsBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260} minWidth={0}>
      <BarChart data={data} barSize={52}>
        <defs>
          <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--secondary-foreground)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.8} />
          </linearGradient>
          <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D77A7A" stopOpacity={1} />
            <stop offset="100%" stopColor="#E8A0A8" stopOpacity={0.8} />
          </linearGradient>
          <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} fontFamily="Inter" tick={{ fill: "var(--muted-foreground)" }} />
        <YAxis stroke="var(--muted-foreground)" fontSize={10} fontFamily="monospace" tickFormatter={(v) => `Rp ${(v / 1000000).toFixed(0)}jt`} />
        <ChartTooltip
          formatter={(v) => [formatRupiah(Number(v)), "Nominal"]}
          contentStyle={{ borderRadius: "12px", backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: "12px", fontFamily: "monospace" }}
        />
        <Bar dataKey="Nominal" radius={[8, 8, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.type === "income" ? "url(#gradIncome)" : entry.type === "expense" ? "url(#gradExpense)" : "url(#gradNet)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
