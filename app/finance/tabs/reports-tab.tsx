"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FinanceTableState } from "@/components/finance/finance-table-state";
import { FinanceTableScroll } from "@/components/finance/finance-table-scroll";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { BudgetUsageIndicator } from "@/components/finance/budget-usage-indicator";
import { CashFlowChartSkeleton } from "@/components/finance/cash-flow-chart";
import type { CashFlowDataPoint } from "@/components/finance/cash-flow-chart";
import {
  computeFilteredBudgetTotals,
  type BudgetActualUsage,
  type BudgetEntity,
  type BudgetLineDetail,
} from "@/lib/finance-budget-summary";
import {
  getBudgetStatusLabel,
  getInvoiceStatusLabel,
  getTransactionTypeLabel,
} from "@/lib/label-helpers";
import { exportFinanceCsv } from "@/lib/finance-csv-export";
import {
  Download,
  FileBarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── CashFlowChart loaded via next/dynamic, ssr: false ───────────────────────
const CashFlowChart = dynamic(
  () => import("@/components/finance/cash-flow-chart").then((mod) => mod.CashFlowChart),
  {
    ssr: false,
    loading: () => <CashFlowChartSkeleton />,
  },
);

// ==========================================================================
// Types — read-only projections of already-loaded finance data
// ==========================================================================

interface ReportTransaction {
  id: string;
  transactionNumber: string;
  projectId: string;
  accountId: string;
  categoryId: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  transactionDate: Date;
  approvalStatus:
    | "not_required"
    | "pending"
    | "approved"
    | "rejected"
    | "insufficient_balance";
  projectName: string;
  accountName: string;
  categoryName: string;
  invoiceNumber?: string | null;
}

interface ReportInvoice {
  id: string;
  invoiceNumber: string;
  projectId: string;
  customerId: string | null;
  type: "booking_fee" | "dp" | "installment" | "other";
  amount: number;
  dueDate: Date | null;
  status: "unpaid" | "partial" | "paid" | "cancelled";
  createdAt: Date;
  projectName: string;
  customerName: string | null;
  totalPaidVerified?: number;
  remainingBalance?: number;
}

interface ReportAccount {
  id: string;
  code: string;
  name: string;
  type: "cash" | "bank" | "receivable" | "payable" | "income" | "expense";
  status: "active" | "inactive";
}

interface ReportProject {
  id: string;
  name: string;
  code: string;
}

interface ReportsTabProps {
  transactions: ReportTransaction[];
  invoices: ReportInvoice[];
  budgets: BudgetEntity[];
  budgetLines?: BudgetLineDetail[];
  budgetActualUsage?: BudgetActualUsage[];
  accounts: ReportAccount[];
  projects: ReportProject[];
}

// ==========================================================================
// Constants & helpers
// ==========================================================================

type ReportType =
  | "ringkasan-kas"
  | "statement-akun"
  | "piutang"
  | "pengeluaran"
  | "budget-actual";

const REPORT_TYPES: Array<{ value: ReportType; label: string; desc: string }> = [
  {
    value: "ringkasan-kas",
    label: "Ringkasan Kas",
    desc: "Pemasukan dan pengeluaran final pada rentang periode.",
  },
  {
    value: "statement-akun",
    label: "Statement per Akun",
    desc: "Mutasi transaksi final untuk satu akun kas/bank.",
  },
  {
    value: "piutang",
    label: "Laporan Piutang",
    desc: "Invoice belum lunas beserta sisa tagihan terverifikasi.",
  },
  {
    value: "pengeluaran",
    label: "Laporan Pengeluaran",
    desc: "Transaksi pengeluaran yang telah disetujui.",
  },
  {
    value: "budget-actual",
    label: "Budget vs Actual",
    desc: "Alokasi anggaran dibanding realisasi aktual.",
  },
];

const PAGE_SIZE = 50;
const MAX_PERIOD_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ALL = "all";
const EM_DASH = "\u2014";

function formatRupiah(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}Rp ${Math.abs(Math.round(n)).toLocaleString("id-ID")}`;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return EM_DASH;
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Inclusive period check. Null bounds mean unbounded on that side. */
function inPeriod(
  date: Date | null | undefined,
  start: Date | null,
  end: Date | null,
): boolean {
  if (!start && !end) return true;
  if (!date) return false;
  const d = new Date(date).getTime();
  if (start && d < start.getTime()) return false;
  if (end) {
    // Include the whole end day.
    const endInclusive = end.getTime() + MS_PER_DAY - 1;
    if (d > endInclusive) return false;
  }
  return true;
}

// ==========================================================================
// Applied filter snapshot
// ==========================================================================

interface AppliedFilters {
  reportType: ReportType;
  projectId: string;
  accountId: string;
  periodStart: Date | null;
  periodEnd: Date | null;
}

interface LedgerRow {
  id: string;
  transactionNumber: string;
  transactionDate: Date;
  type: "income" | "expense";
  categoryName: string;
  accountName: string;
  reference: string | null;
  debit: number;
  credit: number;
  saldo: number;
}

/** Keep report debit/kredit rows aligned with the Ledger tab. */
export function getReportDebitCredit(
  transaction: Pick<ReportTransaction, "type" | "amount">,
) {
  const cashDelta = transaction.type === "income"
    ? transaction.amount
    : -transaction.amount;

  return {
    debit: cashDelta > 0 ? cashDelta : 0,
    credit: cashDelta < 0 ? Math.abs(cashDelta) : 0,
  };
}

interface PiutangRow {
  id: string;
  invoiceNumber: string;
  dueDate: Date | null;
  customerName: string | null;
  projectName: string;
  total: number;
  paid: number;
  remaining: number;
  status: ReportInvoice["status"];
}

interface ExpenseRow {
  id: string;
  transactionNumber: string;
  transactionDate: Date;
  categoryName: string;
  accountName: string;
  description: string;
  amount: number;
}

interface BudgetRow {
  id: string;
  name: string;
  projectName: string;
  periodStart: Date;
  periodEnd: Date;
  allocated: number;
  actual: number;
  variance: number;
  absorption: number;
  isOverBudget: boolean;
  status: BudgetEntity["status"];
}

type ReportData =
  | {
      kind: "ledger";
      summary: { totalIn: number; totalOut: number; ending: number };
      rows: LedgerRow[];
    }
  | {
      kind: "piutang";
      summary: { total: number; paid: number; remaining: number };
      rows: PiutangRow[];
    }
  | {
      kind: "pengeluaran";
      summary: { total: number; count: number };
      rows: ExpenseRow[];
    }
  | {
      kind: "budget";
      summary: {
        totalAllocated: number;
        totalActual: number;
        remaining: number;
        absorption: number;
        isOverBudget: boolean;
      };
      rows: BudgetRow[];
    };

// ==========================================================================
// Component
// ==========================================================================

export function ReportsTab({
  transactions,
  invoices,
  budgets,
  budgetLines = [],
  budgetActualUsage = [],
  accounts,
  projects,
}: ReportsTabProps) {
  // Draft filter state (edited by the user before "Tampilkan").
  const [reportType, setReportType] = React.useState<ReportType | "">("");
  const [projectId, setProjectId] = React.useState<string>(ALL);
  const [accountId, setAccountId] = React.useState<string>(ALL);
  const [startStr, setStartStr] = React.useState<string>("");
  const [endStr, setEndStr] = React.useState<string>("");

  // Applied snapshot + loading + pagination.
  const [applied, setApplied] = React.useState<AppliedFilters | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [reportPage, setReportPage] = React.useState(1);

  const cashBankAccounts = React.useMemo(
    () =>
      accounts.filter(
        (a) => (a.type === "cash" || a.type === "bank") && a.status === "active",
      ),
    [accounts],
  );

  // --- Period validation (max 365 days) ---
  const start = parseDateInput(startStr);
  const end = parseDateInput(endStr);
  const periodInvalidOrder = start && end ? start.getTime() > end.getTime() : false;
  const periodTooLong =
    start && end
      ? (end.getTime() - start.getTime()) / MS_PER_DAY > MAX_PERIOD_DAYS
      : false;
  const accountRequiredMissing =
    reportType === "statement-akun" && accountId === ALL;

  const periodError = periodInvalidOrder
    ? "Tanggal akhir tidak boleh sebelum tanggal mulai."
    : periodTooLong
      ? "Rentang periode maksimum 365 hari."
      : null;

  const canApply =
    reportType !== "" && !periodError && !accountRequiredMissing;

  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name ?? EM_DASH;
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? EM_DASH;

  const handleApply = () => {
    if (!canApply) return;
    const snapshot: AppliedFilters = {
      reportType: reportType as ReportType,
      projectId,
      accountId,
      periodStart: start,
      periodEnd: end,
    };
    setLoading(true);
    setReportPage(1);
    // Brief loading state for read-only recompute (Req 12.3).
    window.setTimeout(() => {
      setApplied(snapshot);
      setLoading(false);
    }, 300);
  };

  // --- Report computation from the applied snapshot (read-only) ---
  const report: ReportData | null = React.useMemo(() => {
    if (!applied) return null;
    const { reportType: rt, projectId: pid, accountId: aid, periodStart, periodEnd } =
      applied;
    const matchProject = (id: string) => pid === ALL || id === pid;

    if (rt === "ringkasan-kas" || rt === "statement-akun") {
      const finals = transactions
        .filter((t) => {
          const isFinal =
            (t.type === "income" &&
              (t.approvalStatus === "not_required" ||
                t.approvalStatus === "approved")) ||
            (t.type === "expense" && t.approvalStatus === "approved");
          if (!isFinal) return false;
          if (!matchProject(t.projectId)) return false;
          if (rt === "statement-akun" && aid !== ALL && t.accountId !== aid)
            return false;
          if (rt === "ringkasan-kas" && aid !== ALL && t.accountId !== aid)
            return false;
          return inPeriod(t.transactionDate, periodStart, periodEnd);
        })
        // Ascending for cumulative running balance.
        .sort(
          (a, b) =>
            new Date(a.transactionDate).getTime() -
            new Date(b.transactionDate).getTime(),
        );

      let running = 0;
      let totalIn = 0;
      let totalOut = 0;
      const ascRows: LedgerRow[] = finals.map((t) => {
        const { debit, credit } = getReportDebitCredit(t);
        running += debit - credit;
        totalIn += debit;
        totalOut += credit;
        return {
          id: t.id,
          transactionNumber: t.transactionNumber,
          transactionDate: t.transactionDate,
          type: t.type,
          categoryName: t.categoryName,
          accountName: t.accountName,
          reference: t.invoiceNumber ?? null,
          debit,
          credit,
          saldo: running,
        };
      });
      // Display newest-first while keeping the computed running balance.
      const rows = [...ascRows].reverse();
      return {
        kind: "ledger",
        summary: { totalIn, totalOut, ending: totalIn - totalOut },
        rows,
      };
    }

    if (rt === "piutang") {
      const rows: PiutangRow[] = invoices
        .filter((i) => {
          const activeStatus = i.status === "unpaid" || i.status === "partial";
          if (!activeStatus) return false;
          if (!matchProject(i.projectId)) return false;
          const dateForPeriod = i.dueDate ?? i.createdAt;
          return inPeriod(dateForPeriod, periodStart, periodEnd);
        })
        .sort((a, b) => {
          const da = (a.dueDate ?? a.createdAt).getTime?.() ?? 0;
          const db = (b.dueDate ?? b.createdAt).getTime?.() ?? 0;
          return db - da;
        })
        .map((i) => {
          const paid = i.totalPaidVerified ?? 0;
          const remaining = i.remainingBalance ?? Math.max(0, i.amount - paid);
          return {
            id: i.id,
            invoiceNumber: i.invoiceNumber,
            dueDate: i.dueDate,
            customerName: i.customerName,
            projectName: i.projectName,
            total: i.amount,
            paid,
            remaining,
            status: i.status,
          };
        });
      const total = rows.reduce((s, r) => s + r.total, 0);
      const paid = rows.reduce((s, r) => s + r.paid, 0);
      const remaining = rows.reduce((s, r) => s + r.remaining, 0);
      return { kind: "piutang", summary: { total, paid, remaining }, rows };
    }

    if (rt === "pengeluaran") {
      const rows: ExpenseRow[] = transactions
        .filter((t) => {
          if (t.type !== "expense" || t.approvalStatus !== "approved")
            return false;
          if (!matchProject(t.projectId)) return false;
          if (aid !== ALL && t.accountId !== aid) return false;
          return inPeriod(t.transactionDate, periodStart, periodEnd);
        })
        .sort(
          (a, b) =>
            new Date(b.transactionDate).getTime() -
            new Date(a.transactionDate).getTime(),
        )
        .map((t) => ({
          id: t.id,
          transactionNumber: t.transactionNumber,
          transactionDate: t.transactionDate,
          categoryName: t.categoryName,
          accountName: t.accountName,
          description: t.description,
          amount: t.amount,
        }));
      const total = rows.reduce((s, r) => s + r.amount, 0);
      return { kind: "pengeluaran", summary: { total, count: rows.length }, rows };
    }

    // budget-actual
    const totals = computeFilteredBudgetTotals(budgets, budgetLines, budgetActualUsage, {
      projectId: pid === ALL ? null : pid,
      periodStart,
      periodEnd,
    });

    const actualByBudget = new Map<string, number>();
    for (const u of budgetActualUsage) {
      actualByBudget.set(
        u.budgetId,
        (actualByBudget.get(u.budgetId) ?? 0) + u.actualAmount,
      );
    }

    const activeFiltered = budgets.filter((b) => {
      if (b.status !== "active") return false;
      if (!matchProject(b.projectId)) return false;
      if (periodStart || periodEnd) {
        const fs = periodStart ?? new Date(0);
        const fe = periodEnd ?? new Date(8640000000000000);
        return (
          b.periodStart.getTime() <= fe.getTime() &&
          fs.getTime() <= b.periodEnd.getTime()
        );
      }
      return true;
    });

    const rows: BudgetRow[] = activeFiltered
      .map((b) => {
        const actual = actualByBudget.get(b.id) ?? 0;
        const allocated = b.totalAmount;
        const absorption =
          allocated === 0 ? 0 : Math.min(100, (actual / allocated) * 100);
        return {
          id: b.id,
          name: b.name,
          projectName: (b as unknown as { projectName?: string }).projectName ??
            projectName(b.projectId),
          periodStart: b.periodStart,
          periodEnd: b.periodEnd,
          allocated,
          actual,
          variance: allocated - actual,
          absorption,
          isOverBudget: actual > allocated,
          status: b.status,
        };
      })
      .sort((a, b) => b.actual - a.actual);

    return {
      kind: "budget",
      summary: {
        totalAllocated: totals.totalAllocated,
        totalActual: totals.totalUsedActual,
        remaining: totals.remaining,
        absorption: Math.min(100, totals.absorptionPercentage),
        isOverBudget: totals.isOverBudget,
      },
      rows,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, transactions, invoices, budgets, budgetLines, budgetActualUsage]);

  // --- Pagination window ---
  const totalRows = report ? report.rows.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const currentPage = Math.min(reportPage, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;

  // --- CashFlowChart data (Req 9.5–9.7) ---
  const chartData: CashFlowDataPoint[] = React.useMemo(() => {
    if (!applied || (applied.reportType !== "ringkasan-kas" && applied.reportType !== "statement-akun")) return [];
    if (!report || report.kind !== "ledger") return [];
    // Group final transactions by month
    const { periodStart: ps, periodEnd: pe, projectId: pid, accountId: aid, reportType: rt } = applied;
    const matchProject = (id: string) => pid === ALL || id === pid;

    const finals = transactions.filter((t) => {
      const isFinal =
        (t.type === "income" && (t.approvalStatus === "not_required" || t.approvalStatus === "approved")) ||
        (t.type === "expense" && t.approvalStatus === "approved");
      if (!isFinal) return false;
      if (!matchProject(t.projectId)) return false;
      if (rt === "statement-akun" && aid !== ALL && t.accountId !== aid) return false;
      if (rt === "ringkasan-kas" && aid !== ALL && t.accountId !== aid) return false;
      return inPeriod(t.transactionDate, ps, pe);
    });

    // Build monthly buckets
    const monthMap = new Map<string, { inflow: number; outflow: number }>();
    for (const t of finals) {
      const d = new Date(t.transactionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthMap.get(key) ?? { inflow: 0, outflow: 0 };
      if (t.type === "income") {
        entry.inflow += t.amount;
      } else {
        entry.outflow += t.amount;
      }
      monthMap.set(key, entry);
    }

    // Sort by key and format period labels
    const sorted = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return sorted.map(([key, { inflow, outflow }]) => {
      const [year, month] = key.split("-");
      const label = `${monthNames[parseInt(month, 10) - 1]} ${year}`;
      return { period: label, inflow, outflow, netFlow: inflow - outflow };
    });
  }, [applied, report, transactions]);

  // --- Dynamic chart title ---
  const chartTitle = React.useMemo(() => {
    if (!applied) return "";
    const typeMeta = REPORT_TYPES.find((r) => r.value === applied.reportType);
    const projLabel = applied.projectId === ALL ? "Semua Perumahan" : projectName(applied.projectId);
    return `${typeMeta?.label ?? "Laporan"} - ${projLabel}`;
  }, [applied, projects]);

  const chartDateRange = React.useMemo(() => {
    if (!applied) return "";
    const s = applied.periodStart ? formatDate(applied.periodStart) : "Awal";
    const e = applied.periodEnd ? formatDate(applied.periodEnd) : "Sekarang";
    return `${s} – ${e}`;
  }, [applied]);

  // --- CSV Export handler (Req 9.4) ---
  const handleExport = React.useCallback(() => {
    if (!applied || !report || report.rows.length === 0) return;
    const rt = applied.reportType;

    // Map report type to CSV report type
    const csvTypeMap: Record<ReportType, "arus-kas" | "piutang" | "pengeluaran" | "realisasi-anggaran" | "buku-kas"> = {
      "ringkasan-kas": "arus-kas",
      "statement-akun": "buku-kas",
      "piutang": "piutang",
      "pengeluaran": "pengeluaran",
      "budget-actual": "realisasi-anggaran",
    };

    const startDate = applied.periodStart
      ? applied.periodStart.toISOString().split("T")[0]
      : "awal";
    const endDate = applied.periodEnd
      ? applied.periodEnd.toISOString().split("T")[0]
      : "sekarang";

    let columns: Array<{ key: string; header: string }> = [];
    let data: Record<string, unknown>[] = [];

    if (report.kind === "ledger") {
      columns = [
        { key: "tanggal", header: "Tanggal" },
        { key: "nomorTransaksi", header: "Nomor Transaksi" },
        { key: "jenis", header: "Jenis" },
        { key: "kategori", header: "Kategori" },
        { key: "akun", header: "Akun" },
        { key: "referensi", header: "Referensi" },
        { key: "debit", header: "Debit" },
        { key: "kredit", header: "Kredit" },
        { key: "saldo", header: "Saldo" },
      ];
      data = report.rows.map((r) => ({
        tanggal: formatDate(r.transactionDate),
        nomorTransaksi: r.transactionNumber,
        jenis: getTransactionTypeLabel(r.type),
        kategori: r.categoryName,
        akun: r.accountName,
        referensi: r.reference || "",
        debit: r.debit || "",
        kredit: r.credit || "",
        saldo: r.saldo,
      }));
    } else if (report.kind === "piutang") {
      columns = [
        { key: "jatuhTempo", header: "Jatuh Tempo" },
        { key: "nomorInvoice", header: "Nomor Invoice" },
        { key: "customer", header: "Customer" },
        { key: "proyek", header: "Proyek" },
        { key: "total", header: "Total" },
        { key: "dibayar", header: "Dibayar" },
        { key: "sisa", header: "Sisa" },
        { key: "status", header: "Status" },
      ];
      data = report.rows.map((r) => ({
        jatuhTempo: formatDate(r.dueDate),
        nomorInvoice: r.invoiceNumber,
        customer: r.customerName || "",
        proyek: r.projectName,
        total: r.total,
        dibayar: r.paid,
        sisa: r.remaining,
        status: getInvoiceStatusLabel(r.status),
      }));
    } else if (report.kind === "pengeluaran") {
      columns = [
        { key: "tanggal", header: "Tanggal" },
        { key: "nomorTransaksi", header: "Nomor Transaksi" },
        { key: "kategori", header: "Kategori" },
        { key: "akun", header: "Akun" },
        { key: "deskripsi", header: "Deskripsi" },
        { key: "nominal", header: "Nominal" },
      ];
      data = report.rows.map((r) => ({
        tanggal: formatDate(r.transactionDate),
        nomorTransaksi: r.transactionNumber,
        kategori: r.categoryName,
        akun: r.accountName,
        deskripsi: r.description,
        nominal: r.amount,
      }));
    } else {
      // budget
      columns = [
        { key: "nama", header: "Nama Anggaran" },
        { key: "proyek", header: "Proyek" },
        { key: "periode", header: "Periode" },
        { key: "anggaran", header: "Anggaran" },
        { key: "realisasi", header: "Realisasi Aktual" },
        { key: "selisih", header: "Selisih" },
        { key: "serapan", header: "Serapan %" },
        { key: "status", header: "Status" },
      ];
      data = report.rows.map((r) => ({
        nama: r.name,
        proyek: r.projectName,
        periode: `${formatDate(r.periodStart)} - ${formatDate(r.periodEnd)}`,
        anggaran: r.allocated,
        realisasi: r.actual,
        selisih: r.variance,
        serapan: `${r.absorption.toFixed(1)}%`,
        status: r.isOverBudget ? "Over Budget" : getBudgetStatusLabel(r.status),
      }));
    }

    exportFinanceCsv({
      reportType: csvTypeMap[rt],
      startDate,
      endDate,
      data,
      columns,
    });
  }, [applied, report]);

  const canExport = !!applied && !!report && report.rows.length > 0;

  const appliedTypeMeta = applied
    ? REPORT_TYPES.find((r) => r.value === applied.reportType)
    : null;

  const filterContext = applied
    ? [
        appliedTypeMeta?.label,
        applied.projectId === ALL ? "Semua Proyek" : projectName(applied.projectId),
        applied.reportType === "statement-akun" || applied.reportType === "pengeluaran"
          ? applied.accountId === ALL
            ? "Semua Akun"
            : accountName(applied.accountId)
          : null,
        applied.periodStart || applied.periodEnd
          ? `${formatDate(applied.periodStart)} – ${formatDate(applied.periodEnd)}`
          : "Semua Periode",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="space-y-6">
      {/* -- FILTER BAR (Req 9.1–9.4) -- */}
      <Card className="bg-card border-input">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" aria-hidden="true" />
            Laporan Statement
          </CardTitle>
          <CardDescription className="text-xs">
            Tampilan read-only dari data keuangan yang sudah tercatat. Pilih jenis
            laporan lalu terapkan filter.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          {/* Report Type Chips (Req 9.2) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Jenis Laporan
            </label>
            <div
              role="group"
              aria-label="Pilih jenis laporan"
              className="flex flex-wrap items-center gap-1.5"
            >
              {REPORT_TYPES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReportType(r.value)}
                  aria-pressed={reportType === r.value}
                  title={r.desc}
                  className={cn(
                    "inline-flex items-center whitespace-nowrap rounded-full px-3.5 py-1 text-xs font-semibold border transition-colors duration-150 min-h-11 cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    reportType === r.value
                      ? "bg-primary text-white border-primary"
                      : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filter row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Project */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Proyek
              </label>
              <Select
                value={projectId}
                onValueChange={(val) => setProjectId(val || ALL)}
                items={[
                  { label: "Semua Proyek", value: ALL },
                  ...projects.map((p) => ({ label: p.name, value: p.id })),
                ]}
              >
                <SelectTrigger className="w-full min-w-0 bg-card border-input">
                  <SelectValue
                    placeholder="Semua Proyek"
                    className="block max-w-full truncate text-left"
                  >
                    {projectId === ALL ? "Semua Proyek" : projectName(projectId)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  <SelectItem value={ALL}>Semua Proyek</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Akun Kas/Bank */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Akun Kas/Bank
                {reportType === "statement-akun" && (
                  <span className="text-destructive"> *</span>
                )}
              </label>
              <Select
                value={accountId}
                onValueChange={(val) => setAccountId(val || ALL)}
                items={[
                  { label: "Semua Akun", value: ALL },
                  ...cashBankAccounts.map((a) => ({ label: a.name, value: a.id })),
                ]}
              >
                <SelectTrigger className="w-full min-w-0 bg-card border-input">
                  <SelectValue
                    placeholder="Semua Akun"
                    className="block max-w-full truncate text-left"
                  >
                    {accountId === ALL ? "Semua Akun" : accountName(accountId)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  <SelectItem value={ALL}>Semua Akun</SelectItem>
                  {cashBankAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Periode */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Periode (maks. 365 hari)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startStr}
                  onChange={(e) => setStartStr(e.target.value)}
                  aria-label="Tanggal mulai"
                  className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <span className="text-muted-foreground text-xs">–</span>
                <input
                  type="date"
                  value={endStr}
                  onChange={(e) => setEndStr(e.target.value)}
                  aria-label="Tanggal akhir"
                  className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
            </div>
          </div>

          {/* Validation + actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-destructive min-h-[1rem]" role="alert">
              {periodError}
              {!periodError && accountRequiredMissing
                ? "Pilih akun kas/bank untuk Statement per Akun."
                : ""}
            </div>
            <div className="flex items-center gap-2">
              {/* Export CSV (Req 9.4) */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canExport}
                onClick={handleExport}
                title={canExport ? "Export laporan ke CSV" : "Belum ada data laporan"}
                aria-label={canExport ? "Export laporan ke CSV" : "Export tidak tersedia — belum ada data laporan"}
                className="gap-1.5 text-xs min-h-11"
              >
                <Download className="h-4 w-4" aria-hidden="true" /> Export
              </Button>
              <Button
                type="button"
                onClick={handleApply}
                disabled={!canApply}
                className="bg-primary hover:bg-[#8FAF9A] text-white text-xs min-h-11"
              >
                Tampilkan Laporan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* -- INITIAL STATE (Req 9.11) -- */}
      {!applied && !loading && (
        <Card className="bg-card border-input">
          <CardContent className="p-0">
            <FinanceTableState
              variant="empty"
              icon={<FileBarChart className="h-6 w-6" />}
              title="Belum ada laporan ditampilkan"
              description="Pilih jenis laporan dan terapkan filter untuk menampilkan data keuangan."
            />
          </CardContent>
        </Card>
      )}

      {/* -- LOADING STATE -- */}
      {loading && (
        <Card className="bg-card border-input">
          <CardContent className="p-0">
            <FinanceTableState variant="loading" columns={6} />
          </CardContent>
        </Card>
      )}

      {/* -- RESULTS -- */}
      {applied && !loading && report && (
        <>
          {/* Summary cards */}
          <ReportSummary report={report} />

          {/* CashFlowChart — only for ringkasan-kas and statement-akun (Req 9.5–9.7) */}
          {(applied.reportType === "ringkasan-kas" || applied.reportType === "statement-akun") && (
            <Card className="bg-card border-input">
              <CardContent className="p-4">
                <CashFlowChart
                  data={chartData}
                  title={chartTitle}
                  dateRange={chartDateRange}
                />
              </CardContent>
            </Card>
          )}

          {/* Data table */}
          <Card className="bg-card border-input">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-foreground">
                {appliedTypeMeta?.label}
              </CardTitle>
              <CardDescription className="text-xs">
                Filter aktif: {filterContext}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {totalRows === 0 ? (
                <FinanceTableState
                  variant="empty"
                  filterContext={filterContext}
                  title="Tidak ada data untuk filter ini"
                />
              ) : (
                <>
                  <FinanceTableScroll>
                    <ReportTable
                      report={report}
                      pageStart={pageStart}
                      pageSize={PAGE_SIZE}
                    />
                  </FinanceTableScroll>
                  <DataTablePagination
                    totalItems={totalRows}
                    itemsPerPage={PAGE_SIZE}
                    currentPage={currentPage}
                    onPageChange={setReportPage}
                    pageParam="reportPage"
                    maxVisiblePages={5}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ==========================================================================
// Summary sub-component
// ==========================================================================

function SummaryStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  const color =
    tone === "positive"
      ? "text-primary"
      : tone === "negative"
        ? "text-danger"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${color}`}>
        {value}
      </p>
    </div>
  );
}

function ReportSummary({ report }: { report: ReportData }) {
  if (report.kind === "ledger") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Total Masuk"
          value={formatRupiah(report.summary.totalIn)}
          tone="positive"
        />
        <SummaryStat
          label="Total Keluar"
          value={formatRupiah(report.summary.totalOut)}
          tone="negative"
        />
        <SummaryStat
          label="Saldo Akhir"
          value={formatRupiah(report.summary.ending)}
          tone={report.summary.ending < 0 ? "negative" : "positive"}
        />
      </div>
    );
  }
  if (report.kind === "piutang") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStat label="Total Tagihan" value={formatRupiah(report.summary.total)} />
        <SummaryStat
          label="Sudah Dibayar"
          value={formatRupiah(report.summary.paid)}
          tone="positive"
        />
        <SummaryStat
          label="Sisa Tagihan"
          value={formatRupiah(report.summary.remaining)}
          tone="negative"
        />
      </div>
    );
  }
  if (report.kind === "pengeluaran") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SummaryStat
          label="Total Pengeluaran"
          value={formatRupiah(report.summary.total)}
          tone="negative"
        />
        <SummaryStat
          label="Jumlah Transaksi"
          value={report.summary.count.toLocaleString("id-ID")}
        />
      </div>
    );
  }
  // budget
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Total Anggaran"
          value={formatRupiah(report.summary.totalAllocated)}
        />
        <SummaryStat
          label="Realisasi Aktual"
          value={formatRupiah(report.summary.totalActual)}
          tone={report.summary.isOverBudget ? "negative" : "default"}
        />
        <SummaryStat
          label="Sisa Anggaran"
          value={formatRupiah(report.summary.remaining)}
          tone={report.summary.isOverBudget ? "negative" : "positive"}
        />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <BudgetUsageIndicator
          totalBudget={report.summary.totalAllocated}
          usedAmount={report.summary.totalActual}
          label="Serapan Anggaran"
          showDetails
        />
      </div>
    </div>
  );
}

// ==========================================================================
// Table sub-component
// ==========================================================================

function ReportTable({
  report,
  pageStart,
  pageSize,
}: {
  report: ReportData;
  pageStart: number;
  pageSize: number;
}) {
  const headClass =
    "h-12 px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground";
  const rowClass = "h-[76px] transition-colors duration-100 hover:bg-secondary/25";
  const cellClass = "px-4 py-3 align-middle";
  const numericCellClass = `${cellClass} text-right font-mono tabular-nums`;

  if (report.kind === "ledger") {
    const rows = report.rows.slice(pageStart, pageStart + pageSize);
    return (
      <Table className="min-w-[1280px] table-fixed">
        <TableHeader className="bg-secondary/35">
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(headClass, "w-[120px]")}>Tanggal</TableHead>
            <TableHead className={cn(headClass, "w-[180px]")}>Nomor Transaksi</TableHead>
            <TableHead className={cn(headClass, "w-[130px]")}>Jenis</TableHead>
            <TableHead className={cn(headClass, "w-[210px]")}>Kategori</TableHead>
            <TableHead className={cn(headClass, "w-[190px]")}>Akun</TableHead>
            <TableHead className={cn(headClass, "w-[170px]")}>Referensi</TableHead>
            <TableHead className={cn(headClass, "w-[150px] text-right")}>Debit</TableHead>
            <TableHead className={cn(headClass, "w-[150px] text-right")}>Kredit</TableHead>
            <TableHead className={cn(headClass, "w-[160px] text-right")}>Saldo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className={rowClass}>
              <TableCell className={cn(cellClass, "whitespace-nowrap")}>
                {formatDate(r.transactionDate)}
              </TableCell>
              <TableCell className={cn(cellClass, "font-mono text-xs")}>
                {r.transactionNumber}
              </TableCell>
              <TableCell className={cellClass}>{getTransactionTypeLabel(r.type)}</TableCell>
              <TableCell className={cn(cellClass, "truncate")} title={r.categoryName}>
                {r.categoryName || EM_DASH}
              </TableCell>
              <TableCell className={cn(cellClass, "truncate")} title={r.accountName}>
                {r.accountName || EM_DASH}
              </TableCell>
              <TableCell className={cn(cellClass, "font-mono text-xs")}>
                {r.reference || EM_DASH}
              </TableCell>
              <TableCell className={cn(numericCellClass, "text-primary")}>
                {r.debit ? formatRupiah(r.debit) : EM_DASH}
              </TableCell>
              <TableCell className={cn(numericCellClass, "text-danger")}>
                {r.credit ? formatRupiah(r.credit) : EM_DASH}
              </TableCell>
              <TableCell className={numericCellClass}>
                {formatRupiah(r.saldo)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (report.kind === "piutang") {
    const rows = report.rows.slice(pageStart, pageStart + pageSize);
    return (
      <Table className="min-w-[1160px] table-fixed">
        <TableHeader className="bg-secondary/35">
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(headClass, "w-[130px]")}>Jatuh Tempo</TableHead>
            <TableHead className={cn(headClass, "w-[190px]")}>Nomor Invoice</TableHead>
            <TableHead className={cn(headClass, "w-[220px]")}>Customer</TableHead>
            <TableHead className={cn(headClass, "w-[220px]")}>Proyek</TableHead>
            <TableHead className={cn(headClass, "w-[150px] text-right")}>Total</TableHead>
            <TableHead className={cn(headClass, "w-[150px] text-right")}>Dibayar</TableHead>
            <TableHead className={cn(headClass, "w-[150px] text-right")}>Sisa</TableHead>
            <TableHead className={cn(headClass, "w-[140px]")}>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className={rowClass}>
              <TableCell className={cn(cellClass, "whitespace-nowrap")}>
                {formatDate(r.dueDate)}
              </TableCell>
              <TableCell className={cn(cellClass, "font-mono text-xs")}>{r.invoiceNumber}</TableCell>
              <TableCell className={cn(cellClass, "truncate")} title={r.customerName ?? undefined}>
                {r.customerName || EM_DASH}
              </TableCell>
              <TableCell className={cn(cellClass, "truncate")} title={r.projectName}>
                {r.projectName || EM_DASH}
              </TableCell>
              <TableCell className={numericCellClass}>
                {formatRupiah(r.total)}
              </TableCell>
              <TableCell className={cn(numericCellClass, "text-primary")}>
                {formatRupiah(r.paid)}
              </TableCell>
              <TableCell className={cn(numericCellClass, "text-danger")}>
                {formatRupiah(r.remaining)}
              </TableCell>
              <TableCell className={cellClass}>
                <span className="inline-flex min-h-7 items-center rounded-full border border-border bg-secondary/70 px-3 text-xs font-semibold text-foreground">
                  {getInvoiceStatusLabel(r.status)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (report.kind === "pengeluaran") {
    const rows = report.rows.slice(pageStart, pageStart + pageSize);
    return (
      <Table className="min-w-[980px] table-fixed">
        <TableHeader className="bg-secondary/35">
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(headClass, "w-[130px]")}>Tanggal</TableHead>
            <TableHead className={cn(headClass, "w-[190px]")}>Nomor Transaksi</TableHead>
            <TableHead className={cn(headClass, "w-[220px]")}>Kategori</TableHead>
            <TableHead className={cn(headClass, "w-[190px]")}>Akun</TableHead>
            <TableHead className={cn(headClass, "w-[260px]")}>Deskripsi</TableHead>
            <TableHead className={cn(headClass, "w-[160px] text-right")}>Nominal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className={rowClass}>
              <TableCell className={cn(cellClass, "whitespace-nowrap")}>
                {formatDate(r.transactionDate)}
              </TableCell>
              <TableCell className={cn(cellClass, "font-mono text-xs")}>
                {r.transactionNumber}
              </TableCell>
              <TableCell className={cn(cellClass, "truncate")} title={r.categoryName}>
                {r.categoryName || EM_DASH}
              </TableCell>
              <TableCell className={cn(cellClass, "truncate")} title={r.accountName}>
                {r.accountName || EM_DASH}
              </TableCell>
              <TableCell className={cn(cellClass, "truncate")} title={r.description}>
                {r.description || EM_DASH}
              </TableCell>
              <TableCell className={cn(numericCellClass, "text-danger")}>
                {formatRupiah(r.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // budget
  const rows = report.rows.slice(pageStart, pageStart + pageSize);
  return (
    <Table className="min-w-[1220px] table-fixed">
      <TableHeader className="bg-secondary/35">
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(headClass, "w-[220px]")}>Nama Anggaran</TableHead>
          <TableHead className={cn(headClass, "w-[220px]")}>Proyek</TableHead>
          <TableHead className={cn(headClass, "w-[190px]")}>Periode</TableHead>
          <TableHead className={cn(headClass, "w-[160px] text-right")}>Anggaran</TableHead>
          <TableHead className={cn(headClass, "w-[180px] text-right")}>Realisasi Aktual</TableHead>
          <TableHead className={cn(headClass, "w-[160px] text-right")}>Selisih</TableHead>
          <TableHead className={cn(headClass, "w-[150px] text-right")}>Serapan</TableHead>
          <TableHead className={cn(headClass, "w-[150px]")}>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} className={rowClass}>
            <TableCell className={cn(cellClass, "font-semibold")}>{r.name}</TableCell>
            <TableCell className={cn(cellClass, "truncate")} title={r.projectName}>
              {r.projectName || EM_DASH}
            </TableCell>
            <TableCell className={cn(cellClass, "whitespace-nowrap text-xs")}>
              {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
            </TableCell>
            <TableCell className={numericCellClass}>
              {formatRupiah(r.allocated)}
            </TableCell>
            <TableCell
              className={cn(numericCellClass, r.isOverBudget && "text-danger")}
            >
              {formatRupiah(r.actual)}
            </TableCell>
            <TableCell
              className={cn(numericCellClass, r.variance < 0 ? "text-danger" : "text-primary")}
            >
              {formatRupiah(r.variance)}
            </TableCell>
            <TableCell className={numericCellClass}>
              {r.absorption.toFixed(1)}%
            </TableCell>
            <TableCell className={cellClass}>
              {r.isOverBudget ? (
                <span className="inline-flex min-h-7 items-center rounded-full border border-destructive/20 bg-destructive/10 px-3 text-xs font-semibold text-destructive">
                  Over Budget
                </span>
              ) : (
                <span className="inline-flex min-h-7 items-center rounded-full border border-border bg-secondary/70 px-3 text-xs font-semibold text-foreground">
                  {getBudgetStatusLabel(r.status)}
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
