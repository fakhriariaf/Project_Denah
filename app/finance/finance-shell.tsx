"use client";
import { useRouter } from "next/navigation";

import * as React from "react";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import {
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  FileText,
  FolderOpen,
  PieChart,
  CheckCircle2,
  BarChart3,
  Wallet,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinanceFilterBar } from "@/components/finance/finance-filter-bar";
import { FinanceSummaryGrid } from "@/components/finance/finance-summary-grid";
import { computeFilteredBudgetTotals } from "@/lib/finance-budget-summary";
import { KpiComparisonIndicator } from "@/components/finance/kpi-comparison-indicator";
import { calculateKpiPercentageChange } from "@/lib/finance-kpi-utils";
import { BudgetAlertNotice } from "@/components/finance/budget-alert-notice";
import { CreateInvoiceDialog } from "./components/create-invoice-dialog";
import {
  createPayment,
  verifyPayment,
  deletePayment,
  createExpenseRequest,
  approveExpense,
  rejectExpense,
  createBudget,
  activateBudget,
  updateDraftBudget,
  deleteDraftBudget,
} from "@/server/actions/finance";
import type { PaginatedResult } from "@/lib/pagination";
import { formatRupiah } from "@/lib/format-utils";
import { parseServerError } from "@/lib/error-parser";
import { toast } from "sonner";
import { InvoicesTab } from "./tabs/invoices-tab";
import { PaymentsTab } from "./tabs/payments-tab";
import { TransactionsTab } from "./tabs/transactions-tab";
import { ApprovalsTab } from "./tabs/approvals-tab";
import { BudgetsTab } from "./tabs/budgets-tab";
import { ReportsTab } from "./tabs/reports-tab";

type PaymentListItem = {
  id: string;
  paymentNumber: string;
  projectId: string;
  unitId: string | null;
  customerId: string | null;
  amount: number;
  paymentDate: Date;
  paymentMethod: "cash" | "transfer" | "giro" | "other";
  proofAttachmentId: string | null;
  proofFileUrl?: string | null;
  proofUploadedBy?: string | null;
  status: "pending" | "verified" | "rejected" | "voided";
  verifiedBy: string | null;
  verifiedAt: Date | null;
  uploadedBy: string | null;
  createdAt: Date;
  projectName: string;
  customerName: string | null;
  unitCode: string | null;
  invoiceNumber: string | null;
  invoiceId?: string | null;
};

interface FinanceShellProps {
  activeUser: { id: string; name: string; email: string; roleId?: string | null };
  projects: Array<{ id: string; name: string; code: string }>;
  units: Array<{ id: string; code: string; projectId: string; price: number }>;
  customers: Array<{ id: string; name: string; phone: string }>;
  accounts: Array<{
    id: string;
    code: string;
    name: string;
    type: "cash" | "bank" | "receivable" | "payable" | "income" | "expense";
    openingBalance: number;
    currentBalance: number;
    status: "active" | "inactive";
  }>;
  categories: Array<{
    id: string;
    name: string;
    type: "income" | "expense";
    status: "active" | "inactive";
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    projectId: string;
    unitId: string | null;
    customerId: string | null;
    bookingId: string | null;
    type: "booking_fee" | "dp" | "installment" | "other";
    amount: number;
    dueDate: Date | null;
    status: "unpaid" | "partial" | "paid" | "cancelled";
    notes: string | null;
    createdAt: Date;
    projectName: string;
    customerName: string | null;
    unitCode: string | null;
    scheduleKind: string | null;
    scheduleSequence: number | null;
    scheduleLabel: string | null;
    bookingProofFileUrl: string | null;
    bookingProofFileName: string | null;
    // Additive optional fields (Req 17.4, 17.5)
    totalPaidVerified?: number;
    remainingBalance?: number;
    relatedExpenseTransactionId?: string | null;
    relatedApprovalId?: string | null;
  }>;
  payments: Array<{
    id: string;
    invoiceId: string | null;
    paymentNumber: string;
    projectId: string;
    unitId: string | null;
    customerId: string | null;
    amount: number;
    paymentDate: Date;
    paymentMethod: "cash" | "transfer" | "giro" | "other";
    proofAttachmentId: string | null;
    proofFileUrl?: string | null;
    proofUploadedBy?: string | null;
    status: "pending" | "verified" | "rejected" | "voided";
    verifiedBy: string | null;
    verifiedAt: Date | null;
    uploadedBy: string | null;
    createdAt: Date;
    projectName: string;
    customerName: string | null;
    unitCode: string | null;
    invoiceNumber: string | null;
  }>;
  transactions: Array<{
    id: string;
    transactionNumber: string;
    projectId: string;
    unitId: string | null;
    customerId: string | null;
    paymentId: string | null;
    accountId: string;
    categoryId: string;
    type: "income" | "expense";
    description: string;
    amount: number;
    transactionDate: Date;
    paymentMethod: "cash" | "transfer" | "giro" | "other";
    approvalStatus: "not_required" | "pending" | "approved" | "rejected" | "insufficient_balance";
    approvedBy: string | null;
    approvalNotes: string | null;
    attachmentId: string | null;
    createdBy: string;
    createdAt: Date;
    projectName: string;
    accountName: string;
    categoryName: string;
    unitCode: string | null;
    customerName: string | null;
    invoiceNumber?: string | null;
    invoiceId?: string | null;
    resolvedApproverName?: string | null;
    // Additive: reversal markers for ledger classification (Req 6.2, 17.4)
    reversalOfTransactionId?: string | null;
    reversalOfPaymentId?: string | null;
    reversalReason?: string | null;
  }>;
  budgets: Array<{
    id: string;
    projectId: string;
    name: string;
    periodStart: Date;
    periodEnd: Date;
    totalAmount: number;
    status: "draft" | "active" | "closed";
    projectName: string;
  }>;
  // Additive: budget lines for budget summary/detail (Req 9.3, 10.2, 17.4)
  budgetLines?: Array<{
    id: string;
    budgetId: string;
    categoryId: string;
    allocatedAmount: number;
    usedAmount: number;
    remainingAmount: number;
  }>;
  // Additive: actual budget usage aggregated from approved expense (Req 9.3, 17.4)
  budgetActualUsage?: Array<{
    budgetId: string;
    categoryId: string;
    actualAmount: number;
  }>;
  defaultTab?: "invoices" | "payments" | "transactions" | "approvals" | "budgets" | "reports";
  isSuperAdmin?: boolean;
  /** Whether the current user can approve/reject expense requests (Direksi or Super Admin) */
  canApproveExpense?: boolean;
  /** Mirrors the server-side role gate on `createPayment` (Super Admin / Admin Keuangan / Admin Kantor). */
  canRecordPayment?: boolean;
}

/** Type for a single transaction item from the FinanceShellProps.transactions array */
type FinanceTransactionItem = FinanceShellProps["transactions"][number];

type FinanceTabKey = "invoices" | "payments" | "transactions" | "approvals" | "budgets" | "reports";

const financeTabs: Array<{ key: FinanceTabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "invoices", label: "Invoice & Tagihan", icon: FileText },
  { key: "payments", label: "Kas Masuk & Pembayaran", icon: CircleDollarSign },
  { key: "transactions", label: "Buku Kas Ledger", icon: BarChart3 },
  { key: "approvals", label: "Persetujuan Kas Keluar", icon: CheckCircle2 },
  { key: "budgets", label: "Anggaran Proyek", icon: FolderOpen },
  { key: "reports", label: "Laporan Statement", icon: PieChart },
];

export default function FinanceShell({
  activeUser,
  isSuperAdmin = false,
  canApproveExpense = false,
  canRecordPayment = false,
  projects,
  units,
  customers,
  accounts,
  categories,
  invoices: initialInvoices,
  payments: initialPayments,
  transactions: initialTransactions,
  budgets: initialBudgets,
  budgetLines: initialBudgetLines,
  budgetActualUsage: initialBudgetActualUsage,
  defaultTab,
}: FinanceShellProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [mounted, setMounted] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"invoices" | "payments" | "transactions" | "approvals" | "budgets" | "reports">(defaultTab || "invoices");
  
  React.useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);
  
  // Search & Filter States
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  // Period filter — null means "Semua Periode" (no date constraint applied)
  const [periodStart, setPeriodStart] = React.useState<Date | null>(null);
  const [periodEnd, setPeriodEnd] = React.useState<Date | null>(null);

  // Tab bar scroll & gradient state
  const tabListRef = React.useRef<HTMLDivElement>(null);
  const [showLeftGradient, setShowLeftGradient] = React.useState(false);
  const [showRightGradient, setShowRightGradient] = React.useState(false);

  const updateScrollGradients = React.useCallback(() => {
    const el = tabListRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftGradient(scrollLeft > 4);
    setShowRightGradient(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  React.useEffect(() => {
    const el = tabListRef.current;
    if (!el) return;
    updateScrollGradients();
    el.addEventListener("scroll", updateScrollGradients, { passive: true });
    const observer = new ResizeObserver(updateScrollGradients);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollGradients);
      observer.disconnect();
    };
  }, [updateScrollGradients]);

  // Modals & Action States
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [budgetOpen, setBudgetOpen] = React.useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = React.useState(false);
  const [activatingBudgetId, setActivatingBudgetId] = React.useState<string | null>(null);
  const [updatingBudgetId, setUpdatingBudgetId] = React.useState<string | null>(null);
  const [deletingBudgetId, setDeletingBudgetId] = React.useState<string | null>(null);
  
  // Create Payment Form State
  const [paymentForm, setPaymentForm] = React.useState({
    invoiceId: "",
    projectId: "",
    unitId: "",
    customerId: "",
    amount: "",
    paymentDate: "",
    paymentMethod: "transfer" as "cash" | "transfer" | "giro" | "other",
  });

  // Create Expense Form State
  const [expenseForm, setExpenseForm] = React.useState({
    projectId: "",
    accountId: "",
    categoryId: "",
    amount: "",
    description: "",
    transactionDate: "",
    paymentMethod: "transfer" as "cash" | "transfer" | "giro" | "other",
  });

  // Create Budget Form State
  const [budgetForm, setBudgetForm] = React.useState({
    projectId: "",
    name: "",
    periodStart: "",
    periodEnd: "",
    totalAmount: "",
    categoryId: "",
    allocatedAmount: "",
  });

  // Payment Verification Dialog state
  const [selectedPayment, setSelectedPayment] = React.useState<PaymentListItem | null>(null);
  const [verificationAccount, setVerificationAccount] = React.useState("");
  const [verificationNotes, setVerificationNotes] = React.useState("");

  // The shell applies the shared Project/Search/Period context. PaymentsTab
  // owns its own pagination so status filtering never loses rows first.
  const paymentPageData: PaginatedResult<PaymentListItem> = React.useMemo(() => {
    const filtered = initialPayments.filter(pay => {
      const matchesProj = selectedProjectId === "all" || pay.projectId === selectedProjectId;
      const matchesQuery = searchQuery === "" ||
        pay.paymentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pay.customerName && pay.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
      // Period filter — payment basis = paymentDate (Req 1.3), keeping the tab
      // consistent with the shared global period context. Inlined here (rather
      // than reusing isInPeriodByDate) because that callback is declared later.
      let matchesPeriod = true;
      if (periodStart || periodEnd) {
        const d = new Date(pay.paymentDate);
        if (periodStart && d < periodStart) matchesPeriod = false;
        if (periodEnd && d > periodEnd) matchesPeriod = false;
      }
      return matchesProj && matchesQuery && matchesPeriod;
    });
    const totalCount = filtered.length;
    return {
      data: filtered,
      totalCount,
      page: 1,
      pageSize: 20,
      totalPages: Math.max(1, Math.ceil(totalCount / 20)),
    };
  }, [initialPayments, selectedProjectId, searchQuery, periodStart, periodEnd]);

  // Expense Approval Dialog state
  const [selectedExpense, setSelectedExpense] = React.useState<FinanceTransactionItem | null>(null);
  const [approvalNotes, setApprovalNotes] = React.useState("");

  React.useEffect(() => {
    setMounted(true);
    
    // Set default dates dynamically on mount to prevent SSR hydration errors and impure function calls
    const todayStr = new Date().toISOString().slice(0, 10);
    const nextYearStr = new Date(Date.now() + 365*24*60*60*1000).toISOString().slice(0, 10);
    
    setPaymentForm(f => ({ ...f, paymentDate: todayStr }));
    setExpenseForm(f => ({ ...f, transactionDate: todayStr }));
    setBudgetForm(f => ({ ...f, periodStart: todayStr, periodEnd: nextYearStr }));

    // Autofill dialog default project if projects list is loaded
    if (projects.length > 0) {
      setPaymentForm(f => ({ ...f, projectId: projects[0].id }));
      setExpenseForm(f => ({ ...f, projectId: projects[0].id }));
      setBudgetForm(f => ({ ...f, projectId: projects[0].id }));
    }
    if (accounts.length > 0) {
      setVerificationAccount(accounts[0].id);
      setExpenseForm(f => ({ ...f, accountId: accounts[0].id }));
    }
    const expenseCats = categories.filter(c => c.type === "expense");
    if (expenseCats.length > 0) {
      setExpenseForm(f => ({ ...f, categoryId: expenseCats[0].id }));
      setBudgetForm(f => ({ ...f, categoryId: expenseCats[0].id }));
    }
  }, [projects, accounts, categories]);

  // ==========================================
  // METRICS & FILTERS COMPUTATIONS
  // ==========================================
  
  // -- Period filter helpers --
  /** Check if a transaction date falls within the period filter */
  const isInPeriodByDate = React.useCallback((date: Date | null | undefined): boolean => {
    if (!periodStart && !periodEnd) return true;
    if (!date) return false;
    const d = new Date(date);
    if (periodStart && d < periodStart) return false;
    if (periodEnd && d > periodEnd) return false;
    return true;
  }, [periodStart, periodEnd]);

  // Filter datasets based on selection
  const filteredTransactions = initialTransactions.filter(t => {
    const matchesProj = selectedProjectId === "all" || t.projectId === selectedProjectId;
    const matchesQuery = searchQuery === "" || 
      t.transactionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPeriod = isInPeriodByDate(t.transactionDate);
    return matchesProj && matchesQuery && matchesPeriod;
  });

  const pendingApprovals = initialTransactions.filter(t => 
    t.type === "expense" && 
    (t.approvalStatus === "pending" || t.approvalStatus === "insufficient_balance")
  );

  // All expense transactions (any approval status) for the Approvals tab.
  // Filtered by shared Project/Period/search context; approval status
  // sub-filter is applied inside ApprovalsTab. Period basis = transactionDate.
  const allExpenseTransactions = initialTransactions.filter(t => {
    const matchType = t.type === "expense";
    const matchProj = selectedProjectId === "all" || t.projectId === selectedProjectId;
    const matchQuery = searchQuery === "" ||
      t.transactionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchPeriod = isInPeriodByDate(t.transactionDate);
    return matchType && matchProj && matchQuery && matchPeriod;
  });

  const filteredBudgets = initialBudgets.filter(b => 
    selectedProjectId === "all" || b.projectId === selectedProjectId
  );

  // ==========================================
  // KAS SUMMARY (Req 1.4)
  // ==========================================

  // Total Kas Masuk: income with approvalStatus "not_required" OR "approved", filtered by project + period
  const totalIncomeVal = initialTransactions
    .filter(t =>
      t.type === "income" &&
      (t.approvalStatus === "not_required" || t.approvalStatus === "approved") &&
      (selectedProjectId === "all" || t.projectId === selectedProjectId) &&
      isInPeriodByDate(t.transactionDate)
    )
    .reduce((sum, t) => sum + t.amount, 0);

  // Pengeluaran Disetujui: expense with approvalStatus "approved", filtered by project + period
  const totalExpenseVal = initialTransactions
    .filter(t =>
      t.type === "expense" &&
      t.approvalStatus === "approved" &&
      (selectedProjectId === "all" || t.projectId === selectedProjectId) &&
      isInPeriodByDate(t.transactionDate)
    )
    .reduce((sum, t) => sum + t.amount, 0);

  // Saldo Bersih
  const netBalanceVal = totalIncomeVal - totalExpenseVal;

  // Piutang Berjalan: sum of remainingBalance from invoices where status is "unpaid" or "partial"
  // Use enriched remainingBalance field (from Task 14.1), filtered by dueDate (fallback createdAt) for period
  const totalPiutangVal = initialInvoices
    .filter(i => {
      const matchStatus = i.status === "unpaid" || i.status === "partial";
      const matchProj = selectedProjectId === "all" || i.projectId === selectedProjectId;
      const dateForPeriod = i.dueDate ?? i.createdAt;
      const matchPeriod = isInPeriodByDate(dateForPeriod);
      return matchStatus && matchProj && matchPeriod;
    })
    .reduce((sum, i) => sum + (i.remainingBalance ?? i.amount), 0);

  // ==========================================
  // BUDGET SUMMARY (Req 1.5 - 1.9)
  // ==========================================

  const budgetSummary = React.useMemo(() => {
    return computeFilteredBudgetTotals(
      initialBudgets,
      initialBudgetLines ?? [],
      initialBudgetActualUsage ?? [],
      {
        projectId: selectedProjectId === "all" ? null : selectedProjectId,
        periodStart: periodStart ?? null,
        periodEnd: periodEnd ?? null,
      }
    );
  }, [initialBudgets, initialBudgetLines, initialBudgetActualUsage, selectedProjectId, periodStart, periodEnd]);

  /** True if there are no active budgets matching the current filter */
  const hasNoActiveBudgets = budgetSummary.totalAllocated === 0 &&
    initialBudgets.filter(b => b.status === "active").length === 0 ||
    (budgetSummary.totalAllocated === 0 && budgetSummary.totalUsedActual === 0);

  // ==========================================
  // KPI COMPARISON (Req 1.9 - 1.11)
  // ==========================================

  const kpiComparison = React.useMemo(() => {
    // Only compute when a specific period is selected (not "Semua Periode")
    const isNeutral = periodStart === null || periodEnd === null;

    if (isNeutral) {
      const neutralResult = calculateKpiPercentageChange(0, 0, true);
      return {
        income: neutralResult,
        expense: neutralResult,
        netBalance: neutralResult,
        piutang: neutralResult,
        budget: neutralResult,
        comparisonLabel: null as string | null,
        isAllPeriod: true,
      };
    }

    // Compute previous period: M-1 from periodStart
    const prevEnd = new Date(periodStart);
    prevEnd.setDate(prevEnd.getDate() - 1); // day before periodStart
    const prevStart = new Date(prevEnd);
    prevStart.setDate(1); // first day of that month

    // Comparison label from prevEnd month
    const comparisonLabel = prevEnd.toLocaleDateString("id-ID", { month: "short", year: "numeric" });

    // Previous period filter
    const isInPrevPeriod = (date: Date | null | undefined): boolean => {
      if (!date) return false;
      const d = new Date(date);
      return d >= prevStart && d <= prevEnd;
    };

    // Previous income
    const prevIncome = initialTransactions
      .filter(t =>
        t.type === "income" &&
        (t.approvalStatus === "not_required" || t.approvalStatus === "approved") &&
        (selectedProjectId === "all" || t.projectId === selectedProjectId) &&
        isInPrevPeriod(t.transactionDate)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    // Previous expense
    const prevExpense = initialTransactions
      .filter(t =>
        t.type === "expense" &&
        t.approvalStatus === "approved" &&
        (selectedProjectId === "all" || t.projectId === selectedProjectId) &&
        isInPrevPeriod(t.transactionDate)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const prevNet = prevIncome - prevExpense;

    // Previous piutang
    const prevPiutang = initialInvoices
      .filter(i => {
        const matchStatus = i.status === "unpaid" || i.status === "partial";
        const matchProj = selectedProjectId === "all" || i.projectId === selectedProjectId;
        const dateForPeriod = i.dueDate ?? i.createdAt;
        return matchStatus && matchProj && isInPrevPeriod(dateForPeriod);
      })
      .reduce((sum, i) => sum + (i.remainingBalance ?? i.amount), 0);

    // Previous budget allocated (same filter logic as current)
    const prevBudgetSummary = computeFilteredBudgetTotals(
      initialBudgets,
      initialBudgetLines ?? [],
      initialBudgetActualUsage ?? [],
      {
        projectId: selectedProjectId === "all" ? null : selectedProjectId,
        periodStart: prevStart,
        periodEnd: prevEnd,
      }
    );

    return {
      income: calculateKpiPercentageChange(totalIncomeVal, prevIncome),
      expense: calculateKpiPercentageChange(totalExpenseVal, prevExpense),
      netBalance: calculateKpiPercentageChange(netBalanceVal, prevNet),
      piutang: calculateKpiPercentageChange(totalPiutangVal, prevPiutang),
      budget: calculateKpiPercentageChange(budgetSummary.totalAllocated, prevBudgetSummary.totalAllocated),
      comparisonLabel,
      isAllPeriod: false,
    };
  }, [
    periodStart, periodEnd, initialTransactions, initialInvoices, initialBudgets,
    initialBudgetLines, initialBudgetActualUsage, selectedProjectId,
    totalIncomeVal, totalExpenseVal, netBalanceVal, totalPiutangVal, budgetSummary.totalAllocated,
  ]);

  // ==========================================
  // BUDGET ALERT NOTICE (Req 3.1, 3.5)
  // ==========================================

  const budgetAlertData = React.useMemo(() => {
    const activeBudgets = initialBudgets.filter(b => {
      if (b.status !== "active") return false;
      if (selectedProjectId !== "all" && b.projectId !== selectedProjectId) return false;
      // Period filter on budget
      if (periodStart && new Date(b.periodEnd) < periodStart) return false;
      if (periodEnd && new Date(b.periodStart) > periodEnd) return false;
      return true;
    });

    const budgetsWithAbsorption = activeBudgets
      .map(b => {
        const usage = (initialBudgetActualUsage ?? [])
          .filter(u => u.budgetId === b.id)
          .reduce((sum, u) => sum + u.actualAmount, 0);
        const absorption = b.totalAmount > 0 ? (usage / b.totalAmount) * 100 : 0;
        return {
          id: b.id,
          name: b.name,
          totalAmount: b.totalAmount,
          usedAmount: usage,
          absorptionPercentage: absorption,
        };
      })
      .filter(b => b.absorptionPercentage > 80);

    if (budgetsWithAbsorption.length === 0) return null;

    // Sort by absorption desc, then alphabetical name for tie
    budgetsWithAbsorption.sort((a, b) => {
      if (b.absorptionPercentage !== a.absorptionPercentage) {
        return b.absorptionPercentage - a.absorptionPercentage;
      }
      return a.name.localeCompare(b.name);
    });

    return budgetsWithAbsorption[0];
  }, [initialBudgets, initialBudgetActualUsage, selectedProjectId, periodStart, periodEnd]);

  // ==========================================
  // HOME BUDGET SNAPSHOT
  // ==========================================

  const homeBudgetSnapshot = React.useMemo(() => {
    const scopedBudgets = initialBudgets.filter((budget) => {
      if (selectedProjectId !== "all" && budget.projectId !== selectedProjectId) return false;
      if (periodStart && new Date(budget.periodEnd) < periodStart) return false;
      if (periodEnd && new Date(budget.periodStart) > periodEnd) return false;
      return true;
    });

    const draftBudgets = scopedBudgets
      .filter((budget) => budget.status === "draft")
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 3);

    const activeBudgets = scopedBudgets.filter((budget) => budget.status === "active");
    const usedActual = activeBudgets.reduce((sum, budget) => {
      const used = (initialBudgetActualUsage ?? [])
        .filter((usage) => usage.budgetId === budget.id)
        .reduce((total, usage) => total + usage.actualAmount, 0);
      return sum + used;
    }, 0);
    const remaining = budgetSummary.totalAllocated - usedActual;
    const absorption =
      budgetSummary.totalAllocated > 0
        ? (usedActual / budgetSummary.totalAllocated) * 100
        : 0;

    return {
      activeCount: activeBudgets.length,
      draftBudgets,
      totalAllocated: budgetSummary.totalAllocated,
      usedActual,
      remaining,
      absorption,
    };
  }, [
    initialBudgets,
    initialBudgetActualUsage,
    selectedProjectId,
    periodStart,
    periodEnd,
    budgetSummary.totalAllocated,
  ]);

  // ==========================================
  // FORM SUBMISSION HANDLERS
  // ==========================================

  const handleCreatePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await createPayment({
        invoiceId: paymentForm.invoiceId || null,
        projectId: paymentForm.projectId,
        unitId: paymentForm.unitId || null,
        customerId: paymentForm.customerId || null,
        amount: Number(paymentForm.amount),
        paymentDate: new Date(paymentForm.paymentDate),
        paymentMethod: paymentForm.paymentMethod,
      });
      if (res.success) {
        toast.success(t("finance.payment_recorded"));
        setPaymentForm(f => ({ ...f, amount: "", invoiceId: "", unitId: "", customerId: "" }));
        setPaymentOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      const msg = err.message || "Gagal mencatat pembayaran";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyPaymentSubmit = async (isApproved: boolean) => {
    if (!selectedPayment) return;
    const isOwnUpload =
      selectedPayment.uploadedBy === activeUser.id ||
      (!selectedPayment.uploadedBy && selectedPayment.proofUploadedBy === activeUser.id);
    if (!isSuperAdmin && isOwnUpload) {
      const msg = "Anda tidak dapat memverifikasi bukti bayar yang Anda upload sendiri.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await verifyPayment(
        selectedPayment.id,
        isApproved,
        verificationAccount,
        verificationNotes
      );
      if (res.success) {
        // Sprint 3: Structured feedback — tampilkan info handover jika triggered
        if (isApproved && res.handoverTriggered) {
          toast.success(t("finance.payment_verified"), { description: t("finance.handover_triggered") });
        } else if (isApproved) {
          toast.success(t("finance.payment_verified"));
        } else {
          toast.info(t("finance.payment_rejected"));
        }
        setSelectedPayment(null);
        setVerificationNotes("");
        router.refresh();
      }
    } catch (err: any) {
      const msg = err.message || "Gagal memverifikasi pembayaran";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePaymentSubmit = async () => {
    if (!selectedPayment) return;
    if (!confirm("Apakah Anda yakin ingin menghapus data bukti pembayaran ini dari sistem secara permanen?")) return;
    
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await deletePayment(selectedPayment.id);
      if (res.success) {
        toast.success(t("finance.payment_deleted"));
        setSelectedPayment(null);
        router.refresh();
      }
    } catch (err: any) {
      const msg = err.message || "Gagal menghapus pembayaran";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await createExpenseRequest({
        projectId: expenseForm.projectId,
        accountId: expenseForm.accountId,
        categoryId: expenseForm.categoryId,
        amount: Number(expenseForm.amount),
        description: expenseForm.description,
        transactionDate: new Date(expenseForm.transactionDate),
        paymentMethod: expenseForm.paymentMethod,
      });
      if (res.success) {
        toast.success(t("finance.expense_submitted"));
        setExpenseForm(f => ({ ...f, amount: "", description: "" }));
        router.refresh();
      }
    } catch (err: any) {
      const msg = err.message || "Gagal mengajukan kas keluar";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExpenseApprovalSubmit = async (isApproved: boolean) => {
    if (!selectedExpense) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      let res;
      if (isApproved) {
        res = await approveExpense(selectedExpense.id, approvalNotes);
      } else {
        res = await rejectExpense(selectedExpense.id, approvalNotes);
      }
      if (res.success) {
        if (isApproved) {
          toast.success(t("finance.expense_approved"));
        } else {
          toast.info(t("finance.expense_rejected_msg"));
        }
        setSelectedExpense(null);
        setApprovalNotes("");
        router.refresh();
      }
    } catch (err: any) {
      const msg = err.message || "Operasi persetujuan gagal";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await createBudget({
        projectId: budgetForm.projectId,
        name: budgetForm.name,
        periodStart: new Date(budgetForm.periodStart),
        periodEnd: new Date(budgetForm.periodEnd),
        totalAmount: Number(budgetForm.totalAmount),
        lines: [
          {
            categoryId: budgetForm.categoryId,
            allocatedAmount: Number(budgetForm.allocatedAmount),
          },
        ],
      });
      if (res.success) {
        toast.success(t("finance.budget_created"));
        setBudgetForm(f => ({ ...f, name: "", totalAmount: "", allocatedAmount: "" }));
        setBudgetOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      const msg = err.message || "Gagal membuat anggaran";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivateBudget = async (budgetId: string) => {
    setActivatingBudgetId(budgetId);
    setErrorMsg(null);
    try {
      const res = await activateBudget(budgetId);
      if (res.success) {
        toast.success("Anggaran berhasil diaktifkan");
        router.refresh();
      }
    } catch (err) {
      const msg = parseServerError(err, "Gagal mengaktifkan anggaran. Silakan coba lagi.");
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setActivatingBudgetId(null);
    }
  };

  const handleUpdateDraftBudget = async (
    budgetId: string,
    data: {
      projectId: string;
      name: string;
      periodStart: Date;
      periodEnd: Date;
      totalAmount: number;
      lines: Array<{ categoryId: string; allocatedAmount: number }>;
    },
  ) => {
    setUpdatingBudgetId(budgetId);
    setErrorMsg(null);
    try {
      const res = await updateDraftBudget(budgetId, data);
      if (res.success) {
        toast.success("Draft anggaran berhasil diperbarui");
        router.refresh();
      }
    } catch (err) {
      const msg = parseServerError(err, "Gagal memperbarui draft anggaran. Silakan coba lagi.");
      setErrorMsg(msg);
      toast.error(msg);
      throw err;
    } finally {
      setUpdatingBudgetId(null);
    }
  };

  const handleDeleteDraftBudget = async (budgetId: string) => {
    setDeletingBudgetId(budgetId);
    setErrorMsg(null);
    try {
      const res = await deleteDraftBudget(budgetId);
      if (res.success) {
        toast.success("Draft anggaran berhasil dihapus");
        router.refresh();
      }
    } catch (err) {
      const msg = parseServerError(err, "Gagal menghapus draft anggaran. Silakan coba lagi.");
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setDeletingBudgetId(null);
    }
  };

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background" aria-busy="true" role="status">
        <div className="text-primary-dark font-semibold text-lg flex items-center gap-2">
          <Clock className="animate-spin h-5 w-5" aria-hidden="true" /> {t("finance.loading")}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col gap-6">
      
      {/* Header ringkas: data dan aksi utama selalu terlihat tanpa hero dekoratif. */}
      <section className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Keuangan Perusahaan</p>
          <p className="text-sm text-muted-foreground">
            Pantau kas, tagihan, pembayaran, dan anggaran perusahaan.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            onClick={() => setInvoiceDialogOpen(true)}
            className="min-h-11 gap-2 bg-[#4F6F52] px-4 font-semibold text-white hover:bg-[#4F6F52]/90"
          >
            <Plus className="h-4 w-4" />
            Buat Invoice
          </Button>
          {canRecordPayment && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setActiveTab("payments");
                setPaymentOpen(true);
              }}
              className="min-h-11 gap-2 px-4 font-semibold"
            >
              <Plus className="h-4 w-4" />
              Catat Pembayaran
            </Button>
          )}
        </div>
      </section>

      {/* Konteks filter bersama untuk seluruh modul finance. */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <FinanceFilterBar
          projects={projects}
          selectedProjectId={selectedProjectId === "all" ? null : selectedProjectId}
          onProjectChange={(id) => setSelectedProjectId(id ?? "all")}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onPeriodChange={(start, end) => {
            setPeriodStart(start);
            setPeriodEnd(end);
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t("finance.search_ph")}
        />
      </section>

      {/* Ringkasan utama: kas dan kondisi anggaran dibaca dalam satu pandangan. */}
      <FinanceSummaryGrid
        aria-label="Ringkasan utama keuangan"
        items={[
          {
            key: "kas-masuk",
            label: "Total Kas Masuk",
            value: totalIncomeVal,
            icon: <TrendingUp className="h-4 w-4" />,
            accent: "success",
            indicator: (
              <KpiComparisonIndicator
                result={kpiComparison.income}
                comparisonLabel={kpiComparison.comparisonLabel}
                isAllPeriod={kpiComparison.isAllPeriod}
              />
            ),
          },
          {
            key: "pengeluaran",
            label: "Pengeluaran Disetujui",
            value: totalExpenseVal,
            icon: <TrendingDown className="h-4 w-4" />,
            accent: "danger",
            indicator: (
              <KpiComparisonIndicator
                result={kpiComparison.expense}
                comparisonLabel={kpiComparison.comparisonLabel}
                isAllPeriod={kpiComparison.isAllPeriod}
              />
            ),
          },
          {
            key: "saldo",
            label: "Saldo Bersih",
            value: netBalanceVal,
            icon: <CircleDollarSign className="h-4 w-4" />,
            accent: "primary",
            indicator: (
              <KpiComparisonIndicator
                result={kpiComparison.netBalance}
                comparisonLabel={kpiComparison.comparisonLabel}
                isAllPeriod={kpiComparison.isAllPeriod}
              />
            ),
          },
          {
            key: "piutang",
            label: "Piutang Berjalan",
            value: totalPiutangVal,
            icon: <Clock className="h-4 w-4" />,
            accent: "warning",
            indicator: (
              <KpiComparisonIndicator
                result={kpiComparison.piutang}
                comparisonLabel={kpiComparison.comparisonLabel}
                isAllPeriod={kpiComparison.isAllPeriod}
              />
            ),
          },
          {
            key: "anggaran-aktif",
            label: "Anggaran Aktif",
            value: budgetSummary.totalAllocated,
            icon: <Wallet className="h-4 w-4" />,
            accent: hasNoActiveBudgets
              ? "warning"
              : budgetSummary.isOverBudget
                ? "danger"
                : "primary",
            indicator: hasNoActiveBudgets ? (
              <span className="text-xs text-muted-foreground">Belum ada anggaran aktif</span>
            ) : (
              <KpiComparisonIndicator
                result={kpiComparison.budget}
                comparisonLabel={kpiComparison.comparisonLabel}
                isAllPeriod={kpiComparison.isAllPeriod}
              />
            ),
          },
        ]}
      />

      {/* Budget Alert Notice — conditional */}
      <BudgetAlertNotice budget={budgetAlertData} />

      <section className="space-y-3" aria-label="Ringkasan Anggaran">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Ringkasan Anggaran</h3>
            <p className="text-xs text-muted-foreground">
              Pantau budget aktif, serapan, dan draft yang perlu diaktifkan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("budgets")}
            className="text-xs font-medium text-primary hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Lihat Semua Anggaran →
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Total Aktif
                </p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
                  {formatRupiah(homeBudgetSnapshot.totalAllocated)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Terpakai Aktual
                </p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums text-primary">
                  {formatRupiah(homeBudgetSnapshot.usedActual)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Sisa Anggaran
                </p>
                <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                  homeBudgetSnapshot.remaining < 0 ? "text-destructive" : "text-foreground"
                }`}>
                  {formatRupiah(homeBudgetSnapshot.remaining)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">
                  Serapan dari {homeBudgetSnapshot.activeCount} budget aktif
                </span>
                <span className="font-mono font-bold text-primary tabular-nums">
                  {homeBudgetSnapshot.absorption.toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-secondary">
                <div
                  className={`h-2 rounded-full ${
                    homeBudgetSnapshot.absorption > 100
                      ? "bg-destructive"
                      : homeBudgetSnapshot.absorption > 80
                        ? "bg-amber-500"
                        : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(homeBudgetSnapshot.absorption, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Draft Perlu Diaktifkan</p>
              <Badge className="border border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                {homeBudgetSnapshot.draftBudgets.length} draft
              </Badge>
            </div>
            {homeBudgetSnapshot.draftBudgets.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Tidak ada draft budget pada filter ini.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {homeBudgetSnapshot.draftBudgets.map((budget) => (
                  <div
                    key={budget.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{budget.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{budget.projectName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("budgets")}
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                    >
                      Buka
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. Responsive Tab Navigation with ARIA semantics and keyboard nav */}
      <div className="relative">
        {/* Left gradient indicator (mobile scroll) */}
        {showLeftGradient && (
          <div
            className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-background to-transparent md:hidden"
            aria-hidden="true"
          />
        )}
        {/* Right gradient indicator (mobile scroll) */}
        {showRightGradient && (
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-background to-transparent md:hidden"
            aria-hidden="true"
          />
        )}

        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Tab navigasi keuangan"
          aria-orientation="horizontal"
          className="flex gap-1 overflow-x-auto border-b border-border/80 px-1 scrollbar-none md:overflow-x-visible"
          onKeyDown={(e) => {
            const currentIndex = financeTabs.findIndex((t) => t.key === activeTab);
            let nextIndex = currentIndex;
            if (e.key === "ArrowRight") {
              e.preventDefault();
              nextIndex = (currentIndex + 1) % financeTabs.length;
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              nextIndex = (currentIndex - 1 + financeTabs.length) % financeTabs.length;
            } else if (e.key === "Home") {
              e.preventDefault();
              nextIndex = 0;
            } else if (e.key === "End") {
              e.preventDefault();
              nextIndex = financeTabs.length - 1;
            } else {
              return;
            }
            setActiveTab(financeTabs[nextIndex].key);
            // Focus the new tab button
            const tabEl = document.getElementById(`finance-tab-${financeTabs[nextIndex].key}`);
            tabEl?.focus();
          }}
        >
          {financeTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`finance-tab-${tab.key}`}
                aria-selected={isActive}
                aria-controls={`finance-panel-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex min-h-[44px] items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors duration-150 min-w-max focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.key === "approvals" && pendingApprovals.length > 0 && (
                  <Badge
                    className="ml-1.5 bg-destructive hover:bg-destructive text-destructive-foreground rounded-full px-1.5 py-0 text-[10px]"
                    aria-label={`${pendingApprovals.length} pengajuan menunggu persetujuan`}
                    title={`${pendingApprovals.length} pengajuan menunggu persetujuan`}
                  >
                    {pendingApprovals.length}
                  </Badge>
                )}
                {/* Centered active indicator keeps the baseline visually clean. */}
                {isActive && (
                  <span
                    className="pointer-events-none absolute inset-x-1/2 bottom-0 h-[3px] w-8 -translate-x-1/2 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Tab Panels Layouts */}
      <div
        role="tabpanel"
        id={`finance-panel-${activeTab}`}
        aria-labelledby={`finance-tab-${activeTab}`}
        tabIndex={0}
        className="focus-visible:outline-none"
      >

      {activeTab === "invoices" && (
        <InvoicesTab
          projects={projects}
          units={units}
          customers={customers}
          initialInvoices={initialInvoices}
          initialPayments={initialPayments}
          selectedProjectId={selectedProjectId}
          searchQuery={searchQuery}
          periodStart={periodStart}
          periodEnd={periodEnd}
        />
      )}

      {activeTab === "payments" && (
        <PaymentsTab
          projects={projects}
          units={units}
          customers={customers}
          accounts={accounts}
          initialInvoices={initialInvoices}
          initialPayments={initialPayments}
          paymentPageData={paymentPageData}
          paymentForm={paymentForm}
          setPaymentForm={setPaymentForm}
          paymentOpen={paymentOpen}
          setPaymentOpen={setPaymentOpen}
          selectedPayment={selectedPayment}
          setSelectedPayment={setSelectedPayment}
          verificationAccount={verificationAccount}
          setVerificationAccount={setVerificationAccount}
          verificationNotes={verificationNotes}
          setVerificationNotes={setVerificationNotes}
          currentUserId={activeUser.id}
          canSelfVerify={isSuperAdmin}
          errorMsg={errorMsg}
          isSubmitting={isSubmitting}
          isSuperAdmin={isSuperAdmin}
          canRecordPayment={canRecordPayment}
          onCreatePaymentSubmit={handleCreatePaymentSubmit}
          onVerifyPaymentSubmit={handleVerifyPaymentSubmit}
          onDeletePaymentSubmit={handleDeletePaymentSubmit}
        />
      )}

      {activeTab === "transactions" && (
        <TransactionsTab
          filteredTransactions={filteredTransactions}
          accounts={accounts}
          projects={projects}
          categories={categories}
          expenseForm={expenseForm}
          setExpenseForm={setExpenseForm}
          errorMsg={errorMsg}
          isSubmitting={isSubmitting}
          onCreateExpenseSubmit={handleCreateExpenseSubmit}
        />
      )}

      {activeTab === "approvals" && (
        <ApprovalsTab
          allExpenseTransactions={allExpenseTransactions}
          selectedExpense={selectedExpense}
          setSelectedExpense={(expense) => setSelectedExpense(expense)}
          approvalNotes={approvalNotes}
          setApprovalNotes={setApprovalNotes}
          errorMsg={errorMsg}
          isSubmitting={isSubmitting}
          onExpenseApprovalSubmit={handleExpenseApprovalSubmit}
          canApprove={canApproveExpense}
          budgets={initialBudgets}
          budgetLines={initialBudgetLines ?? []}
          budgetActualUsage={initialBudgetActualUsage ?? []}
        />
      )}

      {activeTab === "budgets" && (
        <BudgetsTab
          projects={projects}
          categories={categories}
          filteredBudgets={filteredBudgets}
          budgetLines={initialBudgetLines ?? []}
          budgetActualUsage={initialBudgetActualUsage ?? []}
          budgetForm={budgetForm}
          setBudgetForm={setBudgetForm}
          budgetOpen={budgetOpen}
          setBudgetOpen={setBudgetOpen}
          errorMsg={errorMsg}
          isSubmitting={isSubmitting}
          onCreateBudgetSubmit={handleCreateBudgetSubmit}
          onActivateBudget={handleActivateBudget}
          onUpdateDraftBudget={handleUpdateDraftBudget}
          onDeleteDraftBudget={handleDeleteDraftBudget}
          activatingBudgetId={activatingBudgetId}
          updatingBudgetId={updatingBudgetId}
          deletingBudgetId={deletingBudgetId}
          periodStart={periodStart}
          periodEnd={periodEnd}
        />
      )}

      {activeTab === "reports" && (
        <ReportsTab
          transactions={initialTransactions}
          invoices={initialInvoices}
          budgets={initialBudgets}
          budgetLines={initialBudgetLines ?? []}
          budgetActualUsage={initialBudgetActualUsage ?? []}
          accounts={accounts}
          projects={projects}
        />
      )}

      </div>
    </div>
    <CreateInvoiceDialog
      open={invoiceDialogOpen}
      onOpenChange={setInvoiceDialogOpen}
      projects={projects}
      units={units}
      customers={customers}
      onSuccess={() => router.refresh()}
    />
    </>
  );
}

