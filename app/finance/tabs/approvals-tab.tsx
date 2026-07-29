"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FinanceTableState } from "@/components/finance/finance-table-state";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { ApprovalCard } from "@/app/finance/components/approval-card";
import type { ApprovalCardBudgetInfo } from "@/app/finance/components/approval-card";
import type { ApprovalTransactionProjection } from "@/lib/finance-ui-types";
import { lookupBudgetCategoryForApproval } from "@/lib/finance-budget-lookup";
import type {
  BudgetEntity,
  BudgetLineDetail,
  BudgetActualUsage,
} from "@/lib/finance-budget-summary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  History,
} from "lucide-react";
import { getApprovalStatusLabel } from "@/lib/label-helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Transaction {
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
  reversalOfTransactionId?: string | null;
  reversalOfPaymentId?: string | null;
  reversalReason?: string | null;
}

interface ApprovalsTabProps {
  /** All expense transactions (any approval status) */
  allExpenseTransactions: Transaction[];
  /** Currently selected expense for the approval dialog */
  selectedExpense: Transaction | null;
  setSelectedExpense: (expense: Transaction | null) => void;
  approvalNotes: string;
  setApprovalNotes: (notes: string) => void;
  errorMsg: string | null;
  isSubmitting: boolean;
  /** Handler for approve/reject action */
  onExpenseApprovalSubmit: (isApproved: boolean) => Promise<void>;
  /** Whether the current user can perform approve/reject actions */
  canApprove?: boolean;
  /** Budget data for category lookup */
  budgets?: readonly BudgetEntity[];
  budgetLines?: readonly BudgetLineDetail[];
  budgetActualUsage?: readonly BudgetActualUsage[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APPROVAL_PAGE_SIZE = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApprovalsTab({
  allExpenseTransactions,
  selectedExpense,
  setSelectedExpense,
  approvalNotes,
  setApprovalNotes,
  errorMsg,
  isSubmitting,
  onExpenseApprovalSubmit,
  canApprove = false,
  budgets = [],
  budgetLines = [],
  budgetActualUsage = [],
}: ApprovalsTabProps) {
  const [showHistory, setShowHistory] = React.useState(false);
  const [approvalPage, setApprovalPage] = React.useState(1);

  // ─── Stats ───────────────────────────────────────────────────────────────────
  const stats = React.useMemo(() => {
    const pending = allExpenseTransactions.filter(
      (t) => t.approvalStatus === "pending"
    ).length;
    const insufficientBalance = allExpenseTransactions.filter(
      (t) => t.approvalStatus === "insufficient_balance"
    ).length;
    const approved = allExpenseTransactions.filter(
      (t) => t.approvalStatus === "approved"
    ).length;
    return { pending, insufficientBalance, approved };
  }, [allExpenseTransactions]);

  // ─── Queue vs History items ──────────────────────────────────────────────────
  const queueItems = React.useMemo(() => {
    return allExpenseTransactions
      .filter(
        (t) =>
          t.approvalStatus === "pending" ||
          t.approvalStatus === "insufficient_balance"
      )
      .sort(
        (a, b) =>
          new Date(b.transactionDate).getTime() -
          new Date(a.transactionDate).getTime()
      );
  }, [allExpenseTransactions]);

  const historyItems = React.useMemo(() => {
    return allExpenseTransactions
      .filter(
        (t) =>
          t.approvalStatus === "approved" ||
          t.approvalStatus === "rejected" ||
          t.approvalStatus === "not_required"
      )
      .sort(
        (a, b) =>
          new Date(b.transactionDate).getTime() -
          new Date(a.transactionDate).getTime()
      );
  }, [allExpenseTransactions]);

  const displayItems = showHistory ? historyItems : queueItems;

  // Reset page when toggling view
  React.useEffect(() => {
    setApprovalPage(1);
  }, [showHistory]);

  // ─── Pagination ──────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(displayItems.length / APPROVAL_PAGE_SIZE));
  const safeApprovalPage = Math.min(approvalPage, totalPages);
  const pagedItems = displayItems.slice(
    (safeApprovalPage - 1) * APPROVAL_PAGE_SIZE,
    safeApprovalPage * APPROVAL_PAGE_SIZE
  );

  // ─── Budget lookup per card (memoized) ────────────────────────────────────────
  const budgetInfoMap = React.useMemo(() => {
    const map = new Map<string, ApprovalCardBudgetInfo>();
    for (const t of pagedItems) {
      const result = lookupBudgetCategoryForApproval(
        {
          projectId: t.projectId,
          categoryId: t.categoryId,
          transactionDate: new Date(t.transactionDate),
        },
        budgets,
        budgetLines,
        budgetActualUsage
      );
      map.set(t.id, result);
    }
    return map;
  }, [pagedItems, budgets, budgetLines, budgetActualUsage]);

  // ─── Project transaction to ApprovalTransactionProjection ─────────────────────
  const projectToCard = (t: Transaction): ApprovalTransactionProjection => ({
    id: t.id,
    transactionNumber: t.transactionNumber,
    projectId: t.projectId,
    categoryId: t.categoryId,
    description: t.description,
    amount: t.amount,
    transactionDate: new Date(t.transactionDate),
    approvalStatus: t.approvalStatus,
    projectName: t.projectName,
    requesterName: t.resolvedApproverName || t.createdBy || null,
  });

  // ─── Review handler (guarded) ──────────────────────────────────────────────
  const handleReview = (id: string) => {
    // Guard: non-approver roles cannot open review dialog
    if (!canApprove) return;
    const expense = allExpenseTransactions.find((t) => t.id === id);
    // Guard: item not found
    if (!expense) return;
    // Guard: item is not actionable
    if (expense.approvalStatus !== "pending" && expense.approvalStatus !== "insufficient_balance") return;
    setSelectedExpense(expense);
    setApprovalNotes("");
  };

  return (
    <div className="space-y-6">
      {/* ─── Top Stats ─────────────────────────────────────────────────────────── */}
      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        aria-label="Ringkasan persetujuan kas keluar"
      >
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Menunggu</p>
            <p className="font-mono text-2xl font-bold tabular-nums text-amber-800">
              {stats.pending}
            </p>
            <p className="text-[10px] text-muted-foreground">Permintaan</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Saldo Tidak Cukup</p>
            <p className="font-mono text-2xl font-bold tabular-nums text-rose-800">
              {stats.insufficientBalance}
            </p>
            <p className="text-[10px] text-muted-foreground">Permintaan</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Disetujui</p>
            <p className="font-mono text-2xl font-bold tabular-nums text-primary">
              {stats.approved}
            </p>
          </div>
        </div>
      </section>

      {/* ─── Section Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {showHistory ? "Riwayat Persetujuan" : "Antrian Persetujuan"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {showHistory
              ? "Daftar keputusan kas keluar yang sudah final."
              : "Pengajuan kas keluar yang masih memerlukan keputusan."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHistory((prev) => !prev)}
          className="min-h-[44px] gap-2 rounded-xl text-xs"
        >
          <History className="h-4 w-4" aria-hidden="true" />
          {showHistory ? "Lihat Antrian" : "Lihat Riwayat"}
        </Button>
      </div>

      {/* ─── Card Grid ─────────────────────────────────────────────────────────── */}
      {displayItems.length === 0 ? (
        <FinanceTableState
          variant="empty"
          title={
            showHistory
              ? "Belum ada riwayat persetujuan"
              : "Tidak ada pengajuan yang menunggu"
          }
          description={
            showHistory
              ? "Keputusan yang sudah disetujui, ditolak, atau tidak membutuhkan persetujuan akan muncul di sini."
              : "Semua pengajuan sudah diproses. Pengajuan baru dari kas keluar akan muncul otomatis di antrian ini."
          }
          filterContext={
            showHistory
              ? "Riwayat Persetujuan Kas Keluar"
              : "Antrian Persetujuan Kas Keluar"
          }
          icon={<FileText className="h-6 w-6" />}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {pagedItems.map((t) => {
              const budgetInfo: ApprovalCardBudgetInfo =
                budgetInfoMap.get(t.id) ?? { type: "ambiguous" };

              return (
                <ApprovalCard
                  key={t.id}
                  transaction={projectToCard(t)}
                  budgetInfo={budgetInfo}
                  onReview={handleReview}
                  canReview={
                    canApprove &&
                    !showHistory &&
                    (t.approvalStatus === "pending" ||
                      t.approvalStatus === "insufficient_balance")
                  }
                />
              );
            })}
          </div>

          <DataTablePagination
            totalItems={displayItems.length}
            itemsPerPage={APPROVAL_PAGE_SIZE}
            currentPage={safeApprovalPage}
            onPageChange={setApprovalPage}
            pageParam="approvalPage"
            maxVisiblePages={5}
          />
        </>
      )}

      {/* ─── Approval/Rejection Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={!!selectedExpense}
        onOpenChange={(open) => {
          if (!open) setSelectedExpense(null);
        }}
      >
        <DialogContent className="bg-card w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Pengajuan Kas Keluar</DialogTitle>
            <DialogDescription>
              Tinjau detail pengajuan dan berikan keputusan persetujuan.
            </DialogDescription>
          </DialogHeader>
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-100 rounded-md text-xs font-semibold mb-3">
              {errorMsg}
            </div>
          )}
          {selectedExpense && (
            <div className="space-y-4 font-sans">
              <div className="p-3 bg-slate-50 border border-border rounded-md space-y-2">
                <p className="text-xs">
                  Kode Pengajuan:{" "}
                  <span className="font-mono font-semibold">
                    {selectedExpense.transactionNumber}
                  </span>
                </p>
                <p className="text-xs">
                  Deskripsi:{" "}
                  <span className="font-semibold">{selectedExpense.description}</span>
                </p>
                <p className="text-xs">
                  Kategori:{" "}
                  <span className="font-semibold">{selectedExpense.categoryName}</span>
                </p>
                <p className="text-xs">
                  Project:{" "}
                  <span className="font-semibold">{selectedExpense.projectName}</span>
                </p>
                <p className="text-xs">
                  Nominal:{" "}
                  <span className="font-mono font-bold text-rose-700 tabular-nums">
                    Rp{"\u00A0"}{selectedExpense.amount.toLocaleString("id-ID")}
                  </span>
                </p>
                <p className="text-xs">
                  Status:{" "}
                  <span className="font-semibold">
                    {getApprovalStatusLabel(selectedExpense.approvalStatus)}
                  </span>
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="approval-notes-input"
                  className="text-xs font-semibold text-foreground"
                >
                  Catatan Persetujuan
                </label>
                <Input
                  id="approval-notes-input"
                  placeholder="Tambahkan catatan (opsional)..."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="bg-card border-input"
                />
              </div>

              {canApprove &&
                selectedExpense.approvalStatus !== "approved" &&
                selectedExpense.approvalStatus !== "rejected" &&
                selectedExpense.approvalStatus !== "not_required" && (
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <Button
                    onClick={() => onExpenseApprovalSubmit(false)}
                    className="bg-card text-rose-700 border border-rose-200 hover:bg-rose-50"
                    disabled={isSubmitting}
                  >
                    Tolak
                  </Button>
                  <Button
                    onClick={() => onExpenseApprovalSubmit(true)}
                    className="bg-primary hover:bg-primary/90 text-white"
                    disabled={isSubmitting}
                  >
                    Setujui
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
