"use client";
import { useRouter } from "next/navigation";

import * as React from "react";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Search,
  FileText,
  FolderOpen,
  PieChart,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  createPayment,
  verifyPayment,
  deletePayment,
  createExpenseRequest,
  approveExpense,
  rejectExpense,
  createBudget,
} from "@/server/actions/finance";
import type { PaginatedResult } from "@/lib/pagination";
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
  defaultTab?: "invoices" | "payments" | "transactions" | "approvals" | "budgets" | "reports";
  isSuperAdmin?: boolean;
}

/** Type for a single transaction item from the FinanceShellProps.transactions array */
type FinanceTransactionItem = FinanceShellProps["transactions"][number];

type FinanceTabKey = "invoices" | "payments" | "transactions" | "approvals" | "budgets" | "reports";

const financeTabs: Array<{ key: FinanceTabKey; labelKey: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "invoices", labelKey: "finance.tab_invoices", icon: FileText },
  { key: "payments", labelKey: "finance.tab_payments", icon: FileText },
  { key: "transactions", labelKey: "finance.tab_transactions", icon: CircleDollarSign },
  { key: "approvals", labelKey: "finance.tab_approvals", icon: Clock },
  { key: "budgets", labelKey: "finance.tab_budgets", icon: FolderOpen },
  { key: "reports", labelKey: "finance.tab_reports", icon: PieChart },
];

export default function FinanceShell({
  activeUser,
  isSuperAdmin = false,
  projects,
  units,
  customers,
  accounts,
  categories,
  invoices: initialInvoices,
  payments: initialPayments,
  transactions: initialTransactions,
  budgets: initialBudgets,
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

  // Modals & Action States
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [budgetOpen, setBudgetOpen] = React.useState(false);
  
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

  // -- Client-side paginated payment state --
  const PAYMENT_PAGE_SIZE = 20;
  const paymentPageData: PaginatedResult<PaymentListItem> = React.useMemo(() => {
    const filtered = initialPayments.filter(pay => {
      const matchesProj = selectedProjectId === "all" || pay.projectId === selectedProjectId;
      const matchesQuery = searchQuery === "" ||
        pay.paymentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pay.customerName && pay.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesProj && matchesQuery;
    });
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAYMENT_PAGE_SIZE));
    const data = filtered.slice(0, PAYMENT_PAGE_SIZE);
    return { data, totalCount, page: 1, pageSize: PAYMENT_PAGE_SIZE, totalPages };
  }, [initialPayments, selectedProjectId, searchQuery]);

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
  
  // Filter datasets based on selection
  const filteredTransactions = initialTransactions.filter(t => {
    const matchesProj = selectedProjectId === "all" || t.projectId === selectedProjectId;
    const matchesQuery = searchQuery === "" || 
      t.transactionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProj && matchesQuery;
  });

  const pendingApprovals = initialTransactions.filter(t => 
    t.type === "expense" && 
    (t.approvalStatus === "pending" || t.approvalStatus === "insufficient_balance")
  );

  const filteredBudgets = initialBudgets.filter(b => 
    selectedProjectId === "all" || b.projectId === selectedProjectId
  );

  // Financial Report aggregations
  const totalIncomeVal = initialTransactions
    .filter(t => t.type === "income" && (selectedProjectId === "all" || t.projectId === selectedProjectId))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenseVal = initialTransactions
    .filter(t => t.type === "expense" && t.approvalStatus === "approved" && (selectedProjectId === "all" || t.projectId === selectedProjectId))
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalanceVal = totalIncomeVal - totalExpenseVal;

  const totalUnpaidVal = initialInvoices
    .filter(i => i.status === "unpaid" && (selectedProjectId === "all" || i.projectId === selectedProjectId))
    .reduce((sum, i) => sum + i.amount, 0);

  // Recharts aggregated cashflow data
  const monthlyData = [
    { name: t("finance.report_income_label"), Nominal: totalIncomeVal, fill: "#8FAF9A" },
    { name: t("finance.report_expense_label"), Nominal: totalExpenseVal, fill: "#D77A7A" },
    { name: t("finance.report_net_label"), Nominal: netBalanceVal, fill: "#4F6F52" },
  ];

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

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-primary-dark font-semibold text-lg flex items-center gap-2">
          <Clock className="animate-spin h-5 w-5" /> {t("finance.loading")}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col gap-6">
      
      {/* -- PREMIUM HEADER -- */}
      <PageHeader
        icon={<CircleDollarSign className="h-6 w-6" />}
        title={t("finance.title")}
        description={t("finance.subtitle")}
        actions={
          <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-[280px_280px]">
            {/* Project Selector filter */}
            <div className="min-w-0">
              <Select 
                value={selectedProjectId} 
                onValueChange={(val) => setSelectedProjectId(val || "all")}
                items={[{ label: t("finance.all_projects"), value: "all" }, ...projects.map(p => ({ label: p.name, value: p.id }))] }
              >
                <SelectTrigger className="!w-[280px] min-w-0 h-10 bg-white/90 backdrop-blur-sm border-border focus:ring-ring rounded-2xl shadow-sm px-4 text-sm">
                  <SelectValue className="min-w-0 flex-1 truncate pr-2" placeholder={t("finance.all_projects")}>
                    <span className="block truncate">
                      {selectedProjectId === "all" ? t("finance.all_projects") : projects.find(p => p.id === selectedProjectId)?.name}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("finance.all_projects")}</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative min-w-0">
              <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground/70" />
              <Input
                placeholder={t("finance.search_ph")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="!w-[280px] h-8 pl-9 pr-4 bg-white/90 backdrop-blur-sm border-border focus-visible:ring-ring rounded-2xl shadow-sm text-sm"
              />
            </div>
          </div>
        }
      />

      {/* 2. Top Banner Metrics Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("finance.kpi_income")}
          value={`Rp ${totalIncomeVal.toLocaleString("id-ID")}`}
          icon={<TrendingUp className="h-5 w-5" />}
          colorScheme="#10b981"
        />
        <StatCard
          title={t("finance.kpi_expense")}
          value={`Rp ${totalExpenseVal.toLocaleString("id-ID")}`}
          icon={<TrendingDown className="h-5 w-5" />}
          colorScheme="#f43f5e"
        />
        <StatCard
          title={t("finance.kpi_net")}
          value={`Rp ${netBalanceVal.toLocaleString("id-ID")}`}
          icon={<CircleDollarSign className="h-5 w-5" />}
          colorScheme="#4F6F52"
        />
        <StatCard
          title={t("finance.kpi_ar")}
          value={`Rp ${totalUnpaidVal.toLocaleString("id-ID")}`}
          icon={<Clock className="h-5 w-5" />}
          colorScheme="#f59e0b"
        />
      </div>

      {/* 3. Operational Custom Tabs Navigation */}
      <div role="tablist" aria-label={t("finance.title")} className="flex border-b border-border">
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
              className={`relative px-4 py-2 text-sm font-semibold border-b-2 transition-colors duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {t(tab.labelKey as Parameters<typeof t>[0])}
              {tab.key === "approvals" && pendingApprovals.length > 0 && (
                <Badge className="ml-1.5 bg-destructive hover:bg-destructive text-destructive-foreground rounded-full px-1.5 py-0 text-[10px]">
                  {pendingApprovals.length}
                </Badge>
              )}
            </button>
          );
        })}
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
          pendingApprovals={pendingApprovals}
          selectedExpense={selectedExpense}
          setSelectedExpense={(expense: any) => setSelectedExpense(expense)}
          approvalNotes={approvalNotes}
          setApprovalNotes={setApprovalNotes}
          errorMsg={errorMsg}
          isSubmitting={isSubmitting}
          onExpenseApprovalSubmit={handleExpenseApprovalSubmit}
        />
      )}

      {activeTab === "budgets" && (
        <BudgetsTab
          projects={projects}
          categories={categories}
          filteredBudgets={filteredBudgets}
          budgetForm={budgetForm}
          setBudgetForm={setBudgetForm}
          budgetOpen={budgetOpen}
          setBudgetOpen={setBudgetOpen}
          errorMsg={errorMsg}
          isSubmitting={isSubmitting}
          onCreateBudgetSubmit={handleCreateBudgetSubmit}
        />
      )}

      {activeTab === "reports" && (
        <ReportsTab
          totalIncomeVal={totalIncomeVal}
          totalExpenseVal={totalExpenseVal}
          netBalanceVal={netBalanceVal}
          monthlyData={monthlyData}
        />
      )}

      </div>
    </div>
    </>
  );
}

