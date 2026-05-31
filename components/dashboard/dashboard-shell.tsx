"use client";

import * as React from "react";
import {
  CircleDollarSign,
  Home,
  Users,
  AlertCircle,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  MoreVertical,
  Activity,
  Map,
  TrendingUp,
  TrendingDown,
  Layers,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
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

interface DashboardShellProps {
  stats: any;
  userRoles: {
    isSuperAdmin: boolean;
    isAdminKantor: boolean;
    isMarketing: boolean;
    isKeuangan: boolean;
    isDireksi: boolean;
    isPengawas: boolean;
  };
  userName: string;
}

const PIE_COLORS = ["#8FAF9A", "#FFF2C2", "#DCECF7", "#FBE4C9", "#F3D1D1", "#E9DDF7", "#D4EEE7", "#F8D4DA", "#E7E9E7"];

const STATUS_COLOR_MAP: Record<string, string> = {
  "Belum Siap": "#AAB5AF", // Cool Slate/Gray
  "Tersedia": "#8FAF9A", // Sage Green
  "Tersedia - Ready Stock": "#3F5941", // Hijau Gelap
  "Booking": "#E9C46A", // Warm Yellow
  "Proses KPR": "#8FB8D8", // Soft Blue
  "Pending Bayar": "#FBE4C9", // Orange Warm
  "Terjual": "#D77A7A", // Muted Red
  "Proses Bangun": "#B8A4D9", // Soft Lavender
  "Proses Bangun - Ready Stock": "#4B286D", // Ungu Gelap
  "Bangun - Ready Stock": "#4B286D", // Ungu Gelap (Alternative label)
  "Selesai Bangun": "#7AA874", // Success Soft Green
  "Overdue": "#E8A0A8", // Soft Rose
  "Batal": "#A8B0AA", // Cool Gray
};

export default function DashboardShell({
  stats,
  userRoles,
  userName,
}: DashboardShellProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const activeComplaints = stats?.activeComplaints;
  const complaintsByProject = React.useMemo(() => {
    if (!activeComplaints) return {};
    const groups: Record<string, any[]> = {};
    for (const c of activeComplaints) {
      const projName = c.projectName || "Lain-Lain";
      if (!groups[projName]) {
        groups[projName] = [];
      }
      groups[projName].push(c);
    }
    return groups;
  }, [activeComplaints]);

  const totalActiveComplaints = activeComplaints?.length || 0;

  if (!mounted) {
    return (
      <div className="flex h-96 items-center justify-center bg-background/50 rounded-3xl border border-[#D6DED2]">
        <div className="text-[#4F6F52] font-semibold text-base animate-pulse flex items-center gap-2">
          <Clock className="animate-spin h-5 w-5" /> {t("dash.loading")}
        </div>
      </div>
    );
  }

  const {
    isSuperAdmin,
    isAdminKantor,
    isMarketing,
    isKeuangan,
    isDireksi,
    isPengawas,
  } = userRoles;

  // Determine main role name to show greeting
  const mainRoleName = isSuperAdmin
    ? "Super Admin"
    : isDireksi
    ? "Direktur"
    : isKeuangan
    ? "Admin Keuangan"
    : isMarketing
    ? "Marketing Eksekutif"
    : isPengawas
    ? "Pengawas Lapangan"
    : isAdminKantor
    ? "Admin Kantor"
    : "Pengguna";

  return (
    <div className="flex-1 space-y-6 p-1 md:p-2 pt-4 animate-in fade-in duration-500 bg-[#F7F8F3] min-h-screen relative">
      {/* Background Decor Blurs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#8FAF9A]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-[#DDE8D8]/20 rounded-full blur-3xl -z-10 pointer-events-none" />
      
      {/* Top Welcome Panel with Glassmorphic Gradient Mesh */}
      <div className="relative overflow-hidden rounded-3xl border border-[#D6DED2]/85 bg-gradient-to-r from-[#DDE8D8]/80 via-white/90 to-white/40 p-6 md:p-8 backdrop-blur-md shadow-[0_8px_32px_rgba(143,175,154,0.06)]">
        {/* Animated Background Orbs */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#8FAF9A]/15 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-[#DDE8D8]/30 blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#4F6F52]/10 px-3.5 py-1 text-[10px] font-bold tracking-wider text-[#4F6F52] uppercase font-sans">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4F6F52] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4F6F52]"></span>
              </span>
              Operational Command Center
            </div>
            <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-[#243028] font-sans">
              {t("dash.welcome")} <span className="bg-gradient-to-r from-[#4F6F52] to-[#8FAF9A] bg-clip-text text-transparent">{userName}</span>
            </h2>
            <p className="text-xs md:text-sm text-[#66736A] font-medium max-w-xl">
              {t("dash.logged_as")} <span className="font-bold text-[#4F6F52]">{mainRoleName}</span>. {t("dash.greeting_desc")}
            </p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
            <Link href="/reports">
              <Button variant="outline" className="hidden md:flex bg-white/80 backdrop-blur-sm border-[#D6DED2] hover:bg-[#F7F8F3] hover:text-[#4F6F52] active:scale-95 hover:shadow-[0_4px_12px_rgba(143,175,154,0.15)] transition-all duration-300 text-xs font-bold text-[#66736A] h-11 px-5 rounded-2xl shadow-sm">
                {t("dash.report_btn")}
              </Button>
            </Link>
            <Link href="/siteplan">
              <Button className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.35)] hover:shadow-[0_6px_20px_rgba(79,111,82,0.45)] transition-all duration-300 text-xs font-bold h-11 px-5 rounded-2xl">
                <Map className="mr-2 h-4 w-4 shrink-0" /> {t("dash.siteplan_btn")}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 1. ROLE SPECIFIC DYNAMIC CARD METRICS */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Metric 1: Financial Balance / Total Units Available */}
        {(isSuperAdmin || isDireksi || isKeuangan) ? (
          <Card className="rounded-3xl border border-[#D6DED2]/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgba(143,175,154,0.12)] hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#4F6F52]" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("dash.net_cash")}</CardTitle>
              <div className="p-3 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-2xl group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                <CircleDollarSign className="h-4 w-4 shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-extrabold text-[#243028] font-mono tracking-tight tabular-nums">
                Rp {stats.cashBalance.toLocaleString("id-ID")}
              </div>
              <div className="flex items-center gap-1.5 mt-3.5 bg-emerald-500/10 text-[#4F6F52] border border-[#8FAF9A]/20 px-2.5 py-1 rounded-full w-fit text-[9px] font-extrabold uppercase tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{t("dash.verified_cash")}</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-3xl border border-[#D6DED2]/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgba(143,175,154,0.12)] hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#4F6F52]" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("dash.available_units")}</CardTitle>
              <div className="p-3 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-2xl group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                <Home className="h-4 w-4 shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-extrabold text-[#243028] font-mono tracking-tight">
                {stats.unitStatusDistribution.available + (stats.unitStatusDistribution.available_ready || 0)} <span className="text-xs font-bold text-[#66736A]">{t("dash.unit")}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-3.5 bg-[#DDE8D8]/50 text-[#4F6F52] border border-[#8FAF9A]/25 px-2.5 py-1 rounded-full w-fit text-[9px] font-extrabold uppercase tracking-wide">
                <span>{t("dash.total_units", { count: stats.totalUnits.toString() })}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metric 2: Total Units Booked / Active Bookings */}
        <Card className="rounded-3xl border border-[#D6DED2]/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgba(143,175,154,0.12)] hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("dash.booked_units")}</CardTitle>
            <div className="p-3 bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 rounded-2xl group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
              <Home className="h-4 w-4 shrink-0" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-extrabold text-[#243028] font-mono tracking-tight">
              {stats.unitStatusDistribution.booking + stats.unitStatusDistribution.kpr_process} <span className="text-xs font-bold text-[#66736A]">{t("dash.unit")}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-3.5 bg-amber-500/10 text-amber-800 border border-amber-500/20 px-2.5 py-1 rounded-full w-fit text-[9px] font-extrabold uppercase tracking-wide">
              <span>{t("dash.active_kpr", { count: stats.unitStatusDistribution.kpr_process.toString() })}</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Active Pembangunan SPK / Overdue SPK count */}
        <Card className="rounded-3xl border border-[#D6DED2]/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgba(143,175,154,0.12)] hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-purple-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("dash.construction_units")}</CardTitle>
            <div className="p-3 bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 rounded-2xl group-hover:scale-110 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300">
              <Wrench className="h-4 w-4 shrink-0" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-extrabold text-[#243028] font-mono tracking-tight">
              {stats.unitStatusDistribution.construction + (stats.unitStatusDistribution.construction_ready || 0)} <span className="text-xs font-bold text-[#66736A]">{t("dash.unit")}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-3.5 bg-purple-500/10 text-[#5D4382] border border-[#B8A4D9]/20 px-2.5 py-1 rounded-full w-fit text-[9px] font-extrabold uppercase tracking-wide">
              <span>{t("dash.active_spk", { count: stats.activeSpks.toString() })}</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Alerts / Overdue SPK / Pending Approvals */}
        {(isSuperAdmin || isDireksi) ? (
          <Card className="rounded-3xl border border-rose-200/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgb(215,122,122,0.12)] hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden group hover:border-rose-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">{t("dash.pending_approval")}</CardTitle>
              <div className="p-3 bg-rose-50 rounded-2xl text-rose-600 group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-extrabold text-rose-600 font-mono tracking-tight">
                {stats.pendingApprovalsCount} <span className="text-xs font-bold text-rose-500">{t("dash.submission")}</span>
              </div>
              <div className="mt-3">
                <Link href="/finance/approvals" className="text-rose-600 hover:text-white font-extrabold text-[9px] bg-rose-50 hover:bg-rose-500 border border-rose-200/60 px-3 py-1 rounded-full w-fit animate-pulse transition-all duration-300 flex items-center gap-1">
                  <span>{t("dash.open_authorization")}</span> &rarr;
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-3xl border border-rose-200/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgb(215,122,122,0.12)] hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden group hover:border-rose-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">{t("dash.spk_delay")}</CardTitle>
              <div className="p-3 bg-rose-50 rounded-2xl text-rose-600 group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-extrabold text-rose-600 font-mono tracking-tight">
                {stats.overdueSpks} <span className="text-xs font-bold text-rose-500">{t("dash.job")}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-3.5 bg-rose-500/10 text-rose-700 border border-rose-500/20 px-2.5 py-1 rounded-full w-fit text-[9px] font-extrabold uppercase tracking-wide">
                <span>{t("dash.overdue_units", { count: stats.unitStatusDistribution.overdue.toString() })}</span>
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* 2. ANALYTICAL CHARTS & SIDE ACTIVITIES */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Left Side: Analytical Charts */}
        <Card className={`min-w-0 border-[#D6DED2] bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] rounded-3xl hover:shadow-[0_12px_40px_rgba(143,175,154,0.1)] transition-all duration-300 ${isSuperAdmin ? "col-span-4 lg:col-span-4" : "col-span-4 lg:col-span-7"}`}>
          <CardHeader>
            <CardTitle className="text-base font-bold text-[#243028] font-sans">
              {(isMarketing) ? t("dash.chart_alloc_title") : t("dash.chart_cash_title")}
            </CardTitle>
            <CardDescription className="text-xs text-[#66736A] font-medium">
              {(isMarketing) ? t("dash.chart_alloc_desc") : t("dash.chart_cash_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2 pb-5">
            <div className="w-full" style={{ height: 300, minWidth: 0, minHeight: 0 }}>
              {isMarketing ? (
                <div className="relative w-full h-full">
                  <ResponsiveContainer width="100%" height={300} minWidth={0}>
                    <PieChart>
                      <Pie
                        data={stats.statusDataset}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="Jumlah"
                      >
                        {stats.statusDataset.map((entry: any, index: number) => {
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
                    <span className="text-3xl font-extrabold text-foreground font-mono tracking-tight">{stats.totalUnits}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("dash.units")}</span>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                  <AreaChart data={stats.monthlyCashFlow} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
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
                    <Area type="monotone" dataKey="Inflow" stroke="var(--secondary-foreground)" strokeWidth={3} fillOpacity={1} fill="url(#colorInflow)" name={t("dash.income")} />
                    <Area type="monotone" dataKey="Outflow" stroke="#D77A7A" strokeWidth={3} fillOpacity={1} fill="url(#colorOutflow)" name={t("dash.expense")} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {isMarketing && (
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-5 px-4 text-xs font-semibold text-[#66736A]">
                {stats.statusDataset.map((entry: any, idx: number) => {
                  const color = STATUS_COLOR_MAP[entry.name] || PIE_COLORS[idx % PIE_COLORS.length];
                  return (
                    <div key={idx} className="flex items-center gap-2 hover:scale-105 transition-premium cursor-pointer">
                      <div className="h-3.5 w-3.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }}></div>
                      <span>{entry.name} ({entry.Jumlah})</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Side: Activity Feed from Audit logs (Vertical Timeline) */}
        {isSuperAdmin && (
          <Card className="col-span-4 lg:col-span-3 border-[#D6DED2] bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] rounded-3xl hover:shadow-[0_12px_40px_rgba(143,175,154,0.1)] transition-all duration-300 flex flex-col">
            <CardHeader className="pb-3 border-b border-[#D6DED2]/85">
              <CardTitle className="text-base font-bold text-[#243028] font-sans">{t("dash.ledger_title")}</CardTitle>
              <CardDescription className="text-xs text-[#66736A] font-medium">
                {t("dash.ledger_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 bg-[#F7F8F3]/10">
              <ScrollArea className="h-[340px] px-6">
                <div className="relative border-l-2 border-[#D6DED2] ml-4 pl-6 space-y-6 pb-6 pt-4">
                  
                  {stats.recentLogs.length === 0 ? (
                    <div className="text-center py-20 text-[#A8B0AA] text-xs -ml-10">
                      <Layers className="h-10 w-10 mx-auto mb-2 text-[#A8B0AA]/40" />
                      {t("dash.no_activity")}
                    </div>
                  ) : (
                    stats.recentLogs.map((log: any) => {
                      const isIncome = log.action === "approve" && log.module === "finance";
                      const isReject = log.action === "reject";
                      
                      return (
                        <div key={log.id} className="relative group cursor-pointer">
                          {/* Timeline Bullet Bullet */}
                          <span className={`absolute -left-[31px] top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white text-white shadow-sm transition-transform duration-300 group-hover:scale-125 ${isIncome ? "bg-emerald-500" : isReject ? "bg-rose-500" : "bg-[#4F6F52]"}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping opacity-75" />
                          </span>
                          
                          <div className="bg-white hover:bg-[#DDE8D8]/20 p-3 rounded-2xl transition-all duration-300 border border-[#D6DED2]/50 shadow-sm hover:border-[#8FAF9A]/50 hover:shadow-[0_4px_15px_rgba(143,175,154,0.08)] space-y-2">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-7 w-7 border border-[#D6DED2] shadow-sm transition-transform group-hover:scale-105 shrink-0">
                                <AvatarFallback className="bg-[#DDE8D8] text-[#4F6F52] font-extrabold text-[10px] uppercase">
                                  {log.userName.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold leading-none text-[#243028] truncate">
                                  {log.userName}
                                </p>
                                <span className="text-[9px] font-extrabold text-[#66736A] uppercase tracking-wider mt-0.5 inline-block">
                                  {log.action} &bull; {log.entityType || log.module}
                                </span>
                              </div>
                            </div>
                            
                            {/* Log detail snippet if available */}
                            {log.details && (
                              <div className="text-[10px] text-[#66736A] bg-[#F7F8F3] px-2.5 py-1.5 rounded-xl border border-[#D6DED2]/50 font-mono font-medium truncate">
                                {Object.entries(log.details)
                                  .slice(0, 2)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(" | ")}
                              </div>
                            )}
                            
                            <p className="text-[8px] text-[#A8B0AA] flex items-center gap-1 font-bold">
                              <Clock className="h-2.5 w-2.5 shrink-0" />
                              {new Date(log.createdAt).toLocaleDateString("id-ID")} {new Date(log.createdAt).toLocaleTimeString("id-ID")}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}

                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

      </div>
      
      {/* 2b. KENDALA / KOMPLAIN UNIT AKTIF PER PROYEK */}
      <Card className="border-rose-200/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] rounded-3xl hover:shadow-[0_12px_40px_rgba(143,175,154,0.1)] transition-all duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#A94A4A] flex items-center gap-2 font-sans">
                <AlertCircle className="h-5 w-5 text-rose-600" /> Kendala / Komplain Unit Aktif
              </CardTitle>
              <CardDescription className="text-xs text-[#66736A] font-medium">
                Daftar masalah konstruksi aktif dikelompokkan per proyek.
              </CardDescription>
            </div>
            {totalActiveComplaints > 0 && (
              <Badge className="bg-rose-500 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full">
                {totalActiveComplaints} Kendala
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {totalActiveComplaints === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center bg-emerald-500/5 rounded-2xl border border-emerald-100/50">
              <CheckCircle2 className="h-8 w-8 text-[#4F6F52] mb-2" />
              <p className="text-xs font-bold text-[#4F6F52]">Semua Proyek Berjalan Lancar!</p>
              <p className="text-[10px] text-[#66736A] mt-0.5">Tidak ada kendala konstruksi aktif yang dilaporkan saat ini.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(complaintsByProject).map(([projName, items]) => (
                <div key={projName} className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-[#D6DED2]/60">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <h4 className="text-xs font-black text-[#243028] uppercase tracking-wider">{projName}</h4>
                    <span className="text-[10px] font-bold text-[#66736A] bg-[#DDE8D8]/50 px-2 py-0.5 rounded-full">
                      {items.length} Masalah
                    </span>
                  </div>
                  
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((c: any) => (
                      <div 
                        key={c.id} 
                        className="bg-white hover:bg-rose-50/5 p-3.5 rounded-2xl border border-[#D6DED2]/85 shadow-sm hover:border-rose-300 hover:shadow-[0_4px_16px_rgba(215,122,122,0.08)] transition-all duration-300 flex flex-col justify-between gap-3 relative group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-start gap-2 flex-wrap">
                            <span className="font-mono text-[9px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                              {c.complaintNumber}
                            </span>
                            <Badge className="bg-amber-500/10 text-amber-800 hover:bg-amber-500/15 border border-amber-200/50 text-[9px] font-extrabold uppercase py-0.5 px-2 rounded-full shadow-none shrink-0">
                              {c.category === "quality" ? "Kualitas" : c.category === "delay" ? "Keterlambatan" : c.category === "document" ? "Dokumen" : c.category === "payment" ? "Keuangan" : "Lainnya"}
                            </Badge>
                          </div>
                          
                          <div>
                            <h5 className="text-xs font-extrabold text-[#243028]">
                              Kavling {c.unitCode}
                            </h5>
                            <p className="text-[10px] text-[#66736A] font-medium leading-relaxed mt-1 line-clamp-3" title={c.description}>
                              {c.description}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-[#D6DED2]/50 flex justify-between items-center text-[9px] font-semibold text-[#66736A]">
                          <span>Konsumen: <span className="text-[#243028] font-bold">{c.customerName}</span></span>
                          <span className="text-[9px] text-[#A8B0AA] font-mono">
                            {new Date(c.createdAt).toLocaleDateString("id-ID")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* 3. SITEPLAN STATUS MATRIX OVERVIEW */}
      <Card className="border-[#D6DED2]/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] rounded-3xl hover:shadow-[0_12px_40px_rgba(143,175,154,0.1)] transition-all duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#243028] font-sans">{t("dash.siteplan_matrix_title")}</CardTitle>
              <CardDescription className="text-xs text-[#66736A] font-medium">
                {t("dash.siteplan_matrix_desc")}
              </CardDescription>
            </div>
            <Link href="/siteplan" className="text-xs font-extrabold text-[#4F6F52] hover:text-[#3D563F] hover:underline flex items-center gap-1 print:hidden shrink-0 transition-colors duration-200">
              {t("dash.view_full_siteplan")} <ArrowUpRight className="h-4 w-4 shrink-0" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {stats.statusDataset.map((s: any, idx: number) => {
              const name = s.name;
              const count = s.Jumlah;
              
              const styleMap: Record<string, { bg: string, border: string, text: string, hoverBorder: string }> = {
                "Belum Siap": { bg: "bg-white", border: "border-[#D6DED2]", text: "text-[#66736A]", hoverBorder: "hover:border-[#66736A]" },
                "Tersedia": { bg: "bg-[#DDE8D8]/50", border: "border-[#8FAF9A]/30", text: "text-[#4F6F52]", hoverBorder: "hover:border-[#4F6F52]" },
                "Tersedia - Ready Stock": { bg: "bg-[#3F5941]/10", border: "border-[#3F5941]/35", text: "text-[#3F5941]", hoverBorder: "hover:border-[#3F5941]" },
                "Booking": { bg: "bg-[#FFF2C2]/45", border: "border-[#E9C46A]/30", text: "text-[#8A6D1D]", hoverBorder: "hover:border-[#8A6D1D]" },
                "Proses KPR": { bg: "bg-[#DCECF7]/50", border: "border-[#8FB8D8]/30", text: "text-[#33627A]", hoverBorder: "hover:border-[#33627A]" },
                "Pending Bayar": { bg: "bg-[#FBE4C9]/40", border: "border-[#FBE4C9]/60", text: "text-[#9A5C21]", hoverBorder: "hover:border-[#9A5C21]" },
                "Terjual": { bg: "bg-[#F3D1D1]/45", border: "border-[#D77A7A]/30", text: "text-[#8A3030]", hoverBorder: "hover:border-[#8A3030]" },
                "Proses Bangun": { bg: "bg-[#E9DDF7]/45", border: "border-[#B8A4D9]/40", text: "text-[#5D4382]", hoverBorder: "hover:border-[#5D4382]" },
                "Proses Bangun - Ready Stock": { bg: "bg-[#4B286D]/10", border: "border-[#4B286D]/35", text: "text-[#4B286D]", hoverBorder: "hover:border-[#4B286D]" },
                "Bangun - Ready Stock": { bg: "bg-[#4B286D]/10", border: "border-[#4B286D]/35", text: "text-[#4B286D]", hoverBorder: "hover:border-[#4B286D]" },
                "Selesai Bangun": { bg: "bg-[#D4EEE7]/50", border: "border-[#7AA874]/30", text: "text-[#2D5A4E]", hoverBorder: "hover:border-[#2D5A4E]" },
                "Overdue": { bg: "bg-[#F8D4DA]/45", border: "border-[#E8A0A8]/55", text: "text-[#8B3443]", hoverBorder: "hover:border-[#8B3443]" },
                "Batal": { bg: "bg-[#E7E9E7]/40", border: "border-[#A8B0AA]/40", text: "text-[#5F6861]", hoverBorder: "hover:border-[#5F6861]" },
              };
              
              const style = styleMap[name] || { bg: "bg-white", border: "border-[#D6DED2]/60", text: "text-[#4F6F52]", hoverBorder: "hover:border-[#8FAF9A]" };
              
              return (
                <div 
                  key={idx} 
                  className={`h-20 rounded-2xl flex flex-col items-center justify-center border ${style.border} ${style.bg} ${style.hoverBorder} hover:scale-[1.05] hover:shadow-[0_6px_16px_rgba(143,175,154,0.12)] transition-all duration-300 cursor-pointer p-3.5 shadow-sm text-center`}
                >
                  <span className="text-[9px] text-[#66736A] font-extrabold uppercase tracking-wider line-clamp-1">{name}</span>
                  <span className={`font-mono font-black text-lg ${style.text} mt-1.5`}>{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
    </div>
  );
}
