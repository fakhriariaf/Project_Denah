"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  CartesianGrid,
} from "recharts";

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md border border-[#D6DED2] p-4 rounded-2xl shadow-[0_10px_30px_rgba(143,175,154,0.12)] font-sans text-xs space-y-2">
        <p className="font-extrabold text-[#243028] border-b border-[#D6DED2]/60 pb-1.5">{label}</p>
        {payload.map((pld: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pld.fill || pld.color || "#8FAF9A" }} />
              <span className="text-[#66736A]">{pld.name}:</span>
            </div>
            <span className="font-mono text-[#243028] font-bold">Rp {pld.value.toLocaleString("id-ID")}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface DashboardAreaChartProps {
  data: any[];
  incomeLabel: string;
  expenseLabel: string;
}

export default function DashboardAreaChart({ data, incomeLabel, expenseLabel }: DashboardAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300} minWidth={0}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--secondary-foreground)" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02}/>
          </linearGradient>
          <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#D77A7A" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="#E8A0A8" stopOpacity={0.02}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `Rp ${(v/1000000).toLocaleString("id-ID")}jt`}
        />
        <ChartTooltip content={<CustomChartTooltip />} />
        <Area type="monotone" dataKey="Inflow" stroke="var(--secondary-foreground)" strokeWidth={3} fillOpacity={1} fill="url(#colorInflow)" name={incomeLabel} />
        <Area type="monotone" dataKey="Outflow" stroke="#D77A7A" strokeWidth={3} fillOpacity={1} fill="url(#colorOutflow)" name={expenseLabel} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
