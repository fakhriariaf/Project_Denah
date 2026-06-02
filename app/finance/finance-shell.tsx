"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { InvoicePrintModal } from "@/components/invoice-print-modal";
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
import { Progress } from "@/components/ui/progress";
import {
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  FolderOpen,
  PieChart,
  Download,
  FileUp,
  Filter,
  Check,
  Percent,
  Eye,
  Trash2,
} from "lucide-react";
import {
  createInvoice,
  createPayment,
  verifyPayment,
  deletePayment,
  createExpenseRequest,
  approveExpense,
  rejectExpense,
  createBudget,
  deleteInvoice,
} from "@/server/actions/finance";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  Legend,
  CartesianGrid,
} from "recharts";

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
    status: "pending" | "verified" | "rejected";
    verifiedBy: string | null;
    verifiedAt: Date | null;
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
  defaultTab?: "payments" | "transactions" | "approvals" | "budgets" | "reports";
  isSuperAdmin?: boolean;
}

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
  const [activeTab, setActiveTab] = React.useState<"payments" | "transactions" | "approvals" | "budgets" | "reports">(defaultTab || "payments");
  
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
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [budgetOpen, setBudgetOpen] = React.useState(false);
  
  // Create Invoice Form State
  const [invoiceForm, setInvoiceForm] = React.useState({
    projectId: "",
    unitId: "",
    customerId: "",
    type: "booking_fee" as "booking_fee" | "dp" | "installment" | "other",
    amount: "",
    dueDate: "",
    notes: "",
  });

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
  const [selectedPayment, setSelectedPayment] = React.useState<any>(null);
  const [verificationAccount, setVerificationAccount] = React.useState("");
  const [verificationNotes, setVerificationNotes] = React.useState("");

  // Invoice Print Modal state
  const [printInvoice, setPrintInvoice] = React.useState<typeof initialInvoices[0] | null>(null);

  // Expense Approval Dialog state
  const [selectedExpense, setSelectedExpense] = React.useState<any>(null);
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
      setInvoiceForm(f => ({ ...f, projectId: projects[0].id }));
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
  const filteredInvoices = initialInvoices.filter(i => {
    const matchesProj = selectedProjectId === "all" || i.projectId === selectedProjectId;
    const matchesQuery = searchQuery === "" || 
      i.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.customerName && i.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (i.unitCode && i.unitCode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesProj && matchesQuery;
  });

  const filteredPayments = initialPayments.filter(p => {
    const matchesProj = selectedProjectId === "all" || p.projectId === selectedProjectId;
    const matchesQuery = searchQuery === "" || 
      p.paymentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.customerName && p.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.unitCode && p.unitCode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesProj && matchesQuery;
  });

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

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await createInvoice({
        projectId: invoiceForm.projectId,
        unitId: invoiceForm.unitId || null,
        customerId: invoiceForm.customerId || null,
        type: invoiceForm.type,
        amount: Number(invoiceForm.amount),
        dueDate: invoiceForm.dueDate ? new Date(invoiceForm.dueDate) : null,
        notes: invoiceForm.notes || null,
      });
      if (res.success) {
        // Reset and close
        alert(t("finance.invoice_created"));
        setInvoiceForm(f => ({ ...f, amount: "", notes: "", dueDate: "" }));
        setInvoiceOpen(false);
        window.location.reload();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        alert(t("finance.payment_recorded"));
        setPaymentForm(f => ({ ...f, amount: "", invoiceId: "", unitId: "", customerId: "" }));
        setPaymentOpen(false);
        window.location.reload();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mencatat pembayaran");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyPaymentSubmit = async (isApproved: boolean) => {
    if (!selectedPayment) return;
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
          alert(`✅ ${t("finance.payment_verified")}\n\n${t("finance.handover_triggered")}`);
        } else {
          alert(isApproved ? t("finance.payment_verified") : t("finance.payment_rejected"));
        }
        setSelectedPayment(null);
        setVerificationNotes("");
        window.location.reload();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memverifikasi pembayaran");
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
        alert(t("finance.payment_deleted"));
        setSelectedPayment(null);
        window.location.reload();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menghapus pembayaran");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus invoice ini secara permanen dari sistem?")) return;
    
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await deleteInvoice(invoiceId);
      if (res.success) {
        alert(t("finance.invoice_deleted"));
        window.location.reload();
      }
    } catch (err: any) {
      alert(err.message || "Gagal menghapus invoice");
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
        alert(t("finance.expense_submitted"));
        setExpenseForm(f => ({ ...f, amount: "", description: "" }));
        window.location.reload();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengajukan kas keluar");
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
        alert(isApproved ? t("finance.expense_approved") : t("finance.expense_rejected_msg"));
        setSelectedExpense(null);
        setApprovalNotes("");
        window.location.reload();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Operasi persetujuan gagal");
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
        alert(t("finance.budget_created"));
        setBudgetForm(f => ({ ...f, name: "", totalAmount: "", allocatedAmount: "" }));
        setBudgetOpen(false);
        window.location.reload();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat anggaran");
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

  // Pre-filter units for selected project to help form autofill
  const currentProjUnits = units.filter(u => u.projectId === invoiceForm.projectId);

  return (
    <>
    <div className="flex flex-col gap-6">
      
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <CircleDollarSign className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#243028] tracking-tight">{t("finance.title")}</h2>
              <p className="text-sm text-[#66736A] mt-0.5">{t("finance.subtitle")}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 self-end lg:self-center">
            {/* Project Selector filter */}
            <div className="w-[200px]">
              <Select 
                value={selectedProjectId} 
                onValueChange={(val) => setSelectedProjectId(val || "all")}
                items={[{ label: t("finance.all_projects"), value: "all" }, ...projects.map(p => ({ label: p.name, value: p.id }))] }
              >
                <SelectTrigger className="bg-white/90 backdrop-blur-sm border-[#D6DED2] focus:ring-[#8FAF9A] rounded-xl shadow-sm">
                  <SelectValue placeholder={t("finance.all_projects")}>
                    {selectedProjectId === "all" ? t("finance.all_projects") : projects.find(p => p.id === selectedProjectId)?.name}
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

            <div className="relative w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#A8B0AA]" />
              <Input
                placeholder={t("finance.search_ph")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white/90 backdrop-blur-sm border-[#D6DED2] focus-visible:ring-[#8FAF9A] rounded-xl shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Banner Metrics Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Kas Masuk */}
        <Card className="bg-white/75 backdrop-blur-md border border-[#D6DED2]/80 shadow-sage hover:shadow-sage-lg hover:-translate-y-1 transition-premium rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-[#8FAF9A]" />
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-emerald-500/5 group-hover:scale-150 transition-premium duration-500" />
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs text-[#66736A] font-semibold uppercase tracking-wider">{t("finance.kpi_income")}</p>
              <h3 className="text-xl font-extrabold font-mono text-[#4F6F52] mt-1.5 tracking-tight tabular-nums">
                Rp {totalIncomeVal.toLocaleString("id-ID")}
              </h3>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-premium">
              <TrendingUp className="h-5.5 w-5.5 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Pengeluaran Disetujui */}
        <Card className="bg-white/75 backdrop-blur-md border border-[#D6DED2]/80 shadow-sage hover:shadow-sage-lg hover:-translate-y-1 transition-premium rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-400 to-[#D77A7A]" />
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-rose-500/5 group-hover:scale-150 transition-premium duration-500" />
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs text-[#66736A] font-semibold uppercase tracking-wider">{t("finance.kpi_expense")}</p>
              <h3 className="text-xl font-extrabold font-mono text-[#D77A7A] mt-1.5 tracking-tight tabular-nums">
                Rp {totalExpenseVal.toLocaleString("id-ID")}
              </h3>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-rose-50 text-[#D77A7A] border border-rose-100 flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-[#D77A7A] group-hover:text-white transition-premium">
              <TrendingDown className="h-5.5 w-5.5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Saldo Bersih */}
        <Card className="bg-white/75 backdrop-blur-md border border-[#D6DED2]/80 shadow-sage hover:shadow-sage-lg hover:-translate-y-1 transition-premium rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8FAF9A] to-[#4F6F52]" />
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-[#8FAF9A]/5 group-hover:scale-150 transition-premium duration-500" />
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs text-[#66736A] font-semibold uppercase tracking-wider">{t("finance.kpi_net")}</p>
              <h3 className="text-xl font-extrabold font-mono text-[#4F6F52] mt-1.5 tracking-tight tabular-nums">
                Rp {netBalanceVal.toLocaleString("id-ID")}
              </h3>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-[#DDE8D8] text-[#4F6F52] border border-[#8FAF9A]/20 flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-[#4F6F52] group-hover:text-white transition-premium">
              <CircleDollarSign className="h-5.5 w-5.5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Piutang Berjalan */}
        <Card className="bg-white/75 backdrop-blur-md border border-[#D6DED2]/80 shadow-sage hover:shadow-sage-lg hover:-translate-y-1 transition-premium rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-[#E9C46A]" />
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-amber-500/5 group-hover:scale-150 transition-premium duration-500" />
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs text-[#66736A] font-semibold uppercase tracking-wider">{t("finance.kpi_ar")}</p>
              <h3 className="text-xl font-extrabold font-mono text-[#E9C46A] mt-1.5 tracking-tight tabular-nums">
                Rp {totalUnpaidVal.toLocaleString("id-ID")}
              </h3>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-amber-50 text-[#E9C46A] border border-amber-100 flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-[#E9C46A] group-hover:text-white transition-premium">
              <Clock className="h-5.5 w-5.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Operational Custom Tabs Navigation */}
      <div className="flex border-b border-[#D6DED2]">
        <button
          onClick={() => setActiveTab("payments")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors duration-150 flex items-center gap-2 ${
            activeTab === "payments"
              ? "border-[#4F6F52] text-[#4F6F52]"
              : "border-transparent text-[#66736A] hover:text-[#243028]"
          }`}
        >
          <FileText className="h-4 w-4" /> {t("finance.tab_payments")}
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors duration-150 flex items-center gap-2 ${
            activeTab === "transactions"
              ? "border-[#4F6F52] text-[#4F6F52]"
              : "border-transparent text-[#66736A] hover:text-[#243028]"
          }`}
        >
          <CircleDollarSign className="h-4 w-4" /> {t("finance.tab_transactions")}
        </button>
        
        {/* Approvals tab only for Super Admin or Manager/Director */}
        <button
          onClick={() => setActiveTab("approvals")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors duration-150 flex items-center gap-2 relative ${
            activeTab === "approvals"
              ? "border-[#4F6F52] text-[#4F6F52]"
              : "border-transparent text-[#66736A] hover:text-[#243028]"
          }`}
        >
          <Clock className="h-4 w-4" /> {t("finance.tab_approvals")}
          {pendingApprovals.length > 0 && (
            <Badge className="ml-1.5 bg-[#D77A7A] hover:bg-[#D77A7A] text-white rounded-full px-1.5 py-0 text-[10px]">
              {pendingApprovals.length}
            </Badge>
          )}
        </button>

        <button
          onClick={() => setActiveTab("budgets")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors duration-150 flex items-center gap-2 ${
            activeTab === "budgets"
              ? "border-[#4F6F52] text-[#4F6F52]"
              : "border-transparent text-[#66736A] hover:text-[#243028]"
          }`}
        >
          <FolderOpen className="h-4 w-4" /> {t("finance.tab_budgets")}
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors duration-150 flex items-center gap-2 ${
            activeTab === "reports"
              ? "border-[#4F6F52] text-[#4F6F52]"
              : "border-transparent text-[#66736A] hover:text-[#243028]"
          }`}
        >
          <PieChart className="h-4 w-4" /> {t("finance.tab_reports")}
        </button>
      </div>

      {/* 4. Tab Panels Layouts */}
      
      {/* ==========================================
          TAB 1: PAYMENTS / KAS MASUK
          ========================================== */}
      {activeTab === "payments" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Unpaid / Partial Invoice billing list */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white border-[#D6DED2]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-[#243028]">{t("finance.invoice_list_title")}</CardTitle>
                  <CardDescription className="text-xs">{t("finance.invoice_list_desc")}</CardDescription>
                </div>
                <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
                  <DialogTrigger nativeButton={true} render={
                    <Button className="bg-[#8FAF9A] hover:bg-[#4F6F52] text-white flex items-center gap-1.5 text-xs">
                      <Plus className="h-3.5 w-3.5" /> {t("finance.invoice_btn_new")}
                    </Button>
                  } />
                  <DialogContent className="bg-white">
                    <DialogHeader>
                      <DialogTitle>{t("finance.invoice_form_title")}</DialogTitle>
                      <DialogDescription>{t("finance.invoice_form_desc")}</DialogDescription>
                    </DialogHeader>
                    {errorMsg && (
                      <div className="p-3 bg-rose-50 text-danger border border-rose-100 rounded-md text-xs font-semibold">
                        {errorMsg}
                      </div>
                    )}
                    <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_project")}</label>
                          <Select
                            value={invoiceForm.projectId}
                            onValueChange={(val) => setInvoiceForm(f => ({ ...f, projectId: val || "", unitId: "" }))}
                            items={projects.map(p => ({ label: p.name, value: p.id }))}
                          >
                            <SelectTrigger className="bg-white border-[#D6DED2] w-full">
                              <SelectValue placeholder={t("finance.invoice_lbl_project")}>
                                {invoiceForm.projectId ? projects.find(p => p.id === invoiceForm.projectId)?.name : undefined}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {projects.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_unit")}</label>
                          <Select
                            value={invoiceForm.unitId}
                            onValueChange={(val) => setInvoiceForm(f => ({ ...f, unitId: val || "" }))}
                            items={currentProjUnits.map(u => ({ label: u.code, value: u.id }))}
                          >
                            <SelectTrigger className="bg-white border-[#D6DED2] w-full">
                              <SelectValue placeholder={t("finance.invoice_lbl_unit")}>
                                {invoiceForm.unitId ? units.find(u => u.id === invoiceForm.unitId)?.code : undefined}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {currentProjUnits.map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.code}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_customer")}</label>
                        <Select
                          value={invoiceForm.customerId}
                          onValueChange={(val) => setInvoiceForm(f => ({ ...f, customerId: val || "" }))}
                          items={customers.map(c => ({ label: `${c.name} (${c.phone})`, value: c.id }))}
                        >
                          <SelectTrigger className="bg-white border-[#D6DED2] w-full">
                            <SelectValue placeholder="Pilih Customer">
                              {invoiceForm.customerId ? (() => {
                                const c = customers.find(cust => cust.id === invoiceForm.customerId);
                                return c ? `${c.name} (${c.phone})` : undefined;
                              })() : undefined}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_type")}</label>
                          <Select
                            value={invoiceForm.type}
                            onValueChange={(val: any) => setInvoiceForm(f => ({ ...f, type: val }))}
                            items={[
                              { label: t("finance.invoice_type_bf"), value: "booking_fee" },
                              { label: t("finance.invoice_type_dp"), value: "dp" },
                              { label: t("finance.invoice_type_inst"), value: "installment" },
                              { label: t("finance.invoice_type_other"), value: "other" },
                            ]}
                          >
                            <SelectTrigger className="bg-white border-[#D6DED2] w-full">
                              <SelectValue placeholder={t("finance.invoice_lbl_type")}>
                                {invoiceForm.type === "booking_fee" && t("finance.invoice_type_bf")}
                                {invoiceForm.type === "dp" && t("finance.invoice_type_dp")}
                                {invoiceForm.type === "installment" && t("finance.invoice_type_inst")}
                                {invoiceForm.type === "other" && t("finance.invoice_type_other")}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="booking_fee">{t("finance.invoice_type_bf")}</SelectItem>
                              <SelectItem value="dp">{t("finance.invoice_type_dp")}</SelectItem>
                              <SelectItem value="installment">{t("finance.invoice_type_inst")}</SelectItem>
                              <SelectItem value="other">{t("finance.invoice_type_other")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_amount")}</label>
                          <Input
                            type="number"
                            placeholder="Rp 0"
                            value={invoiceForm.amount}
                            onChange={(e) => setInvoiceForm(f => ({ ...f, amount: e.target.value }))}
                            className="bg-white border-[#D6DED2]"
                            required
                          />
                        </div>
                      </div>

                      {/* 🌟 Dynamic Readable Amount Live Preview Card */}
                      {invoiceForm.amount && !isNaN(Number(invoiceForm.amount)) && (
                        <div className="p-2.5 bg-[#DDE8D8]/50 border border-[#8FAF9A]/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                          <span className="text-[9px] font-bold text-[#66736A] uppercase tracking-wider block">{t("finance.invoice_format_rupiah")}</span>
                          <span className="font-mono font-extrabold text-sm text-[#4F6F52] tracking-tight tabular-nums">
                            Rp {Number(invoiceForm.amount).toLocaleString("id-ID")}
                          </span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_due")}</label>
                        <Input
                          type="date"
                          value={invoiceForm.dueDate}
                          onChange={(e) => setInvoiceForm(f => ({ ...f, dueDate: e.target.value }))}
                          className="bg-white border-[#D6DED2]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#243028]">{t("finance.invoice_lbl_notes")}</label>
                        <Input
                          placeholder={t("finance.invoice_lbl_notes_ph")}
                          value={invoiceForm.notes}
                          onChange={(e) => setInvoiceForm(f => ({ ...f, notes: e.target.value }))}
                          className="bg-white border-[#D6DED2]"
                        />
                      </div>

                      <DialogFooter>
                        <Button
                          type="submit"
                          className="bg-[#4F6F52] hover:bg-[#8FAF9A] text-white w-full"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? t("finance.saving") : t("finance.invoice_btn_submit")}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("finance.col_invoice_no")}</TableHead>
                      <TableHead>{t("finance.col_customer")}</TableHead>
                      <TableHead>{t("finance.col_kavling")}</TableHead>
                      <TableHead>{t("finance.col_type")}</TableHead>
                      <TableHead className="text-right">{t("finance.col_amount")}</TableHead>
                      <TableHead className="text-center">{t("finance.col_status")}</TableHead>
                      <TableHead className="text-center">{t("finance.col_action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                              <FileText className="h-8 w-8 text-[#4F6F52]" />
                            </div>
                            <div>
                              <p className="font-semibold text-[#243028] text-sm">{t("finance.invoice_empty")}</p>
                              <p className="text-xs text-[#66736A] mt-1">{t("finance.invoice_empty_desc")}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInvoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs font-semibold text-[#243028]">
                            {inv.invoiceNumber}
                          </TableCell>
                          <TableCell className="text-xs text-[#243028]">
                            {inv.customerName || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-[#66736A]">
                            {inv.unitCode || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {inv.type === "dp" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FBE4C9] text-[#7A3D0E] border border-[#D47A2E]/30 text-[10px] font-bold uppercase tracking-wide">
                                🏗️ {t("finance.invoice_type_dp")}
                              </span>
                            ) : inv.type === "booking_fee" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF0A0] text-[#6B4F00] border border-[#D4A017]/30 text-[10px] font-bold uppercase tracking-wide">
                                {t("finance.invoice_type_bf")}
                              </span>
                            ) : inv.type === "installment" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C7E8F7] text-[#0E3F57] border border-[#2196C4]/30 text-[10px] font-bold uppercase tracking-wide">
                                {t("finance.invoice_type_inst")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E7E9E7] text-[#3D4840] text-[10px] font-semibold uppercase tracking-wide">
                                {inv.type.replace("_", " ")}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-[#243028] tabular-nums text-xs">
                            Rp {inv.amount.toLocaleString("id-ID")}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <Badge
                                className={
                                  inv.status === "paid"
                                    ? "bg-[#DCECF7] text-[#33627A]"
                                    : inv.status === "partial"
                                    ? "bg-[#FBE4C9] text-[#9A5C21]"
                                    : "bg-[#F3D1D1] text-[#8A3030]"
                                }
                              >
                                {inv.status === "paid"
                                  ? t("finance.status_paid")
                                  : inv.status === "partial"
                                  ? t("finance.status_partial")
                                  : t("finance.status_unpaid")}
                              </Badge>
                              {(() => {
                                const matchingPayment = initialPayments.find(p => p.invoiceId === inv.id && p.proofFileUrl);
                                if (matchingPayment?.proofFileUrl) {
                                  return (
                                    <a
                                      href={matchingPayment.proofFileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] text-[#4F6F52] hover:text-[#3D563F] underline font-bold inline-flex items-center gap-1 mt-0.5"
                                    >
                                      <Eye className="h-3 w-3" /> {t("finance.view_proof")}
                                    </a>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </TableCell>
                          {/* PRINT & DELETE BUTTONS */}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setPrintInvoice(inv)}
                                title={t("finance.btn_print")}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#DDE8D8] hover:bg-[#4F6F52] text-[#4F6F52] hover:text-white text-[11px] font-semibold transition-all duration-200 hover:scale-105 border border-[#8FAF9A]/30"
                              >
                                🖨️ {t("finance.btn_print")}
                              </button>
                              <button
                                onClick={() => handleDeleteInvoice(inv.id)}
                                title="Hapus Invoice"
                                disabled={isSubmitting}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-[#D77A7A] text-[#D77A7A] hover:text-white text-[11px] font-semibold transition-all duration-200 hover:scale-105 border border-rose-200 disabled:opacity-50"
                              >
                                <Trash2 className="h-3 w-3" />
                                Hapus
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          {/* Verification queue for Keuangan */}
          <div className="space-y-6">
            <Card className="bg-white/70 backdrop-blur-md border border-[#D6DED2]/80 shadow-sage hover:shadow-sage-lg transition-premium rounded-3xl">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#243028]">{t("finance.verify_queue_title")}</CardTitle>
                  <CardDescription className="text-xs text-[#66736A] font-medium">{t("finance.verify_queue_desc")}</CardDescription>
                </div>
                <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
                  <DialogTrigger nativeButton={true} render={
                    <Button className="bg-[#8FAF9A] hover:bg-[#4F6F52] text-white flex items-center gap-1.5 text-xs px-2.5 h-8.5 rounded-xl shadow-sage hover:scale-[1.02] active:scale-[0.98] transition-premium">
                      <Plus className="h-3.5 w-3.5" /> {t("finance.payment_btn_new")}
                    </Button>
                  } />
                  <DialogContent className="bg-white/95 backdrop-blur-md border-[#D6DED2] shadow-sage-lg rounded-3xl p-6 max-w-md sm:max-w-xl">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold text-[#243028]">{t("finance.payment_form_title")}</DialogTitle>
                      <DialogDescription className="text-xs text-[#66736A]">{t("finance.payment_form_desc")}</DialogDescription>
                    </DialogHeader>
                    {errorMsg && (
                      <div className="p-3 bg-rose-50 text-[#8B3443] border border-rose-100 rounded-xl text-xs font-semibold animate-shake">
                        {errorMsg}
                      </div>
                    )}
                    <form onSubmit={handleCreatePaymentSubmit} className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.payment_lbl_invoice")}</label>
                        <Select
                          value={paymentForm.invoiceId}
                          onValueChange={(val) => {
                            if (!val) return;
                            const found = initialInvoices.find(inv => inv.id === val);
                            if (found) {
                              setPaymentForm(f => ({
                                ...f,
                                invoiceId: val,
                                projectId: found.projectId,
                                unitId: found.unitId || "",
                                customerId: found.customerId || "",
                                amount: found.amount.toString(),
                              }));
                            }
                          }}
                          items={initialInvoices.filter(i => i.status !== "paid").map(i => ({ label: `${i.invoiceNumber} - ${i.customerName} (Rp ${i.amount.toLocaleString()})`, value: i.id }))}
                        >
                          <SelectTrigger className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus:ring-[#4F6F52] font-semibold text-xs h-9.5 text-[#243028]">
                            <SelectValue placeholder={t("finance.verify_lbl_deposit_account")}>
                              {paymentForm.invoiceId ? (() => {
                                const inv = initialInvoices.find(i => i.id === paymentForm.invoiceId);
                                return inv ? `${inv.invoiceNumber} - ${inv.customerName} (Rp ${inv.amount.toLocaleString("id-ID")})` : undefined;
                              })() : undefined}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="border-[#D6DED2] rounded-xl">
                            {initialInvoices.filter(i => i.status !== "paid").map(i => (
                              <SelectItem key={i.id} value={i.id} className="text-xs font-medium">{i.invoiceNumber} - {i.customerName} (Rp {i.amount.toLocaleString()})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.payment_lbl_project")}</label>
                          <Select
                            value={paymentForm.projectId}
                            onValueChange={(val) => setPaymentForm(f => ({ ...f, projectId: val || "" }))}
                            items={projects.map(p => ({ label: p.name, value: p.id }))}
                          >
                            <SelectTrigger className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus:ring-[#4F6F52] font-semibold text-xs h-9.5 text-[#243028]">
                              <SelectValue placeholder={t("finance.payment_lbl_project")}>
                                {paymentForm.projectId ? projects.find(p => p.id === paymentForm.projectId)?.name : undefined}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="border-[#D6DED2] rounded-xl">
                              {projects.map(p => (
                                <SelectItem key={p.id} value={p.id} className="text-xs font-medium">{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.payment_lbl_amount")}</label>
                          <Input
                            type="number"
                            placeholder="Rp 0"
                            value={paymentForm.amount}
                            onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                            className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus-visible:ring-[#4F6F52] font-mono font-bold text-xs h-9.5 text-[#243028]"
                            required
                          />
                        </div>
                      </div>

                      {/* 🌟 Dynamic Readable Amount Live Preview Card */}
                      {paymentForm.amount && !isNaN(Number(paymentForm.amount)) && (
                        <div className="p-2.5 bg-[#DDE8D8]/50 border border-[#8FAF9A]/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                          <span className="text-[9px] font-bold text-[#66736A] uppercase tracking-wider block">{t("finance.invoice_format_rupiah")}</span>
                          <span className="font-mono font-extrabold text-sm text-[#4F6F52] tracking-tight tabular-nums">
                            Rp {Number(paymentForm.amount).toLocaleString("id-ID")}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.payment_lbl_method")}</label>
                          <Select
                            value={paymentForm.paymentMethod}
                            onValueChange={(val: any) => setPaymentForm(f => ({ ...f, paymentMethod: val }))}
                            items={[
                              { label: t("finance.payment_method_transfer"), value: "transfer" },
                              { label: t("finance.payment_method_cash"), value: "cash" },
                              { label: t("finance.payment_method_giro"), value: "giro" },
                              { label: t("finance.payment_method_other"), value: "other" },
                            ]}
                          >
                            <SelectTrigger className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus:ring-[#4F6F52] font-semibold text-xs h-9.5 text-[#243028]">
                              <SelectValue placeholder={t("finance.payment_lbl_method")}>
                                {paymentForm.paymentMethod === "transfer" && t("finance.payment_method_transfer")}
                                {paymentForm.paymentMethod === "cash" && t("finance.payment_method_cash")}
                                {paymentForm.paymentMethod === "giro" && t("finance.payment_method_giro")}
                                {paymentForm.paymentMethod === "other" && t("finance.payment_method_other")}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="border-[#D6DED2] rounded-xl">
                              <SelectItem value="transfer" className="text-xs font-medium">{t("finance.payment_method_transfer")}</SelectItem>
                              <SelectItem value="cash" className="text-xs font-medium">{t("finance.payment_method_cash")}</SelectItem>
                              <SelectItem value="giro" className="text-xs font-medium">{t("finance.payment_method_giro")}</SelectItem>
                              <SelectItem value="other" className="text-xs font-medium">{t("finance.payment_method_other")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.payment_lbl_date")}</label>
                          <Input
                            type="date"
                            value={paymentForm.paymentDate}
                            onChange={(e) => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))}
                            className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus-visible:ring-[#4F6F52] font-medium text-xs h-9.5 text-[#243028]"
                            required
                          />
                        </div>
                      </div>

                      <DialogFooter className="pt-2">
                        <Button
                          type="submit"
                          className="w-full bg-[#4F6F52] hover:bg-[#3D563F] text-white text-xs font-bold h-10 rounded-xl shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? t("finance.saving") : t("finance.payment_btn_submit")}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0 space-y-3 px-4 pb-4">
                {filteredPayments.filter(p => p.status === "pending").length === 0 ? (
                  <div className="text-center py-8 text-[#A8B0AA] text-xs font-medium">
                    {t("finance.payment_empty")}
                  </div>
                ) : (
                  filteredPayments.filter(p => p.status === "pending").map((pay) => (
                    <Card key={pay.id} className="p-4 border border-[#D6DED2] bg-gradient-to-br from-white to-[#F7F8F3] shadow-sm rounded-2xl hover:border-[#8FAF9A] hover:shadow-sage transition-premium duration-300 space-y-3 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[#E9C46A]" />
                      <div className="flex justify-between items-start pl-1">
                        <div>
                          <p className="font-mono text-xs font-bold text-[#243028]">{pay.paymentNumber}</p>
                          <p className="text-[11px] text-[#66736A] mt-1">
                            Customer: <span className="font-semibold text-[#243028]">{pay.customerName || "—"}</span>
                          </p>
                        </div>
                        <Badge className="bg-[#FFF2C2] text-[#9A7D21] border border-[#E9C46A]/30 text-[10px] rounded-full px-2 py-0.5">
                          {t("finance.payment_pending")}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs pl-1">
                        <span className="font-mono font-extrabold text-sm text-[#4F6F52] tabular-nums">
                          Rp {pay.amount.toLocaleString("id-ID")}
                        </span>
                        <span className="text-[10px] text-[#66736A] uppercase font-bold bg-[#DDE8D8]/50 px-2 py-0.5 rounded-md">
                          {pay.paymentMethod}
                        </span>
                      </div>

                      <Button
                        onClick={() => {
                          setSelectedPayment(pay);
                          if (accounts.length > 0) {
                            setVerificationAccount(accounts[0].id);
                          }
                          setVerificationNotes("");
                          setErrorMsg(null);
                        }}
                        className="w-full bg-[#4F6F52] hover:bg-[#3D563F] text-white text-xs font-bold py-1 h-8 rounded-xl shadow-sage hover:scale-[1.02] active:scale-[0.98] transition-premium"
                      >
                        {t("finance.payment_btn_verify")}
                      </Button>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>

            <Dialog open={!!selectedPayment} onOpenChange={(open) => { if (!open) setSelectedPayment(null); }}>
              <DialogContent className="bg-white/95 backdrop-blur-md border-[#D6DED2] shadow-sage-lg rounded-3xl p-6 w-full max-w-md sm:max-w-md overflow-hidden">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-[#243028]">{t("finance.verify_title")}</DialogTitle>
                  <DialogDescription className="text-xs text-[#66736A]">{t("finance.verify_desc")}</DialogDescription>
                </DialogHeader>
                {errorMsg && (
                  <div className="p-3 bg-rose-50 text-[#8B3443] border border-rose-100 rounded-xl text-xs font-semibold animate-shake">
                    {errorMsg}
                  </div>
                )}
                {selectedPayment && (
                  <div className="space-y-4 pt-2 font-sans">
                    {(() => {
                      const proofUrl = selectedPayment.proofFileUrl || (() => {
                        if (!selectedPayment.invoiceId) return null;
                        const otherPayment = initialPayments.find(
                          p => p.invoiceId === selectedPayment.invoiceId && p.proofFileUrl
                        );
                        return otherPayment?.proofFileUrl || null;
                      })();
                      return (
                        <div className="p-3.5 bg-gradient-to-br from-white to-[#F7F8F3] border border-[#D6DED2] rounded-2xl space-y-1.5 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-[#8FAF9A]" />
                          <p className="text-xs text-[#66736A]">{t("finance.verify_lbl_payment_no")} <span className="font-mono font-bold text-[#243028] pl-1">{selectedPayment.paymentNumber}</span></p>
                          <p className="text-xs text-[#66736A]">{t("finance.verify_lbl_customer")} <span className="font-semibold text-[#243028] pl-1">{selectedPayment.customerName}</span></p>
                          <p className="text-xs text-[#66736A]">{t("finance.verify_lbl_amount")} <span className="font-mono font-extrabold text-sm text-[#4F6F52] pl-1">Rp {selectedPayment.amount.toLocaleString("id-ID")}</span></p>
                          {proofUrl && (
                            <p className="text-xs text-[#66736A] flex items-center gap-1 mt-1 pt-1.5 border-t border-[#D6DED2]/50">
                              {t("finance.verify_lbl_proof")}
                              <a
                                href={proofUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#4F6F52] hover:text-[#3D563F] underline font-bold inline-flex items-center gap-1 ml-1"
                              >
                                <Eye className="h-3.5 w-3.5" /> {t("finance.view_proof")}
                              </a>
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.verify_lbl_deposit_account")}</label>
                      <Select 
                        value={verificationAccount} 
                        onValueChange={(val) => setVerificationAccount(val || "")}
                        items={accounts.map(acc => ({ label: `${acc.name} (Saldo: Rp ${acc.openingBalance.toLocaleString()})`, value: acc.id }))}
                      >
                        <SelectTrigger className="w-full max-w-full min-w-0 overflow-hidden bg-[#F7F8F3] border-[#D6DED2] rounded-[12px] focus:ring-[#4F6F52] font-semibold text-xs h-10 text-[#243028]">
                          <SelectValue placeholder={t("finance.verify_lbl_deposit_account")}>
                            {verificationAccount ? (() => {
                              const acc = accounts.find(a => a.id === verificationAccount);
                              return acc ? (
                                <span className="block truncate text-left w-full max-w-[280px] sm:max-w-[320px]">
                                  {acc.name} ({t("finance.balance_lbl")} Rp {acc.openingBalance.toLocaleString("id-ID")})
                                </span>
                              ) : undefined;
                            })() : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="border-[#D6DED2] rounded-[12px]">
                          {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id} className="text-xs font-medium">{acc.name} ({t("finance.balance_lbl")} Rp {acc.openingBalance.toLocaleString()})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.verify_lbl_notes")}</label>
                      <textarea
                        placeholder={t("finance.verify_notes_ph")}
                        value={verificationNotes}
                        onChange={(e) => setVerificationNotes(e.target.value)}
                        className="flex min-h-[80px] w-full rounded-[12px] border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 py-2 text-xs focus:border-[#4F6F52] focus-visible:outline-none focus:bg-white transition-all font-medium leading-normal resize-none text-[#243028]"
                      />
                    </div>

                    {/* User-friendly warning box for lay users */}
                    <div className="bg-amber-50/80 border border-amber-200/50 rounded-2xl p-4 text-[11px] text-[#8A6D1D] leading-relaxed space-y-2">
                      <p className="font-extrabold flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-[#8A6D1D]">
                        ⚠️ {t("finance.verify_warning_title")}
                      </p>
                      <ul className="list-disc list-inside space-y-1 font-semibold pl-1">
                        <li>
                          <strong>{t("finance.verify_btn_approve")}:</strong> {t("finance.verify_warning_approve")}
                        </li>
                        <li>
                          <strong>{t("finance.verify_btn_reject")}:</strong> {t("finance.verify_warning_reject")}
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-3 pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          onClick={() => handleVerifyPaymentSubmit(false)}
                          className="bg-white text-[#D77A7A] border border-rose-200 hover:bg-rose-50 font-bold text-xs h-10 rounded-[12px] hover:scale-[1.02] active:scale-[0.98] transition-premium"
                          disabled={isSubmitting}
                        >
                          {t("finance.verify_btn_reject")}
                        </Button>
                        <Button
                          onClick={() => handleVerifyPaymentSubmit(true)}
                          className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-bold text-xs h-10 rounded-[12px] shadow-sage hover:scale-[1.02] active:scale-[0.98] transition-premium"
                          disabled={isSubmitting}
                        >
                          {t("finance.verify_btn_approve")}
                        </Button>
                      </div>

                      {isSuperAdmin && (
                        <Button
                          onClick={handleDeletePaymentSubmit}
                          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10 rounded-[12px] shadow-[0_4px_14px_rgba(220,38,38,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-premium"
                          disabled={isSubmitting}
                        >
                          {t("finance.verify_btn_delete")}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: TRANSACTIONS / BUKU KAS
          ========================================== */}
      {activeTab === "transactions" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white border-[#D6DED2]">
              <CardHeader>
                <CardTitle className="text-lg text-[#243028]">{t("finance.ledger_title")}</CardTitle>
                <CardDescription className="text-xs">{t("finance.ledger_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("finance.col_trx_code")}</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>{t("finance.col_description")}</TableHead>
                      <TableHead>{t("finance.col_type")}</TableHead>
                      <TableHead>Verifikator / Approver</TableHead>
                      <TableHead>{t("finance.col_account")}</TableHead>
                      <TableHead className="text-right">{t("finance.col_amount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                              <CircleDollarSign className="h-8 w-8 text-[#4F6F52]" />
                            </div>
                            <div>
                              <p className="font-semibold text-[#243028] text-sm">{t("finance.ledger_empty")}</p>
                              <p className="text-xs text-[#66736A] mt-1">{t("finance.ledger_empty_desc")}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((trx) => (
                        <TableRow key={trx.id}>
                          <TableCell className="font-mono text-xs font-semibold text-[#243028]">
                            {trx.transactionNumber}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-[#66736A]">
                            {trx.invoiceNumber || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-[#243028]">
                            {trx.description}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge
                              className={
                                trx.type === "income"
                                  ? "bg-[#DDE8D8] text-[#4F6F52]"
                                  : trx.approvalStatus === "approved"
                                  ? "bg-[#DDE8D8] text-[#4F6F52]"
                                  : trx.approvalStatus === "rejected" || trx.approvalStatus === "insufficient_balance"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }
                            >
                              {trx.type === "income"
                                ? t("finance.trx_type_in")
                                : trx.approvalStatus === "approved"
                                ? "Keluar - Disetujui"
                                : trx.approvalStatus === "rejected"
                                ? "Keluar - Tolak"
                                : trx.approvalStatus === "insufficient_balance"
                                ? "Keluar - Tolak"
                                : "Keluar - Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-[#243028] font-medium">
                            {trx.resolvedApproverName || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-[#66736A]">
                            {trx.accountName}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold tabular-nums text-xs text-[#243028]">
                            Rp {trx.amount.toLocaleString("id-ID")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar: Cash Request submit form & balances */}
          <div className="space-y-6">
            <Card className="bg-white/70 backdrop-blur-md border border-[#D6DED2]/80 shadow-sage hover:shadow-sage-lg transition-premium rounded-3xl overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-[#243028]">{t("finance.balance_title")}</CardTitle>
                <CardDescription className="text-xs text-[#66736A] font-medium">{t("finance.balance_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3 font-sans">
                {accounts.filter(a => a.status === "active").map(acc => {
                  const diff = acc.currentBalance - acc.openingBalance;
                  return (
                    <div 
                      key={acc.id} 
                      className="flex justify-between items-center p-3.5 bg-gradient-to-r from-white to-[#F7F8F3] border border-[#D6DED2] rounded-2xl hover:border-[#8FAF9A] hover:shadow-sage transition-premium duration-300 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${acc.currentBalance > 0 ? "bg-[#8FAF9A]" : "bg-rose-400"} group-hover:scale-150 transition-premium`} />
                        <div>
                          <p className="text-xs font-bold text-[#243028]">{acc.name}</p>
                          <p className="text-[10px] text-[#66736A] font-mono uppercase tracking-wider mt-0.5">{acc.code}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`font-mono font-extrabold text-xs tabular-nums ${acc.currentBalance < 0 ? "text-rose-600" : "text-[#4F6F52]"}`}>
                          Rp {acc.currentBalance.toLocaleString("id-ID")}
                        </span>
                        {diff !== 0 && (
                          <span className={`text-[9px] font-mono tabular-nums ${diff >= 0 ? "text-emerald-500" : "text-rose-400"}`}>
                            {diff >= 0 ? "+" : ""}{diff.toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="bg-white border-[#D6DED2] shadow-sage rounded-2xl overflow-hidden hover:shadow-sage-lg transition-premium">
              <div className="bg-[#4F6F52] h-1 w-full" />
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-[#243028] flex items-center gap-2">
                  <TrendingDown className="h-4.5 w-4.5 text-[#D77A7A]" />
                  {t("finance.expense_title")}
                </CardTitle>
                <CardDescription className="text-xs text-[#66736A] font-medium">
                  {t("finance.expense_desc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 font-sans space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 text-[#8B3443] border border-rose-100 rounded-xl text-xs font-semibold animate-shake">
                    {errorMsg}
                  </div>
                )}
                
                <form onSubmit={handleCreateExpenseSubmit} className="space-y-4">
                  
                  {/* Project Selector field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.expense_lbl_project")}</label>
                    <Select
                      value={expenseForm.projectId}
                      onValueChange={(val) => setExpenseForm(f => ({ ...f, projectId: val || "" }))}
                      items={projects.map(p => ({ label: p.name, value: p.id }))}
                    >
                      <SelectTrigger className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus:ring-[#4F6F52] font-semibold text-xs h-9.5 text-[#243028]">
                        <SelectValue placeholder={t("finance.expense_lbl_project")}>
                          {expenseForm.projectId ? projects.find(p => p.id === expenseForm.projectId)?.name : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-[#D6DED2] rounded-xl">
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-xs font-medium">{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cash Account & Category Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.expense_lbl_account")}</label>
                      <Select
                        value={expenseForm.accountId}
                        onValueChange={(val) => setExpenseForm(f => ({ ...f, accountId: val || "" }))}
                        items={accounts.map(a => ({ label: a.name, value: a.id }))}
                      >
                        <SelectTrigger className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus:ring-[#4F6F52] font-semibold text-xs h-9.5 text-[#243028]">
                          <SelectValue placeholder={t("finance.expense_lbl_account")}>
                            {expenseForm.accountId ? accounts.find(a => a.id === expenseForm.accountId)?.name : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="border-[#D6DED2] rounded-xl">
                          {accounts.map(a => (
                            <SelectItem key={a.id} value={a.id} className="text-xs font-medium">{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.expense_lbl_category")}</label>
                      <Select
                        value={expenseForm.categoryId}
                        onValueChange={(val) => setExpenseForm(f => ({ ...f, categoryId: val || "" }))}
                        items={categories.filter(c => c.type === "expense").map(c => ({ label: c.name, value: c.id }))}
                      >
                        <SelectTrigger className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus:ring-[#4F6F52] font-semibold text-xs h-9.5 text-[#243028]">
                          <SelectValue placeholder={t("finance.expense_lbl_category")}>
                            {expenseForm.categoryId ? categories.find(c => c.id === expenseForm.categoryId)?.name : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="border-[#D6DED2] rounded-xl">
                          {categories.filter(c => c.type === "expense").map(c => (
                            <SelectItem key={c.id} value={c.id} className="text-xs font-medium">{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Amount & Method Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.expense_lbl_amount")}</label>
                      <Input
                        type="number"
                        placeholder="Rp 0"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                        className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus-visible:ring-[#4F6F52] font-mono font-bold text-xs h-9.5 text-[#243028]"
                        required
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.expense_lbl_method")}</label>
                      <Select
                        value={expenseForm.paymentMethod}
                        onValueChange={(val: any) => setExpenseForm(f => ({ ...f, paymentMethod: val }))}
                        items={[
                          { label: t("finance.payment_method_transfer"), value: "transfer" },
                          { label: t("finance.payment_method_cash"), value: "cash" },
                          { label: t("finance.payment_method_giro"), value: "giro" },
                        ]}
                      >
                        <SelectTrigger className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus:ring-[#4F6F52] font-semibold text-xs h-9.5 text-[#243028]">
                          <SelectValue placeholder={t("finance.expense_lbl_method")}>
                            {expenseForm.paymentMethod === "transfer" && t("finance.payment_method_transfer")}
                            {expenseForm.paymentMethod === "cash" && t("finance.payment_method_cash")}
                            {expenseForm.paymentMethod === "giro" && t("finance.payment_method_giro")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="border-[#D6DED2] rounded-xl">
                          <SelectItem value="transfer" className="text-xs font-medium">{t("finance.payment_method_transfer")}</SelectItem>
                          <SelectItem value="cash" className="text-xs font-medium">{t("finance.payment_method_cash")}</SelectItem>
                          <SelectItem value="giro" className="text-xs font-medium">{t("finance.payment_method_giro")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* 🌟 Dynamic Readable Amount Live Preview Card */}
                  {expenseForm.amount && !isNaN(Number(expenseForm.amount)) && (
                    <div className="p-3 bg-[#DDE8D8]/50 border border-[#8FAF9A]/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                      <span className="text-[9px] font-bold text-[#66736A] uppercase tracking-wider block">{t("finance.invoice_format_rupiah")}</span>
                      <span className="font-mono font-extrabold text-sm text-[#4F6F52] tracking-tight tabular-nums">
                        Rp {Number(expenseForm.amount).toLocaleString("id-ID")}
                      </span>
                    </div>
                  )}

                  {/* Description Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#243028] uppercase tracking-wider block">{t("finance.expense_lbl_notes")}</label>
                    <Input
                      placeholder={t("finance.expense_notes_ph")}
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                      className="bg-[#F7F8F3] border-[#D6DED2] rounded-xl focus-visible:ring-[#4F6F52] font-medium text-xs h-9.5 text-[#243028]"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#4F6F52] hover:bg-[#3D563F] text-white text-xs font-bold h-10 rounded-xl shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t("finance.submitting") : t("finance.expense_btn_submit")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 3: PERSETUJUAN KAS KELUAR
          ========================================== */}
      {activeTab === "approvals" && (
        <div className="space-y-6">
          <Card className="bg-white border-[#D6DED2]">
            <CardHeader>
              <CardTitle className="text-lg text-[#243028]">{t("finance.approval_title")}</CardTitle>
              <CardDescription className="text-xs">
                {t("finance.approval_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("finance.col_trx_code")}</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>{t("finance.col_category")}</TableHead>
                    <TableHead>{t("finance.col_project")}</TableHead>
                    <TableHead>{t("finance.col_need_desc")}</TableHead>
                    <TableHead className="text-right">{t("finance.col_amount")}</TableHead>
                    <TableHead className="text-center">{t("finance.col_balance_avail")}</TableHead>
                    <TableHead className="text-center">{t("finance.col_action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingApprovals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                            <Clock className="h-8 w-8 text-[#4F6F52]" />
                          </div>
                          <div>
                            <p className="font-semibold text-[#243028] text-sm">{t("finance.approval_empty")}</p>
                            <p className="text-xs text-[#66736A] mt-1">{t("finance.approval_empty_desc")}</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingApprovals.map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell className="font-mono text-xs font-semibold text-[#243028]">
                          {exp.transactionNumber}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-[#66736A]">
                          {exp.invoiceNumber || "—"}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-[#243028]">
                          {exp.categoryName}
                        </TableCell>
                        <TableCell className="text-xs text-[#66736A]">
                          {exp.projectName}
                        </TableCell>
                        <TableCell className="text-xs text-[#243028]">
                          {exp.description}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums text-xs text-[#243028]">
                          Rp {exp.amount.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-center">
                          {exp.approvalStatus === "insufficient_balance" ? (
                            <Badge className="bg-rose-50 text-danger border-rose-200 flex items-center gap-1 w-fit mx-auto text-[10px]">
                              <AlertTriangle className="h-3 w-3" /> {t("finance.badge_insuff")}
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 flex items-center gap-1 w-fit mx-auto text-[10px]">
                              <CheckCircle2 className="h-3 w-3" /> {t("finance.badge_avail")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            onClick={() => {
                              setSelectedExpense(exp);
                              setApprovalNotes("");
                              setErrorMsg(null);
                            }}
                            className="bg-[#4F6F52] hover:bg-[#8FAF9A] text-white text-xs h-7 py-0.5 px-2"
                          >
                            {t("finance.btn_review")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={!!selectedExpense} onOpenChange={(open) => { if (!open) setSelectedExpense(null); }}>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>{t("finance.auth_title")}</DialogTitle>
                <DialogDescription>{t("finance.auth_desc")}</DialogDescription>
              </DialogHeader>
              {errorMsg && (
                <div className="p-3 bg-rose-50 text-danger border border-rose-100 rounded-md text-xs font-semibold mb-3">
                  {errorMsg}
                </div>
              )}
              {selectedExpense && (
                <div className="space-y-4 font-sans">
                  <div className="p-3 bg-slate-50 border border-[#D6DED2] rounded-md space-y-1">
                    <p className="text-xs">{t("finance.auth_lbl_trx")} <span className="font-mono font-semibold">{selectedExpense.transactionNumber}</span></p>
                    <p className="text-xs">{t("finance.auth_lbl_need")} <span className="font-semibold">{selectedExpense.description}</span></p>
                    <p className="text-xs">{t("finance.auth_lbl_amount")} <span className="font-mono font-bold text-danger">Rp {selectedExpense.amount.toLocaleString("id-ID")}</span></p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#243028]">{t("finance.auth_lbl_notes")}</label>
                    <Input
                      placeholder={t("finance.auth_notes_ph")}
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      className="bg-white border-[#D6DED2]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <Button
                      onClick={() => handleExpenseApprovalSubmit(false)}
                      className="bg-white text-danger border border-rose-200 hover:bg-rose-50"
                      disabled={isSubmitting}
                    >
                      {t("finance.auth_btn_reject")}
                    </Button>
                    <Button
                      onClick={() => handleExpenseApprovalSubmit(true)}
                      className="bg-[#4F6F52] hover:bg-[#8FAF9A] text-white"
                      disabled={
                        isSubmitting ||
                        selectedExpense.approvalStatus === "insufficient_balance"
                      }
                    >
                      {t("finance.auth_btn_approve")}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ==========================================
          TAB 4: BUDGETS / ANGGARAN
          ========================================== */}
      {activeTab === "budgets" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white border-[#D6DED2]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-[#243028]">{t("finance.budget_list_title")}</CardTitle>
                  <CardDescription className="text-xs">{t("finance.budget_list_desc")}</CardDescription>
                </div>
                <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
                  <DialogTrigger nativeButton={true} render={
                    <Button className="bg-[#8FAF9A] hover:bg-[#4F6F52] text-white flex items-center gap-1.5 text-xs">
                      <Plus className="h-3.5 w-3.5" /> {t("finance.budget_btn_new")}
                    </Button>
                  } />
                  <DialogContent className="bg-white">
                    <DialogHeader>
                      <DialogTitle>{t("finance.budget_form_title")}</DialogTitle>
                      <DialogDescription>{t("finance.budget_form_desc")}</DialogDescription>
                    </DialogHeader>
                    {errorMsg && (
                      <div className="p-3 bg-rose-50 text-danger border border-rose-100 rounded-md text-xs font-semibold">
                        {errorMsg}
                      </div>
                    )}
                    <form onSubmit={handleCreateBudgetSubmit} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_project")}</label>
                        <Select
                          value={budgetForm.projectId}
                          onValueChange={(val) => setBudgetForm(f => ({ ...f, projectId: val || "" }))}
                          items={projects.map(p => ({ label: p.name, value: p.id }))}
                        >
                          <SelectTrigger className="bg-white border-[#D6DED2]">
                            <SelectValue placeholder="Pilih Perumahan">
                              {budgetForm.projectId ? projects.find(p => p.id === budgetForm.projectId)?.name : undefined}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {projects.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_name")}</label>
                        <Input
                          placeholder={t("finance.budget_lbl_name_ph")}
                          value={budgetForm.name}
                          onChange={(e) => setBudgetForm(f => ({ ...f, name: e.target.value }))}
                          className="bg-white border-[#D6DED2]"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_start")}</label>
                          <Input
                            type="date"
                            value={budgetForm.periodStart}
                            onChange={(e) => setBudgetForm(f => ({ ...f, periodStart: e.target.value }))}
                            className="bg-white border-[#D6DED2]"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_end")}</label>
                          <Input
                            type="date"
                            value={budgetForm.periodEnd}
                            onChange={(e) => setBudgetForm(f => ({ ...f, periodEnd: e.target.value }))}
                            className="bg-white border-[#D6DED2]"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_category")}</label>
                          <Select
                            value={budgetForm.categoryId}
                            onValueChange={(val) => setBudgetForm(f => ({ ...f, categoryId: val || "" }))}
                            items={categories.filter(c => c.type === "expense").map(c => ({ label: c.name, value: c.id }))}
                          >
                            <SelectTrigger className="bg-white border-[#D6DED2]">
                              <SelectValue placeholder="Pilih Kategori">
                                {budgetForm.categoryId ? categories.find(c => c.id === budgetForm.categoryId)?.name : undefined}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {categories.filter(c => c.type === "expense").map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_alloc")}</label>
                          <Input
                            type="number"
                            placeholder="Rp 0"
                            value={budgetForm.allocatedAmount}
                            onChange={(e) => setBudgetForm(f => ({ ...f, allocatedAmount: e.target.value }))}
                            className="bg-white border-[#D6DED2]"
                            required
                          />
                        </div>
                      </div>

                      {/* 🌟 Dynamic Readable Amount Live Preview Card */}
                      {budgetForm.allocatedAmount && !isNaN(Number(budgetForm.allocatedAmount)) && (
                        <div className="p-2.5 bg-[#DDE8D8]/50 border border-[#8FAF9A]/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                          <span className="text-[9px] font-bold text-[#66736A] uppercase tracking-wider block">Format Rupiah Terbaca</span>
                          <span className="font-mono font-extrabold text-sm text-[#4F6F52] tracking-tight tabular-nums">
                            Rp {Number(budgetForm.allocatedAmount).toLocaleString("id-ID")}
                          </span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#243028]">{t("finance.budget_lbl_total")}</label>
                        <Input
                          type="number"
                          placeholder="Rp 0"
                          value={budgetForm.totalAmount}
                          onChange={(e) => setBudgetForm(f => ({ ...f, totalAmount: e.target.value }))}
                          className="bg-white border-[#D6DED2]"
                          required
                        />
                      </div>

                      {/* 🌟 Dynamic Readable Amount Live Preview Card */}
                      {budgetForm.totalAmount && !isNaN(Number(budgetForm.totalAmount)) && (
                        <div className="p-2.5 bg-[#DDE8D8]/50 border border-[#8FAF9A]/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                          <span className="text-[9px] font-bold text-[#66736A] uppercase tracking-wider block">Format Rupiah Terbaca</span>
                          <span className="font-mono font-extrabold text-sm text-[#4F6F52] tracking-tight tabular-nums">
                            Rp {Number(budgetForm.totalAmount).toLocaleString("id-ID")}
                          </span>
                        </div>
                      )}

                      <DialogFooter>
                        <Button
                          type="submit"
                          className="bg-[#4F6F52] hover:bg-[#8FAF9A] text-white w-full"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? t("finance.saving") : t("finance.budget_btn_submit")}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("finance.col_budget_name")}</TableHead>
                      <TableHead>{t("finance.col_budget_proj")}</TableHead>
                      <TableHead>{t("finance.col_budget_period")}</TableHead>
                      <TableHead className="text-right">{t("finance.col_budget_total")}</TableHead>
                      <TableHead className="text-center">{t("finance.col_status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBudgets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                              <FolderOpen className="h-8 w-8 text-[#4F6F52]" />
                            </div>
                            <div>
                              <p className="font-semibold text-[#243028] text-sm">{t("finance.budget_empty")}</p>
                              <p className="text-xs text-[#66736A] mt-1">{t("finance.budget_empty_desc")}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBudgets.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="text-xs font-semibold text-[#243028]">
                            {b.name}
                          </TableCell>
                          <TableCell className="text-xs text-[#66736A]">
                            {b.projectName}
                          </TableCell>
                          <TableCell className="text-xs text-[#66736A]">
                            {new Date(b.periodStart).toLocaleDateString("id-ID")} - {new Date(b.periodEnd).toLocaleDateString("id-ID")}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold tabular-nums text-xs text-[#243028]">
                            Rp {b.totalAmount.toLocaleString("id-ID")}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-[#DDE8D8] text-[#4F6F52]">{t("finance.badge_active")}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Visual budgets monitoring cards */}
          <div className="space-y-6">
            <Card className="bg-white/70 backdrop-blur-md border border-[#D6DED2]/80 shadow-sage hover:shadow-sage-lg transition-premium rounded-3xl overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-[#243028]">{t("finance.absorption_title")}</CardTitle>
                <CardDescription className="text-xs text-[#66736A] font-medium">{t("finance.absorption_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4 font-sans">
                {[
                  { name: "Operational & Kantor", value: 40 },
                  { name: "Fisik Konstruksi / Upah Tukang", value: 15 },
                  { name: "Biaya Perizinan / Legal Sertifikat", value: 70 },
                  { name: "Pemasaran, Brosur & Iklan", value: 88 },
                ].map((item, idx) => {
                  const colorClass = item.value < 50 ? "bg-[#8FAF9A]" : item.value < 80 ? "bg-[#E9C46A]" : "bg-[#D77A7A]";
                  const textClass = item.value < 50 ? "text-[#4F6F52]" : item.value < 80 ? "text-[#9A7D21]" : "text-[#D77A7A]";
                  const bgClass = item.value < 50 ? "bg-[#DDE8D8]/30" : item.value < 80 ? "bg-amber-50" : "bg-rose-50";
                  
                  return (
                    <div key={idx} className="space-y-2 group">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-[#243028] group-hover:text-[#4F6F52] transition-colors">{item.name}</span>
                        <span className={`font-mono font-extrabold tabular-nums px-2 py-0.5 rounded-md ${bgClass} ${textClass}`}>
                          {item.value}%
                        </span>
                      </div>
                      <div className="w-full bg-[#F7F8F3] border border-[#D6DED2] rounded-full h-2.5 overflow-hidden p-0.5 shadow-inner">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${colorClass}`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 5: REPORTS / LAPORAN STATEMENTS
          ========================================== */}
      {activeTab === "reports" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white border-[#D6DED2]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-[#243028]">{t("finance.report_title")}</CardTitle>
                  <CardDescription className="text-xs">{t("finance.report_desc")}</CardDescription>
                </div>
                <Button className="bg-[#4F6F52] hover:bg-[#8FAF9A] text-white flex items-center gap-1.5 text-xs">
                  <Download className="h-4 w-4" /> {t("finance.report_btn_export")}
                </Button>
              </CardHeader>
              <CardContent className="w-full min-w-0 p-4">
                <div style={{ height: 280, minHeight: 0, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height={280} minWidth={0}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#66736A" fontSize={12} />
                    <YAxis stroke="#66736A" fontSize={10} tickFormatter={(v) => `Rp ${v.toLocaleString("id-ID")}`} />
                    <ChartTooltip formatter={(v) => `Rp ${Number(v).toLocaleString("id-ID")}`} />
                    <Bar dataKey="Nominal" fill="#8FAF9A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-white border-[#D6DED2]">
              <CardHeader>
                <CardTitle className="text-base text-[#243028]">{t("finance.cashflow_title")}</CardTitle>
                <CardDescription className="text-xs">{t("finance.cashflow_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3 font-sans">
                <div className="flex justify-between items-center text-xs border-b border-[#D6DED2] pb-2">
                  <span className="text-[#66736A]">{t("finance.cashflow_income")}</span>
                  <span className="font-mono font-bold text-[#4F6F52] tabular-nums">
                    Rp {totalIncomeVal.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-[#D6DED2] pb-2">
                  <span className="text-[#66736A]">{t("finance.cashflow_expense")}</span>
                  <span className="font-mono font-bold text-danger tabular-nums">
                    Rp {totalExpenseVal.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold pt-1">
                  <span className="text-[#243028]">{t("finance.cashflow_net")}</span>
                  <span className="font-mono font-bold text-lg text-[#4F6F52] tabular-nums">
                    Rp {netBalanceVal.toLocaleString("id-ID")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

    </div>

    {/* ── INVOICE PRINT MODAL ── */}
    {printInvoice && (
      <InvoicePrintModal
        invoice={printInvoice}
        payments={initialPayments}
        onClose={() => setPrintInvoice(null)}
      />
    )}
    </>
  );
}
