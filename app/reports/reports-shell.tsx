"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  Printer,
  Building,
  Download,
  Search,
  FileSpreadsheet,
  Activity,
  Wrench,
  BarChart3,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { getFinancialReport } from "@/server/actions/finance";
import {
  getSalesReportsData,
  getProductionReportsData,
  getUnitReportsData,
} from "@/server/actions/reports";
import { exportToCsv } from "@/lib/export-utils";
import { formatRupiah } from "@/lib/format-utils";
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
import { useI18n } from "@/lib/i18n";
import { Translate } from "@/components/translate";

interface ReportsShellProps {
  projects: Array<{ id: string; name: string; code: string }>;
  initialReport: Record<string, any>;
}

export default function ReportsShell({
  projects,
  initialReport,
}: ReportsShellProps) {
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("all");
  const [activeTab, setActiveTab] = React.useState<string>("financial");
  const [report, setReport] = React.useState<Record<string, any>>(initialReport);
  const { t } = useI18n();
  
  const [unitData, setUnitData] = React.useState<Array<Record<string, any>>>([]);
  const [salesData, setSalesData] = React.useState<Array<Record<string, any>>>([]);
  const [productionData, setProductionData] = React.useState<Array<Record<string, any>>>([]);
  
  const [isLoading, setIsLoading] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const fetchData = React.useCallback(async (projectId: string, tab: string, status: string = "all") => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      if (tab === "financial") {
        const data = await getFinancialReport(projectId);
        setReport(data);
      } else if (tab === "units") {
        const filterStatus = status === "all" ? undefined : status;
        const data = await getUnitReportsData(projectId, filterStatus);
        setUnitData(data);
      } else if (tab === "sales") {
        const filterStatus = status === "all" ? undefined : status;
        const data = await getSalesReportsData(projectId, filterStatus);
        setSalesData(data);
      } else if (tab === "production") {
        const filterStatus = status === "all" ? undefined : status;
        const data = await getProductionReportsData(projectId, filterStatus);
        setProductionData(data);
      }
    } catch (err) {
      console.error("Gagal memuat laporan data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (mounted && selectedProjectId) {
      fetchData(selectedProjectId, activeTab, statusFilter);
    }
  }, [mounted, selectedProjectId, activeTab, statusFilter, fetchData]);

  const handleProjectChange = (projectId: string | null) => {
    if (!projectId) return;
    setSelectedProjectId(projectId);
    setSearchQuery("");
    setStatusFilter("all");
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchQuery("");
    setStatusFilter("all");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const projectName = selectedProjectId === "all" ? t("reports.all_projects") : projects.find(p => p.id === selectedProjectId)?.name || "Laporan";
    
    if (activeTab === "units") {
      const headers = {
        code: "Kode Unit",
        block: "Blok",
        cluster: "Cluster",
        price: "Harga",
        status: "Status Unit",
        projectName: "Proyek",
      };
      exportToCsv(filteredUnits, headers, `Laporan_Unit_${projectName.replace(/\s+/g, "_")}`);
    } else if (activeTab === "sales") {
      const headers = {
        bookingNumber: "Nomor Booking",
        projectName: "Nama Proyek",
        unitCode: "Kode Unit",
        customerName: "Nama Konsumen",
        customerPhone: "Telepon Konsumen",
        bookingDate: "Tanggal Booking",
        bookingFee: "Booking Fee",
        dpAmount: "Uang Muka (DP)",
        paymentScheme: "Skema Pembayaran",
        status: "Status Booking",
      };
      exportToCsv(filteredSales, headers, `Laporan_Marketing_${projectName.replace(/\s+/g, "_")}`);
    } else if (activeTab === "production") {
      const headers = {
        spkNumber: "Nomor SPK",
        projectName: "Nama Proyek",
        unitCode: "Kode Unit",
        vendorName: "Nama Kontraktor",
        title: "Uraian Pekerjaan",
        rabAmount: "Nilai SPK (RAB)",
        progressPct: "Progres Fisik (%)",
        startDate: "Tanggal Mulai",
        targetEndDate: "Target Selesai",
        status: "Status SPK",
      };
      exportToCsv(filteredProduction, headers, `Laporan_Produksi_${projectName.replace(/\s+/g, "_")}`);
    }
  };

  // Filtration
  const filteredUnits = unitData.filter(item => 
    item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.block.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.cluster.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSales = salesData.filter(item => 
    item.bookingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.unitCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProduction = productionData.filter(item => 
    item.spkNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.unitCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6">
        {/* Header Skeleton */}
        <div className="h-28 rounded-2xl bg-[#DDE8D8]/40 animate-pulse" />
        {/* Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-white border border-[#D6DED2] animate-pulse shadow-sage" />
          ))}
        </div>
        {/* Chart Skeleton */}
        <div className="h-72 rounded-2xl bg-white border border-[#D6DED2] animate-pulse shadow-sage" />
      </div>
    );
  }

  // Chart data with gradient color assignment
  const chartData = report
    ? [
        { name: t("reports.chart_income"), Nominal: report.totalIncome, type: "income" },
        { name: t("reports.chart_expense"), Nominal: report.totalExpense, type: "expense" },
        { name: t("reports.chart_net"), Nominal: report.netCashFlow, type: "net" },
      ]
    : [];

  const chartColorMap: Record<string, string> = {
    income: "#4F6F52",
    expense: "#D77A7A",
    net: "#8FAF9A",
  };

  return (
    <div className="flex flex-col gap-6 print:p-0 print:bg-white">
      
      {/* ── PREMIUM GRADIENT HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6 print:hidden">
        <div className="absolute -top-8 -right-8 h-36 w-36 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 h-24 w-24 rounded-full bg-[#4F6F52]/6 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#243028] tracking-tight"><Translate namespace="reports" translationKey="title" /></h1>
              <p className="text-sm text-[#66736A] mt-0.5"><Translate namespace="reports" translationKey="subtitle" /></p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-[240px] flex-shrink-0">
              <Select value={selectedProjectId} onValueChange={handleProjectChange}>
                <SelectTrigger className="w-full bg-white border-[#D6DED2] text-xs font-semibold text-[#243028] h-10 rounded-xl shadow-sage focus:ring-[#8FAF9A]">
                  <SelectValue placeholder={t("reports.sel_project")}>
                    {selectedProjectId === "all"
                      ? t("reports.all_projects")
                      : projects.find(p => p.id === selectedProjectId)?.name || selectedProjectId}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">{t("reports.all_projects")}</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeTab === "financial" || activeTab === "production" ? (
              <div className="flex gap-2">
                <Button
                  onClick={handlePrint}
                  className="bg-[#4F6F52] hover:bg-[#3D563F] text-white flex items-center gap-2 text-xs font-semibold px-4 h-10 rounded-xl shadow-[0_4px_12px_rgba(79,111,82,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 animate-in fade-in"
                >
                  <Printer className="h-4 w-4" /> {t("reports.btn_print")}
                </Button>
                {activeTab === "production" && (
                  <Button
                    onClick={handleExportExcel}
                    className="bg-[#4F6F52] hover:bg-[#3D563F] text-white flex items-center gap-2 text-xs font-semibold px-4 h-10 rounded-xl shadow-[0_4px_12px_rgba(79,111,82,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                  >
                    <FileSpreadsheet className="h-4 w-4" /> {t("reports.btn_export")}
                  </Button>
                )}
              </div>
            ) : (
              <Button
                onClick={handleExportExcel}
                className="bg-[#4F6F52] hover:bg-[#3D563F] text-white flex items-center gap-2 text-xs font-semibold px-4 h-10 rounded-xl shadow-[0_4px_12px_rgba(79,111,82,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              >
                <FileSpreadsheet className="h-4 w-4" /> {t("reports.btn_export")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── TAB NAVIGATION ── */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full print:hidden">
        <TabsList className="bg-white border border-[#D6DED2] shadow-sage p-1 rounded-2xl flex flex-wrap h-auto gap-1">
          <TabsTrigger
            value="financial"
            className="data-[state=active]:bg-[#4F6F52] data-[state=active]:text-white data-[state=active]:shadow-[0_2px_8px_rgba(79,111,82,0.3)] text-[#66736A] text-xs font-bold rounded-xl px-4 py-2 transition-all duration-200 flex items-center gap-1.5"
          >
            <CircleDollarSign className="h-3.5 w-3.5" /> <Translate namespace="reports" translationKey="tab_finance" />
          </TabsTrigger>
          <TabsTrigger
            value="units"
            className="data-[state=active]:bg-[#4F6F52] data-[state=active]:text-white data-[state=active]:shadow-[0_2px_8px_rgba(79,111,82,0.3)] text-[#66736A] text-xs font-bold rounded-xl px-4 py-2 transition-all duration-200 flex items-center gap-1.5"
          >
            <Building className="h-3.5 w-3.5" /> <Translate namespace="reports" translationKey="tab_units" />
          </TabsTrigger>
          <TabsTrigger
            value="sales"
            className="data-[state=active]:bg-[#4F6F52] data-[state=active]:text-white data-[state=active]:shadow-[0_2px_8px_rgba(79,111,82,0.3)] text-[#66736A] text-xs font-bold rounded-xl px-4 py-2 transition-all duration-200 flex items-center gap-1.5"
          >
            <Activity className="h-3.5 w-3.5" /> <Translate namespace="reports" translationKey="tab_sales" />
          </TabsTrigger>
          <TabsTrigger
            value="production"
            className="data-[state=active]:bg-[#4F6F52] data-[state=active]:text-white data-[state=active]:shadow-[0_2px_8px_rgba(79,111,82,0.3)] text-[#66736A] text-xs font-bold rounded-xl px-4 py-2 transition-all duration-200 flex items-center gap-1.5"
          >
            <Wrench className="h-3.5 w-3.5" /> <Translate namespace="reports" translationKey="tab_production" />
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── MAIN CONTENT ── */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 rounded-2xl bg-white border border-[#D6DED2] animate-pulse shadow-sage" />
            ))}
          </div>
          <div className="h-72 rounded-2xl bg-white border border-[#D6DED2] animate-pulse shadow-sage" />
          <div className="h-48 rounded-2xl bg-white border border-[#D6DED2] animate-pulse shadow-sage" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* ════ TAB 1: FINANCIAL ════ */}
          {activeTab === "financial" && report && (
            <div className="space-y-6 animate-in fade-in duration-300">

              {/* Premium KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Pendapatan */}
                <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#4F6F52]" />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider pl-3">{t("reports.kpi_income")}</p>
                      <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-black font-mono text-[#4F6F52] tabular-nums pl-3">
                      {formatRupiah(report.totalIncome)}
                    </h3>
                    <div className="flex items-center gap-1 mt-2 pl-3">
                      <ArrowUpRight className="h-3 w-3 text-[#4F6F52]" />
                      <span className="text-[10px] text-[#8FAF9A] font-medium">{t("reports.kpi_inc_desc")}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Pengeluaran */}
                <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-rose-400" />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider pl-3">{t("reports.kpi_expense")}</p>
                      <div className="h-9 w-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                        <TrendingDown className="h-4 w-4" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-black font-mono text-rose-600 tabular-nums pl-3">
                      {formatRupiah(report.totalExpense)}
                    </h3>
                    <div className="flex items-center gap-1 mt-2 pl-3">
                      <ArrowDownRight className="h-3 w-3 text-rose-500" />
                      <span className="text-[10px] text-rose-400 font-medium">{t("reports.kpi_exp_desc")}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Net Cash */}
                <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#8FAF9A]" />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider pl-3">{t("reports.kpi_net")}</p>
                      <div className="h-9 w-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                        <PiggyBank className="h-4 w-4" />
                      </div>
                    </div>
                    <h3 className={`text-2xl font-black font-mono tabular-nums pl-3 ${report.netCashFlow >= 0 ? "text-[#4F6F52]" : "text-rose-600"}`}>
                      {formatRupiah(report.netCashFlow)}
                    </h3>
                    <div className="flex items-center gap-1 mt-2 pl-3">
                      <CircleDollarSign className="h-3 w-3 text-[#8FAF9A]" />
                      <span className="text-[10px] text-[#8FAF9A] font-medium">{t("reports.kpi_net_desc")}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Chart + Account Balances */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Gradient Bar Chart */}
                <Card className="bg-white border-[#D6DED2] lg:col-span-2 shadow-sage print:shadow-none">
                  <CardHeader className="pb-2 border-b border-[#D6DED2]">
                    <CardTitle className="text-sm font-bold text-[#243028] flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-[#8FAF9A]" />
                      {t("reports.chart_title")}
                    </CardTitle>
                    <CardDescription className="text-xs text-[#66736A]">{t("reports.chart_desc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="w-full min-w-0 pt-4">
                    <div style={{ height: 260, minHeight: 0, minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height={260} minWidth={0}>
                      <BarChart data={chartData} barSize={52}>
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
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.type === "income" ? "url(#gradIncome)" : entry.type === "expense" ? "url(#gradExpense)" : "url(#gradNet)"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Account Balances Glassmorphic */}
                <Card className="bg-white border-[#D6DED2] shadow-sage">
                  <CardHeader className="pb-2 border-b border-[#D6DED2]">
                    <CardTitle className="text-sm font-bold text-[#243028] flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-[#8FAF9A]" />
                      {t("reports.wallet_title")}
                    </CardTitle>
                    <CardDescription className="text-xs text-[#66736A]">{t("reports.wallet_desc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5 pt-4">
                    {report.accounts.length === 0 ? (
                      <div className="py-8 flex flex-col items-center gap-2">
                        <Wallet className="h-8 w-8 text-[#D6DED2]" />
                        <p className="text-xs text-[#A8B0AA] text-center">{t("reports.wallet_empty")}</p>
                      </div>
                    ) : (
                      report.accounts.map((acc: any) => (
                        <div key={acc.id} className="flex justify-between items-center p-3 bg-[#DDE8D8]/30 border border-[#8FAF9A]/20 rounded-xl hover:bg-[#DDE8D8]/50 transition-colors duration-150">
                          <div>
                            <p className="text-xs font-bold text-[#243028]">{acc.name}</p>
                            <p className="text-[9px] text-[#8FAF9A] uppercase font-mono font-semibold tracking-wider mt-0.5">{acc.type}</p>
                          </div>
                          <span className="font-mono font-bold text-xs text-[#4F6F52] tabular-nums">
                            {formatRupiah(acc.openingBalance)}
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Category Breakdown + Recent Transactions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Expenses */}
                <Card className="bg-white border-[#D6DED2] shadow-sage">
                  <CardHeader className="pb-3 border-b border-[#D6DED2]">
                    <CardTitle className="text-sm font-bold text-[#243028] flex items-center gap-2">
                      <Download className="h-4 w-4 text-[#8FAF9A]" /> {t("reports.cat_title")}
                    </CardTitle>
                    <CardDescription className="text-xs text-[#66736A]">{t("reports.cat_desc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#F7F8F3]/70 border-b border-[#D6DED2]">
                          <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.cat_col_name")}</TableHead>
                          <TableHead className="text-right text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.cat_col_total")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.categoryExpenses.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="py-12 text-center">
                              <div className="flex flex-col items-center gap-3">
                                <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                                  <CircleDollarSign className="h-8 w-8 text-[#4F6F52]" />
                                </div>
                                <div>
                                  <p className="font-semibold text-[#243028] text-sm">{t("reports.cat_empty_title")}</p>
                                  <p className="text-xs text-[#66736A] mt-1">{t("reports.cat_empty_desc")}</p>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          report.categoryExpenses.map((cat: any) => (
                            <TableRow key={cat.categoryId} className="hover:bg-[#F7F8F3]/60 transition-colors border-b border-[#D6DED2]/50">
                              <TableCell className="text-xs font-semibold text-[#243028] py-3">{cat.categoryName}</TableCell>
                              <TableCell className="text-right font-mono font-bold text-xs text-rose-600 tabular-nums py-3">
                                {formatRupiah(cat.amount)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card className="bg-white border-[#D6DED2] shadow-sage">
                  <CardHeader className="pb-3 border-b border-[#D6DED2]">
                    <CardTitle className="text-sm font-bold text-[#243028] flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[#8FAF9A]" /> {t("reports.trx_title")}
                    </CardTitle>
                    <CardDescription className="text-xs text-[#66736A]">{t("reports.trx_desc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#F7F8F3]/70 border-b border-[#D6DED2]">
                          <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.trx_col_code")}</TableHead>
                          <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.trx_col_desc")}</TableHead>
                          <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.trx_col_type")}</TableHead>
                          <TableHead className="text-right text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.trx_col_amount")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.recentTransactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="py-12 text-center">
                              <div className="flex flex-col items-center gap-3">
                                <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                                  <TrendingUp className="h-8 w-8 text-[#4F6F52]" />
                                </div>
                                <div>
                                  <p className="font-semibold text-[#243028] text-sm">{t("reports.trx_empty_title")}</p>
                                  <p className="text-xs text-[#66736A] mt-1">{t("reports.trx_empty_desc")}</p>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          report.recentTransactions.map((trx: any) => (
                            <TableRow key={trx.id} className="hover:bg-[#F7F8F3]/60 transition-colors border-b border-[#D6DED2]/50">
                              <TableCell className="font-mono text-[11px] font-semibold text-[#4F6F52] py-3">{trx.transactionNumber}</TableCell>
                              <TableCell className="text-xs text-[#243028] max-w-[120px] truncate py-3">{trx.description}</TableCell>
                              <TableCell className="py-3">
                                <Badge
                                  className={
                                    trx.type === "income"
                                      ? "bg-[#DDE8D8] text-[#4F6F52] border-[#8FAF9A]/30 hover:bg-[#DDE8D8] text-[10px]"
                                      : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50 text-[10px]"
                                  }
                                >
                                  {trx.type === "income" ? t("reports.trx_type_in") : t("reports.trx_type_out")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-xs text-[#243028] tabular-nums py-3">
                                {formatRupiah(trx.amount)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ════ TAB 2: UNITS ════ */}
          {activeTab === "units" && (
            <Card className="bg-white border-[#D6DED2] shadow-sage animate-in fade-in duration-300">
              <CardHeader className="pb-3 border-b border-[#D6DED2] bg-[#F7F8F3]/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-sm font-bold text-[#243028]">{t("reports.unit_title")}</CardTitle>
                    <CardDescription className="text-xs text-[#66736A]">{t("reports.unit_desc")}</CardDescription>
                  </div>
                  <div className="flex items-center gap-3 print:hidden">
                    <div className="relative w-[220px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8FAF9A]" />
                      <Input
                        placeholder={t("reports.unit_search_ph")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 bg-white border-[#D6DED2] text-xs h-9 rounded-xl"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "all")}>
                      <SelectTrigger className="w-[140px] bg-white border-[#D6DED2] text-xs h-9 rounded-xl">
                        <SelectValue placeholder={t("reports.filter_all_status")}>
                          {statusFilter === "all" && t("reports.filter_all_status")}
                          {statusFilter === "belum_siap" && "Belum Siap"}
                          {statusFilter === "available" && "Tersedia"}
                          {statusFilter === "booking" && "Booking"}
                          {statusFilter === "kpr_process" && "Proses KPR"}
                          {statusFilter === "sold" && "Terjual"}
                          {statusFilter === "construction" && "Proses Bangun"}
                          {statusFilter === "construction_done" && "Selesai Bangun"}
                          {statusFilter === "overdue" && "Overdue"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">{t("reports.filter_all_status")}</SelectItem>
                        <SelectItem value="belum_siap" className="text-xs">Belum Siap</SelectItem>
                        <SelectItem value="available" className="text-xs">Tersedia</SelectItem>
                        <SelectItem value="booking" className="text-xs">Booking</SelectItem>
                        <SelectItem value="kpr_process" className="text-xs">Proses KPR</SelectItem>
                        <SelectItem value="sold" className="text-xs">Terjual</SelectItem>
                        <SelectItem value="construction" className="text-xs">Proses Bangun</SelectItem>
                        <SelectItem value="construction_done" className="text-xs">Selesai Bangun</SelectItem>
                        <SelectItem value="overdue" className="text-xs">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F7F8F3]/70 border-b border-[#D6DED2]">
                      <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.unit_col_code")}</TableHead>
                      <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.unit_col_block")}</TableHead>
                      <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.unit_col_cluster")}</TableHead>
                      <TableHead className="text-right text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.unit_col_price")}</TableHead>
                      <TableHead className="text-center text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.unit_col_status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                              <Building className="h-8 w-8 text-[#4F6F52]" />
                            </div>
                            <div>
                              <p className="font-semibold text-[#243028] text-sm">{t("reports.unit_empty_title")}</p>
                              <p className="text-xs text-[#66736A] mt-1">{t("reports.unit_empty_desc")}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUnits.map((item) => (
                        <TableRow key={item.id} className="hover:bg-[#F7F8F3]/60 transition-colors border-b border-[#D6DED2]/50">
                          <TableCell className="font-mono text-xs font-bold text-[#4F6F52] py-3">{item.code}</TableCell>
                          <TableCell className="text-xs text-[#243028] py-3">{item.block}</TableCell>
                          <TableCell className="text-xs text-[#66736A] py-3">{item.cluster}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-[#243028] tabular-nums py-3">
                            {formatRupiah(item.price)}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <Badge
                              className={
                                item.status === "Tersedia"
                                  ? "bg-[#DDE8D8] text-[#4F6F52] border-[#8FAF9A]/30 hover:bg-[#DDE8D8] text-[10px]"
                                  : item.status === "Belum Siap"
                                  ? "bg-white text-gray-500 border border-gray-300 hover:bg-gray-50 text-[10px]"
                                  : item.status === "Booking"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50 text-[10px]"
                                  : item.status === "Proses KPR"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-50 text-[10px]"
                                  : item.status === "Terjual"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-50 text-[10px]"
                                  : "bg-[#F7F8F3] text-[#66736A] border-[#D6DED2] hover:bg-[#F7F8F3] text-[10px]"
                              }
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ════ TAB 3: SALES / MARKETING ════ */}
          {activeTab === "sales" && (
            <Card className="bg-white border-[#D6DED2] shadow-sage animate-in fade-in duration-300">
              <CardHeader className="pb-3 border-b border-[#D6DED2] bg-[#F7F8F3]/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-sm font-bold text-[#243028]">{t("reports.sales_title")}</CardTitle>
                    <CardDescription className="text-xs text-[#66736A]">{t("reports.sales_desc")}</CardDescription>
                  </div>
                  <div className="flex items-center gap-3 print:hidden">
                    <div className="relative w-[220px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8FAF9A]" />
                      <Input
                        placeholder={t("reports.sales_search_ph")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 bg-white border-[#D6DED2] text-xs h-9 rounded-xl"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "all")}>
                      <SelectTrigger className="w-[140px] bg-white border-[#D6DED2] text-xs h-9 rounded-xl">
                        <SelectValue placeholder={t("reports.filter_all_status")}>
                          {statusFilter === "all" && t("reports.filter_all_status")}
                          {statusFilter === "active" && t("reports.sales_filter_active")}
                          {statusFilter === "completed" && t("reports.sales_filter_done")}
                          {statusFilter === "cancelled" && t("reports.sales_filter_cancel")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">{t("reports.filter_all_status")}</SelectItem>
                        <SelectItem value="active" className="text-xs">{t("reports.sales_filter_active")}</SelectItem>
                        <SelectItem value="completed" className="text-xs">{t("reports.sales_filter_done")}</SelectItem>
                        <SelectItem value="cancelled" className="text-xs">{t("reports.sales_filter_cancel")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F7F8F3]/70 border-b border-[#D6DED2]">
                      <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.sales_col_book")}</TableHead>
                      <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.sales_col_cust")}</TableHead>
                      <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.sales_col_unit")}</TableHead>
                      <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.sales_col_date")}</TableHead>
                      <TableHead className="text-right text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.sales_col_fee")}</TableHead>
                      <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.sales_col_scheme")}</TableHead>
                      <TableHead className="text-center text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.sales_col_status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                              <Activity className="h-8 w-8 text-[#4F6F52]" />
                            </div>
                            <div>
                              <p className="font-semibold text-[#243028] text-sm">{t("reports.sales_empty_title")}</p>
                              <p className="text-xs text-[#66736A] mt-1">{t("reports.sales_empty_desc")}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSales.map((item) => (
                        <TableRow key={item.id} className="hover:bg-[#F7F8F3]/60 transition-colors border-b border-[#D6DED2]/50">
                          <TableCell className="font-mono text-xs font-semibold text-[#4F6F52] py-3">{item.bookingNumber}</TableCell>
                          <TableCell className="py-3">
                            <p className="text-xs font-bold text-[#243028]">{item.customerName}</p>
                            <p className="text-[9px] text-[#A8B0AA] font-mono mt-0.5">{item.customerPhone}</p>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-[#243028] py-3">{item.unitCode}</TableCell>
                          <TableCell className="text-xs text-[#66736A] font-mono py-3">{item.bookingDate}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-[#243028] tabular-nums py-3">
                            {formatRupiah(item.bookingFee)}
                          </TableCell>
                          <TableCell className="text-xs text-[#66736A] font-semibold py-3">{item.paymentScheme}</TableCell>
                          <TableCell className="text-center py-3">
                            <Badge
                              className={
                                item.status === "Aktif"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-50 text-[10px]"
                                  : item.status === "Selesai"
                                  ? "bg-[#DDE8D8] text-[#4F6F52] border-[#8FAF9A]/30 hover:bg-[#DDE8D8] text-[10px]"
                                  : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-50 text-[10px]"
                              }
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ════ TAB 4: PRODUCTION / SPK ════ */}
          {activeTab === "production" && (
            <Card className="bg-white border-[#D6DED2] shadow-sage animate-in fade-in duration-300">
              <CardHeader className="pb-3 border-b border-[#D6DED2] bg-[#F7F8F3]/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-sm font-bold text-[#243028]">{t("reports.prod_title")}</CardTitle>
                    <CardDescription className="text-xs text-[#66736A]">{t("reports.prod_desc")}</CardDescription>
                  </div>
                  <div className="flex items-center gap-3 print:hidden">
                    <div className="relative w-[220px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8FAF9A]" />
                      <Input
                        placeholder={t("reports.prod_search_ph")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 bg-white border-[#D6DED2] text-xs h-9 rounded-xl"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "all")}>
                      <SelectTrigger className="w-[140px] bg-white border-[#D6DED2] text-xs h-9 rounded-xl">
                        <SelectValue placeholder={t("reports.filter_all_status")}>
                          {statusFilter === "all" && t("reports.filter_all_status")}
                          {statusFilter === "draft" && t("reports.prod_filter_draft")}
                          {statusFilter === "active" && t("reports.prod_filter_active")}
                          {statusFilter === "completed" && t("reports.prod_filter_done")}
                          {statusFilter === "overdue" && t("reports.prod_filter_overdue")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">{t("reports.filter_all_status")}</SelectItem>
                        <SelectItem value="draft" className="text-xs">{t("reports.prod_filter_draft")}</SelectItem>
                        <SelectItem value="active" className="text-xs">{t("reports.prod_filter_active")}</SelectItem>
                        <SelectItem value="completed" className="text-xs">{t("reports.prod_filter_done")}</SelectItem>
                        <SelectItem value="overdue" className="text-xs">{t("reports.prod_filter_overdue")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F7F8F3]/70 border-b border-[#D6DED2]">
                      <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.prod_col_spk")}</TableHead>
                      <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.prod_col_unit")}</TableHead>
                      <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.prod_col_vendor")}</TableHead>
                      <TableHead className="text-right text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.prod_col_rab")}</TableHead>
                      <TableHead className="text-center text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.prod_col_prog")}</TableHead>
                      <TableHead className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.prod_col_target")}</TableHead>
                      <TableHead className="text-center text-[10px] font-bold text-[#66736A] uppercase tracking-wider">{t("reports.prod_col_status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProduction.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                              <Wrench className="h-8 w-8 text-[#4F6F52]" />
                            </div>
                            <div>
                              <p className="font-semibold text-[#243028] text-sm">{t("reports.prod_empty_title")}</p>
                              <p className="text-xs text-[#66736A] mt-1">{t("reports.prod_empty_desc")}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProduction.map((item) => (
                        <TableRow key={item.id} className="hover:bg-[#F7F8F3]/60 transition-colors border-b border-[#D6DED2]/50">
                          <TableCell className="font-mono text-xs font-semibold text-[#4F6F52] py-3">{item.spkNumber}</TableCell>
                          <TableCell className="py-3">
                            <p className="text-xs font-bold text-[#243028]">{item.title}</p>
                            <p className="text-[9px] text-[#A8B0AA] font-mono mt-0.5">Kavling: {item.unitCode}</p>
                          </TableCell>
                          <TableCell className="text-xs text-[#243028] py-3">{item.vendorName}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-[#243028] tabular-nums py-3">
                            {formatRupiah(item.rabAmount)}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-mono font-bold text-xs text-[#4F6F52]">{item.progressPct}%</span>
                              <div className="w-12 h-1 bg-[#D6DED2] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#4F6F52] rounded-full"
                                  style={{ width: `${item.progressPct}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-[#66736A] font-mono py-3">{item.targetEndDate}</TableCell>
                          <TableCell className="text-center py-3">
                            <Badge
                              className={
                                item.status === "Aktif"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-50 text-[10px]"
                                  : item.status === "Selesai"
                                  ? "bg-[#DDE8D8] text-[#4F6F52] border-[#8FAF9A]/30 hover:bg-[#DDE8D8] text-[10px]"
                                  : item.status === "Draft"
                                  ? "bg-[#F7F8F3] text-[#66736A] border-[#D6DED2] hover:bg-[#F7F8F3] text-[10px]"
                                  : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-50 text-[10px]"
                              }
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

        </div>
      )}

    </div>
  );
}
