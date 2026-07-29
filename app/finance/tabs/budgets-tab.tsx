"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Info, ExternalLink, Power, Pencil, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { FinanceDocLink } from "@/components/finance/finance-doc-link";
import { FinanceTableState } from "@/components/finance/finance-table-state";
import { FinanceTableScroll } from "@/components/finance/finance-table-scroll";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { BudgetUsageIndicator } from "@/components/finance/budget-usage-indicator";
import { BudgetAlertNotice } from "@/components/finance/budget-alert-notice";
import { computeBudgetTotals } from "@/lib/finance-budget-summary";
import { getBudgetStatusLabel } from "@/lib/label-helpers";
import { formatRupiah } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types — mirror the shapes provided by FinanceShell (Task 3.x / 14.1)
// ---------------------------------------------------------------------------

const BUDGET_PAGE_SIZE = 20;

interface BudgetItem {
  id: string;
  projectId: string;
  name: string;
  periodStart: Date;
  periodEnd: Date;
  totalAmount: number;
  status: "draft" | "active" | "closed";
  projectName: string;
  createdAt?: Date;
}

interface BudgetLineItem {
  id: string;
  budgetId: string;
  categoryId: string;
  allocatedAmount: number;
  usedAmount: number;
  remainingAmount: number;
}

interface BudgetActualUsageItem {
  budgetId: string;
  categoryId: string;
  actualAmount: number;
}

interface BudgetsTabProps {
  projects: Array<{ id: string; name: string; code: string }>;
  categories: Array<{
    id: string;
    name: string;
    type: "income" | "expense";
    status: "active" | "inactive";
  }>;
  filteredBudgets: BudgetItem[];
  /** Additive: persisted budget allocation lines (budget_lines). */
  budgetLines?: BudgetLineItem[];
  /** Additive: actual usage aggregated from approved expense (Task 14.1). */
  budgetActualUsage?: BudgetActualUsageItem[];
  budgetForm: {
    projectId: string;
    name: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: string;
    categoryId: string;
    allocatedAmount: string;
  };
  setBudgetForm: React.Dispatch<React.SetStateAction<{
    projectId: string;
    name: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: string;
    categoryId: string;
    allocatedAmount: string;
  }>>;
  budgetOpen: boolean;
  setBudgetOpen: (open: boolean) => void;
  errorMsg: string | null;
  isSubmitting: boolean;
  onCreateBudgetSubmit: (e: React.FormEvent) => Promise<void>;
  onActivateBudget?: (budgetId: string) => Promise<void>;
  onUpdateDraftBudget?: (
    budgetId: string,
    data: {
      projectId: string;
      name: string;
      periodStart: Date;
      periodEnd: Date;
      totalAmount: number;
      lines: Array<{ categoryId: string; allocatedAmount: number }>;
    },
  ) => Promise<void>;
  onDeleteDraftBudget?: (budgetId: string) => Promise<void>;
  activatingBudgetId?: string | null;
  updatingBudgetId?: string | null;
  deletingBudgetId?: string | null;
  /** Global period filter (null = Semua Periode). */
  periodStart?: Date | null;
  periodEnd?: Date | null;
}

// ---------------------------------------------------------------------------
// Presentation helpers (pure)
// ---------------------------------------------------------------------------

/** Short locale-ID date. */
function formatShortDate(date: Date | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Inclusive date-range overlap check for the global period filter. */
function periodOverlaps(
  budgetStart: Date,
  budgetEnd: Date,
  filterStart: Date | null | undefined,
  filterEnd: Date | null | undefined,
): boolean {
  if (!filterStart && !filterEnd) return true;
  const fStart = filterStart ?? new Date(0);
  const fEnd = filterEnd ?? new Date(8640000000000000);
  return (
    budgetStart.getTime() <= fEnd.getTime() &&
    fStart.getTime() <= budgetEnd.getTime()
  );
}

type BudgetStatusFilter = "all" | "active" | "draft" | "closed";

const STATUS_FILTERS: Array<{ key: BudgetStatusFilter; label: string }> = [
  { key: "all", label: "Semua Status" },
  { key: "active", label: "Aktif" },
  { key: "draft", label: "Draft" },
  { key: "closed", label: "Ditutup" },
];

/** Presentation-only badge styling per budget status. */
function budgetStatusBadgeClass(status: BudgetItem["status"]): string {
  switch (status) {
    case "active":
      return "bg-secondary text-primary border border-primary/20";
    case "closed":
      return "bg-muted text-muted-foreground border border-border";
    case "draft":
    default:
      return "bg-amber-50 text-[#8A6D1D] border border-amber-200";
  }
}

/**
 * A budget row enriched with pure usage arithmetic.
 *
 * - `usedPersisted` comes from `budget_lines.usedAmount` via the pure
 *   `computeBudgetTotals` helper.
 * - `usedActual` is the Realisasi Aktual aggregated from approved expense
 *   (project + category + budget period) provided by the loader.
 * - When the two disagree, the UI labels the displayed figure as
 *   "Realisasi Aktual" without mutating any persisted value.
 */
interface BudgetRow extends BudgetItem {
  usedPersisted: number;
  usedActual: number;
  sisa: number;
  absorption: number;
  isOverBudget: boolean;
  persistedDiffersFromActual: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetsTab({
  projects,
  categories,
  filteredBudgets,
  budgetLines = [],
  budgetActualUsage = [],
  budgetForm,
  setBudgetForm,
  budgetOpen,
  setBudgetOpen,
  errorMsg,
  isSubmitting,
  onCreateBudgetSubmit,
  onActivateBudget,
  onUpdateDraftBudget,
  onDeleteDraftBudget,
  activatingBudgetId = null,
  updatingBudgetId = null,
  deletingBudgetId = null,
  periodStart = null,
  periodEnd = null,
}: BudgetsTabProps) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = React.useState<BudgetStatusFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [editingBudget, setEditingBudget] = React.useState<BudgetRow | null>(null);
  const [editForm, setEditForm] = React.useState({
    projectId: "",
    name: "",
    periodStart: "",
    periodEnd: "",
    totalAmount: "",
    categoryId: "",
    allocatedAmount: "",
  });
  const [editError, setEditError] = React.useState<string | null>(null);

  // Pagination via URL namespace "budgetPage" (Req 10.8)
  const budgetPage = Number(searchParams.get("budgetPage")) || 1;

  /** Reset pagination to 1 when filter changes (Req 10.7) */
  const resetPage = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("budgetPage", "1");
    router.push(`?${params.toString()}`);
  }, [searchParams, router]);

  // Enrich each budget with pure usage arithmetic + apply local filters.
  const budgetRows = React.useMemo<BudgetRow[]>(() => {
    const query = searchQuery.trim().toLowerCase();

    return filteredBudgets
      // Global period filter (inclusive overlap on budget period).
      .filter((b) => periodOverlaps(b.periodStart, b.periodEnd, periodStart, periodEnd))
      // Local status sub-filter.
      .filter((b) => statusFilter === "all" || b.status === statusFilter)
      // Local search over budget/project name.
      .filter((b) =>
        query === "" ||
        b.name.toLowerCase().includes(query) ||
        b.projectName.toLowerCase().includes(query),
      )
      .map((b) => {
        // Persisted usage — pure helper over this budget's allocation lines.
        const persisted = computeBudgetTotals(
          budgetLines.filter((l) => l.budgetId === b.id),
        );
        // Realisasi Aktual — approved expense aggregated by the loader.
        const usedActual = budgetActualUsage
          .filter((u) => u.budgetId === b.id)
          .reduce((sum, u) => sum + u.actualAmount, 0);

        const sisa = b.totalAmount - usedActual;
        const absorption = b.totalAmount > 0 ? (usedActual / b.totalAmount) * 100 : 0;

        return {
          ...b,
          usedPersisted: persisted.totalUsed,
          usedActual,
          sisa,
          absorption,
          isOverBudget: usedActual > b.totalAmount,
          persistedDiffersFromActual: persisted.totalUsed !== usedActual,
        };
      });
  }, [filteredBudgets, budgetLines, budgetActualUsage, statusFilter, searchQuery, periodStart, periodEnd]);

  React.useEffect(() => {
    resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchQuery, periodStart, periodEnd]);

  const budgetTotalPages = Math.max(1, Math.ceil(budgetRows.length / BUDGET_PAGE_SIZE));
  const safeBudgetPage = Math.min(Math.max(1, budgetPage), budgetTotalPages);
  const pagedBudgetRows = budgetRows.slice(
    (safeBudgetPage - 1) * BUDGET_PAGE_SIZE,
    safeBudgetPage * BUDGET_PAGE_SIZE,
  );

  // Active budgets drive the summary cards.
  const activeRows = React.useMemo(
    () => budgetRows.filter((b) => b.status === "active"),
    [budgetRows],
  );

  const filterContext = React.useMemo(() => {
    const parts = ["Anggaran Proyek"];
    const statusLabel = STATUS_FILTERS.find((f) => f.key === statusFilter)?.label;
    if (statusLabel && statusFilter !== "all") parts.push(statusLabel);
    if (searchQuery.trim()) parts.push(`pencarian "${searchQuery.trim()}"`);
    return parts.join(" - ");
  }, [statusFilter, searchQuery]);

  const budgetOverview = React.useMemo(() => {
    const total = activeRows.reduce((sum, budget) => sum + budget.totalAmount, 0);
    const used = activeRows.reduce((sum, budget) => sum + budget.usedActual, 0);
    const remaining = total - used;
    const attention = activeRows.filter((budget) => budget.absorption >= 80 || budget.isOverBudget).length;
    const usedPct = total > 0 ? ((used / total) * 100).toFixed(1) : "0.0";
    const remainingPct = total > 0 ? ((remaining / total) * 100).toFixed(1) : "0.0";
    return { total, used, remaining, attention, usedPct, remainingPct };
  }, [activeRows]);

  // BudgetAlertNotice — pick the budget with the highest absorption > 80% (Req 8.3)
  const alertBudget = React.useMemo(() => {
    const candidates = budgetRows
      .filter((b) => b.absorption > 80)
      .sort((a, b) => {
        // Highest absorption first; alphabetical tiebreak
        if (b.absorption !== a.absorption) return b.absorption - a.absorption;
        return a.name.localeCompare(b.name);
      });
    if (candidates.length === 0) return null;
    const top = candidates[0];
    return {
      id: top.id,
      name: top.name,
      totalAmount: top.totalAmount,
      usedAmount: top.usedActual,
      absorptionPercentage: top.absorption,
    };
  }, [budgetRows]);

  const openEditDialog = React.useCallback((budget: BudgetRow) => {
    const firstLine = budgetLines.find((line) => line.budgetId === budget.id);
    setEditingBudget(budget);
    setEditError(null);
    setEditForm({
      projectId: budget.projectId,
      name: budget.name,
      periodStart: new Date(budget.periodStart).toISOString().slice(0, 10),
      periodEnd: new Date(budget.periodEnd).toISOString().slice(0, 10),
      totalAmount: String(budget.totalAmount),
      categoryId: firstLine?.categoryId ?? "",
      allocatedAmount: String(firstLine?.allocatedAmount ?? budget.totalAmount),
    });
  }, [budgetLines]);

  const closeEditDialog = React.useCallback(() => {
    setEditingBudget(null);
    setEditError(null);
  }, []);

  const handleEditSubmit = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingBudget || !onUpdateDraftBudget) return;

    const totalAmount = Number(editForm.totalAmount);
    const allocatedAmount = Number(editForm.allocatedAmount);
    if (!editForm.projectId || !editForm.name.trim() || !editForm.periodStart || !editForm.periodEnd || !editForm.categoryId) {
      setEditError("Lengkapi semua field anggaran.");
      return;
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      setEditError("Total nilai anggaran harus lebih dari 0.");
      return;
    }
    if (!Number.isFinite(allocatedAmount) || allocatedAmount <= 0) {
      setEditError("Nominal alokasi kategori harus lebih dari 0.");
      return;
    }
    if (allocatedAmount > totalAmount) {
      setEditError("Nominal alokasi kategori tidak boleh melebihi total anggaran.");
      return;
    }

    try {
      await onUpdateDraftBudget(editingBudget.id, {
        projectId: editForm.projectId,
        name: editForm.name.trim(),
        periodStart: new Date(editForm.periodStart),
        periodEnd: new Date(editForm.periodEnd),
        totalAmount,
        lines: [
          {
            categoryId: editForm.categoryId,
            allocatedAmount,
          },
        ],
      });
      closeEditDialog();
    } catch {
      setEditError("Gagal memperbarui draft anggaran. Periksa kembali data atau periode overlap.");
    }
  }, [closeEditDialog, editForm, editingBudget, onUpdateDraftBudget]);

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards (Req 8.2) */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ringkasan anggaran">
        {[
          {
            label: "Total Anggaran",
            value: formatRupiah(budgetOverview.total),
            sub: "100% dari alokasi",
            color: "text-foreground",
          },
          {
            label: "Terpakai",
            value: formatRupiah(budgetOverview.used),
            sub: `${budgetOverview.usedPct}% dari total`,
            color: "text-primary",
          },
          {
            label: "Sisa Anggaran",
            value: formatRupiah(budgetOverview.remaining),
            sub: `${budgetOverview.remainingPct}% dari total`,
            color: budgetOverview.remaining < 0 ? "text-destructive" : "text-foreground",
          },
          {
            label: "Anggaran Perlu Perhatian",
            value: String(budgetOverview.attention),
            sub: "serapan > 80%",
            color: budgetOverview.attention > 0 ? "text-amber-700" : "text-primary",
            isCount: true,
          },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={cn("mt-1 font-mono text-xl font-bold tabular-nums", item.color)}>
              {item.isCount ? item.value : item.value}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{item.sub}</p>
          </div>
        ))}
      </section>

      {/* BudgetAlertNotice (Req 8.3) — highest absorption > 80% */}
      <BudgetAlertNotice budget={alertBudget} />
      {/* Budget Table Card */}
      <Card className="overflow-hidden bg-card border-input">
          <CardHeader className="grid gap-4 border-b border-border/70 px-5 py-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <CardTitle className="text-lg text-foreground">Anggaran Proyek</CardTitle>
              <CardDescription className="text-xs">{t("finance.budget_list_desc")}</CardDescription>
            </div>
            <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
              <DialogTrigger nativeButton={true} render={
                <Button className="btn-premium min-h-11 min-w-[144px] justify-center rounded-xl bg-[#4F6F52] px-4 text-xs font-bold text-white hover:bg-[#3D563F] cursor-pointer">
                  <Plus className="h-3.5 w-3.5" /> Buat Anggaran
                </Button>
              } />
              <DialogContent className="bg-card w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("finance.budget_form_title")}</DialogTitle>
                  <DialogDescription>{t("finance.budget_form_desc")}</DialogDescription>
                </DialogHeader>
                {errorMsg && (
                  <div className="p-3 bg-rose-50 text-danger border border-rose-100 rounded-md text-xs font-semibold">
                    {errorMsg}
                  </div>
                )}
                <form onSubmit={onCreateBudgetSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">{t("finance.budget_lbl_project")}</label>
                    <Select
                      value={budgetForm.projectId}
                      onValueChange={(val) => setBudgetForm(f => ({ ...f, projectId: val || "" }))}
                      items={projects.map(p => ({ label: p.name, value: p.id }))}
                    >
                      <SelectTrigger className="w-full min-w-0 bg-card border-input">
                        <SelectValue placeholder="Pilih Perumahan" className="block max-w-full truncate text-left">
                          {budgetForm.projectId ? projects.find(p => p.id === budgetForm.projectId)?.name : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-w-[calc(100vw-2rem)]">
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-sm">
                            <span className="block max-w-[360px] truncate">{p.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">{t("finance.budget_lbl_name")}</label>
                    <Input
                      placeholder={t("finance.budget_lbl_name_ph")}
                      value={budgetForm.name}
                      onChange={(e) => setBudgetForm(f => ({ ...f, name: e.target.value }))}
                      className="bg-card border-input"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">{t("finance.budget_lbl_start")}</label>
                      <Input
                        type="date"
                        value={budgetForm.periodStart}
                        onChange={(e) => setBudgetForm(f => ({ ...f, periodStart: e.target.value }))}
                        className="bg-card border-input"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">{t("finance.budget_lbl_end")}</label>
                      <Input
                        type="date"
                        value={budgetForm.periodEnd}
                        onChange={(e) => setBudgetForm(f => ({ ...f, periodEnd: e.target.value }))}
                        className="bg-card border-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">{t("finance.budget_lbl_category")}</label>
                      <Select
                        value={budgetForm.categoryId}
                        onValueChange={(val) => setBudgetForm(f => ({ ...f, categoryId: val || "" }))}
                        items={categories.filter(c => c.type === "expense").map(c => ({ label: c.name, value: c.id }))}
                      >
                        <SelectTrigger className="w-full min-w-0 bg-card border-input">
                          <SelectValue placeholder="Pilih Kategori" className="block max-w-full truncate text-left">
                            {budgetForm.categoryId ? categories.find(c => c.id === budgetForm.categoryId)?.name : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-w-[calc(100vw-2rem)]">
                          {categories.filter(c => c.type === "expense").map(c => (
                            <SelectItem key={c.id} value={c.id} className="text-sm">
                              <span className="block max-w-[360px] truncate">{c.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">{t("finance.budget_lbl_alloc")}</label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="Rp 0"
                        value={budgetForm.allocatedAmount}
                        onChange={(e) => setBudgetForm(f => ({ ...f, allocatedAmount: e.target.value }))}
                        className="bg-card border-input"
                        required
                      />
                    </div>
                  </div>

                  {budgetForm.allocatedAmount && !isNaN(Number(budgetForm.allocatedAmount)) && (
                    <div className="p-2.5 bg-secondary/50 border border-primary/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Format Rupiah Terbaca</span>
                      <span className="font-mono font-extrabold text-sm text-primary tracking-tight tabular-nums">
                        {formatRupiah(Number(budgetForm.allocatedAmount))}
                      </span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">{t("finance.budget_lbl_total")}</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Rp 0"
                      value={budgetForm.totalAmount}
                      onChange={(e) => setBudgetForm(f => ({ ...f, totalAmount: e.target.value }))}
                      className="bg-card border-input"
                      required
                    />
                  </div>

                  {budgetForm.totalAmount && !isNaN(Number(budgetForm.totalAmount)) && (
                    <div className="p-2.5 bg-secondary/50 border border-primary/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Format Rupiah Terbaca</span>
                      <span className="font-mono font-extrabold text-sm text-primary tracking-tight tabular-nums">
                        {formatRupiah(Number(budgetForm.totalAmount))}
                      </span>
                    </div>
                  )}

                  <DialogFooter>
                    <Button
                      type="submit"
                      className="bg-primary hover:bg-[#8FAF9A] text-white w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? t("finance.saving") : t("finance.budget_btn_submit")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>

          {/* Sub-filters: status pills + search */}
          <div className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_280px] lg:items-center">
            <div
              role="group"
              aria-label="Filter status anggaran"
              className="flex flex-wrap items-center gap-2"
            >
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  aria-pressed={statusFilter === f.key}
                  className={cn(
                    "inline-flex min-h-10 items-center whitespace-nowrap rounded-full border px-4 text-xs font-semibold transition-colors duration-150 cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    statusFilter === f.key
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-secondary/60 text-muted-foreground border-border hover:border-primary/30 hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari budget..."
                aria-label="Cari budget"
                className="h-10 rounded-xl bg-card border-input pl-8 text-sm"
              />
            </div>
          </div>

          <CardContent className="p-0">
            <FinanceTableScroll>
              <Table className="min-w-[1180px] table-fixed">
                <TableHeader className="bg-secondary/35">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-12 w-[180px] px-5 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Nama Anggaran</TableHead>
                    <TableHead className="h-12 w-[180px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Proyek</TableHead>
                    <TableHead className="h-12 w-[190px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Periode</TableHead>
                    <TableHead className="h-12 w-[170px] px-4 text-right text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Alokasi</TableHead>
                    <TableHead className="h-12 w-[180px] px-4 text-right text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Terpakai</TableHead>
                    <TableHead className="h-12 w-[170px] px-4 text-right text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Sisa</TableHead>
                    <TableHead className="h-12 w-[110px] px-4 text-center text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">{t("finance.col_status")}</TableHead>
                    <TableHead className="h-12 w-[160px] px-5 text-center text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="p-0">
                        <FinanceTableState
                          variant="empty"
                          filterContext={filterContext}
                          title={t("finance.budget_empty")}
                          description={t("finance.budget_empty_desc")}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedBudgetRows.map((b) => (
                      <TableRow key={b.id} className="h-[92px] hover:bg-secondary/25 transition-colors duration-100">
                        {/* Nama Anggaran — BUD code monospace + link detail (Req 8.5, 8.9, 12.5) */}
                        <TableCell className="px-5 py-4 text-xs align-middle">
                          <FinanceDocLink
                            href={`/finance/budgets/${b.id}`}
                            className="font-bold text-primary-dark"
                          >
                            {b.name}
                          </FinanceDocLink>
                          <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
                            BUD-{b.id.substring(0, 6).toUpperCase()}
                          </span>
                        </TableCell>
                        {/* Proyek */}
                        <TableCell className="px-4 py-4 text-xs font-medium text-foreground/80 align-middle">
                          {b.projectName}
                        </TableCell>
                        {/* Periode */}
                        <TableCell className="px-4 py-4 text-xs text-muted-foreground whitespace-nowrap align-middle">
                          {formatShortDate(b.periodStart)} - {formatShortDate(b.periodEnd)}
                        </TableCell>
                        {/* Alokasi (Req 8.9 tabular-nums) */}
                        <TableCell className="px-4 py-4 text-right font-mono font-bold tabular-nums text-xs text-foreground whitespace-nowrap align-middle">
                          {formatRupiah(b.totalAmount)}
                        </TableCell>
                        {/* Terpakai — inline BudgetUsageIndicator + percentage (Req 8.5, 8.6, 8.8) */}
                        <TableCell className="px-4 py-4 text-right text-xs whitespace-nowrap align-middle">
                          <div className="ml-auto flex w-[150px] flex-col items-end justify-center gap-1.5">
                            <span className="font-mono font-semibold tabular-nums text-foreground">
                              {formatRupiah(b.usedActual)}
                            </span>
                            <BudgetUsageIndicator
                              totalBudget={b.totalAmount}
                              usedAmount={b.usedActual}
                              showDetails={false}
                              compact
                            />
                            {b.persistedDiffersFromActual && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                                <Info className="h-3 w-3" aria-hidden="true" />
                                Realisasi Aktual
                              </span>
                            )}
                          </div>
                        </TableCell>
                        {/* Sisa */}
                        <TableCell
                          className={cn(
                            "px-4 py-4 text-right font-mono font-semibold tabular-nums text-xs whitespace-nowrap align-middle",
                            b.sisa < 0 ? "text-destructive" : "text-foreground",
                          )}
                        >
                          {b.sisa < 0 ? "-" : ""}
                          {formatRupiah(Math.abs(b.sisa))}
                        </TableCell>
                        {/* Status */}
                        <TableCell className="px-4 py-4 text-center align-middle">
                          <Badge className={cn("min-w-[64px] justify-center rounded-full px-2.5 py-1 text-[11px] font-bold", budgetStatusBadgeClass(b.status))}>
                            {getBudgetStatusLabel(b.status)}
                          </Badge>
                        </TableCell>
                        {/* Aksi — "Periksa Detailnya" button (Req 8.7) */}
                        <TableCell className="px-5 py-4 text-center align-middle">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            {b.status === "draft" && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="min-h-10 gap-1.5 rounded-xl bg-primary px-3 text-xs text-white hover:bg-primary/90"
                                  onClick={() => onActivateBudget?.(b.id)}
                                  disabled={!onActivateBudget || activatingBudgetId === b.id}
                                  aria-label={`Aktifkan anggaran ${b.name}`}
                                >
                                  {activatingBudgetId === b.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <Power className="h-3.5 w-3.5" aria-hidden="true" />
                                  )}
                                  Aktifkan
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="min-h-10 gap-1.5 rounded-xl px-3 text-xs"
                                  onClick={() => openEditDialog(b)}
                                  disabled={!onUpdateDraftBudget || updatingBudgetId === b.id}
                                  aria-label={`Edit anggaran ${b.name}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="min-h-10 gap-1.5 rounded-xl border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    if (window.confirm(`Hapus draft anggaran "${b.name}"? Tindakan ini tidak dapat dibatalkan.`)) {
                                      void onDeleteDraftBudget?.(b.id);
                                    }
                                  }}
                                  disabled={!onDeleteDraftBudget || deletingBudgetId === b.id}
                                  aria-label={`Hapus anggaran ${b.name}`}
                                >
                                  {deletingBudgetId === b.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  )}
                                  Hapus
                                </Button>
                              </>
                            )}
                            <Link
                              href={`/finance/budgets/${b.id}`}
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "min-h-10 min-w-10 gap-1.5 rounded-xl border-primary/20 bg-card px-3 text-xs font-semibold text-primary-dark whitespace-nowrap hover:bg-secondary/70",
                              )}
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="truncate">Detail Anggaran</span>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </FinanceTableScroll>
            <DataTablePagination
              totalItems={budgetRows.length}
              itemsPerPage={BUDGET_PAGE_SIZE}
              currentPage={safeBudgetPage}
              pageParam="budgetPage"
            />
          </CardContent>
        </Card>

      <Dialog open={editingBudget !== null} onOpenChange={(open) => {
        if (!open) closeEditDialog();
      }}>
        <DialogContent className="bg-card w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Draft Anggaran</DialogTitle>
            <DialogDescription>
              Perubahan hanya diperbolehkan selama anggaran masih berstatus draft.
            </DialogDescription>
          </DialogHeader>
          {editError && (
            <div className="rounded-md border border-rose-100 bg-rose-50 p-3 text-xs font-semibold text-danger">
              {editError}
            </div>
          )}
          <form onSubmit={handleEditSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Hubungkan Perumahan</label>
              <Select
                value={editForm.projectId}
                onValueChange={(val) => setEditForm((form) => ({ ...form, projectId: val || "" }))}
                items={projects.map((project) => ({ label: project.name, value: project.id }))}
              >
                <SelectTrigger className="w-full min-w-0 bg-card border-input">
                  <SelectValue placeholder="Pilih Perumahan" className="block max-w-full truncate text-left">
                    {editForm.projectId ? projects.find((project) => project.id === editForm.projectId)?.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id} className="text-sm">
                      <span className="block max-w-[360px] truncate">{project.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Nama Rencana Anggaran</label>
              <Input
                value={editForm.name}
                onChange={(event) => setEditForm((form) => ({ ...form, name: event.target.value }))}
                className="bg-card border-input"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Mulai</label>
                <Input
                  type="date"
                  value={editForm.periodStart}
                  onChange={(event) => setEditForm((form) => ({ ...form, periodStart: event.target.value }))}
                  className="bg-card border-input"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Selesai</label>
                <Input
                  type="date"
                  value={editForm.periodEnd}
                  onChange={(event) => setEditForm((form) => ({ ...form, periodEnd: event.target.value }))}
                  className="bg-card border-input"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Kategori Anggaran</label>
                <Select
                  value={editForm.categoryId}
                  onValueChange={(val) => setEditForm((form) => ({ ...form, categoryId: val || "" }))}
                  items={categories.filter((category) => category.type === "expense").map((category) => ({ label: category.name, value: category.id }))}
                >
                  <SelectTrigger className="w-full min-w-0 bg-card border-input">
                    <SelectValue placeholder="Pilih Kategori" className="block max-w-full truncate text-left">
                      {editForm.categoryId ? categories.find((category) => category.id === editForm.categoryId)?.name : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)]">
                    {categories.filter((category) => category.type === "expense").map((category) => (
                      <SelectItem key={category.id} value={category.id} className="text-sm">
                        <span className="block max-w-[360px] truncate">{category.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Nominal Alokasi Kategori</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={editForm.allocatedAmount}
                  onChange={(event) => setEditForm((form) => ({ ...form, allocatedAmount: event.target.value }))}
                  className="bg-card border-input"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Total Nilai Anggaran Belanja (RAB)</label>
              <Input
                type="number"
                inputMode="numeric"
                value={editForm.totalAmount}
                onChange={(event) => setEditForm((form) => ({ ...form, totalAmount: event.target.value }))}
                className="bg-card border-input"
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeEditDialog}
                disabled={editingBudget ? updatingBudgetId === editingBudget.id : false}
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="bg-primary text-white hover:bg-primary/90"
                disabled={editingBudget ? updatingBudgetId === editingBudget.id : false}
              >
                {editingBudget && updatingBudgetId === editingBudget.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
