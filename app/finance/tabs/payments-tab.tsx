"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Eye,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
} from "lucide-react";
import { FinanceDocLink } from "@/components/finance/finance-doc-link";
import { FinanceDocumentContextBadge } from "@/components/finance/finance-document-context-badge";
import { FinanceTableState } from "@/components/finance/finance-table-state";
import { FinanceTableScroll } from "@/components/finance/finance-table-scroll";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { getPaymentMethodLabel, getPaymentStatusLabel, getInvoiceTypeLabel } from "@/lib/label-helpers";
import { getInvoiceDocumentContext } from "@/lib/finance-invoice-summary";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { PaginatedResult } from "@/lib/pagination";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

export interface PaymentsTabProps {
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
  initialInvoices: Array<{
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
  initialPayments: Array<{
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
  paymentPageData: PaginatedResult<PaymentListItem>;
  paymentForm: {
    invoiceId: string;
    projectId: string;
    unitId: string;
    customerId: string;
    amount: string;
    paymentDate: string;
    paymentMethod: "cash" | "transfer" | "giro" | "other";
  };
  setPaymentForm: React.Dispatch<React.SetStateAction<{
    invoiceId: string;
    projectId: string;
    unitId: string;
    customerId: string;
    amount: string;
    paymentDate: string;
    paymentMethod: "cash" | "transfer" | "giro" | "other";
  }>>;
  paymentOpen: boolean;
  setPaymentOpen: (open: boolean) => void;
  selectedPayment: any;
  setSelectedPayment: (payment: any) => void;
  verificationAccount: string;
  setVerificationAccount: (account: string) => void;
  verificationNotes: string;
  setVerificationNotes: (notes: string) => void;
  currentUserId: string;
  canSelfVerify: boolean;
  errorMsg: string | null;
  isSubmitting: boolean;
  isSuperAdmin: boolean;
  /**
   * Mirrors the server-side role gate on `createPayment`
   * (Super Admin / Admin Keuangan / Admin Kantor). When false the
   * "Catat Pembayaran" trigger is hidden so no role sees an action that would
   * be rejected on submit.
   */
  canRecordPayment?: boolean;
  onCreatePaymentSubmit: (e: React.FormEvent) => Promise<void>;
  onVerifyPaymentSubmit: (isApproved: boolean) => Promise<void>;
  onDeletePaymentSubmit: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Sub-filter definitions (Req 4.1)
// ---------------------------------------------------------------------------

type PaymentSubFilter = "all" | "pending" | "verified" | "rejected" | "voided";

const SUB_FILTERS: Array<{ key: PaymentSubFilter; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "pending", label: "Menunggu Verifikasi" },
  { key: "verified", label: "Terverifikasi" },
  { key: "rejected", label: "Ditolak" },
  { key: "voided", label: "Dibatalkan" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format Rupiah with tabular-nums */
function formatRupiah(amount: number): string {
  return `Rp\u00A0${amount.toLocaleString("id-ID")}`;
}

/** Format date to locale ID short string */
function formatDate(date: Date | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Status badge styles (Req 4.3)
// ---------------------------------------------------------------------------

function PaymentStatusBadge({ status }: { status: PaymentListItem["status"] }) {
  const IconMap: Record<PaymentListItem["status"], React.ElementType> = {
    pending: Clock,
    verified: CheckCircle2,
    rejected: XCircle,
    voided: Ban,
  };
  const styles: Record<PaymentListItem["status"], string> = {
    pending: "bg-amber-50 text-amber-700 border border-amber-200/80",
    verified: "bg-emerald-50 text-emerald-700 border border-emerald-200/80",
    rejected: "bg-rose-50 text-rose-700 border border-rose-200/80",
    voided: "bg-gray-100 text-gray-500 border border-gray-200/80",
  };
  const Icon = IconMap[status];
  return (
    <Badge className={cn("text-[10px] font-semibold", styles[status])}>
      <Icon className="h-3 w-3 mr-1" aria-hidden="true" />
      {getPaymentStatusLabel(status)}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PaymentsTab({
  projects,
  units,
  customers,
  accounts,
  initialInvoices,
  initialPayments,
  paymentPageData,
  paymentForm,
  setPaymentForm,
  paymentOpen,
  setPaymentOpen,
  selectedPayment,
  setSelectedPayment,
  verificationAccount,
  setVerificationAccount,
  verificationNotes,
  setVerificationNotes,
  currentUserId,
  canSelfVerify,
  errorMsg,
  isSubmitting,
  isSuperAdmin,
  canRecordPayment = false,
  onCreatePaymentSubmit,
  onVerifyPaymentSubmit,
  onDeletePaymentSubmit,
}: PaymentsTabProps) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [subFilter, setSubFilter] = React.useState<PaymentSubFilter>("all");

  const isOwnUpload =
    !canSelfVerify &&
    (selectedPayment?.uploadedBy === currentUserId ||
      (!selectedPayment?.uploadedBy && selectedPayment?.proofUploadedBy === currentUserId));

  // ---------------------------------------------------------------------------
  // Badge counts per status (Req 5.1)
  // Computed from the GLOBAL filtered set (paymentPageData.data)
  // ---------------------------------------------------------------------------
  const statusCounts = React.useMemo(() => {
    const counts: Record<PaymentSubFilter, number> = {
      all: 0,
      pending: 0,
      verified: 0,
      rejected: 0,
      voided: 0,
    };
    const allPayments = paymentPageData.data;
    counts.all = allPayments.length;
    for (const p of allPayments) {
      if (p.status in counts) {
        counts[p.status as Exclude<PaymentSubFilter, "all">]++;
      }
    }
    return counts;
  }, [paymentPageData.data]);

  // The shell applies global context; this tab retains the full filtered set
  // before applying its own status filter and pagination.
  const filteredPayments = React.useMemo(() => {
    const allPayments = paymentPageData.data;
    if (subFilter === "all") return allPayments;
    return allPayments.filter((p) => p.status === subFilter);
  }, [paymentPageData.data, subFilter]);

  // Pagination — namespaced to "paymentPage" (Req 10.8)
  const PAGE_PARAM = "paymentPage";
  const totalCount = filteredPayments.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const requestedPage = Number(searchParams.get(PAGE_PARAM)) || 1;
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
  const pagedPayments = filteredPayments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Reset paymentPage to 1 when sub-filter changes (Req 10.7, 10.9)
  const handleSubFilterChange = React.useCallback(
    (key: PaymentSubFilter) => {
      setSubFilter(key);
      // Reset the namespaced page to 1
      const params = new URLSearchParams(searchParams.toString());
      params.set(PAGE_PARAM, "1");
      window.history.replaceState(null, "", `?${params.toString()}`);
    },
    [searchParams],
  );

  // Build filter context for empty state
  const filterContext = React.useMemo(() => {
    const parts: string[] = ["Kas Masuk & Pembayaran"];
    const label = SUB_FILTERS.find((f) => f.key === subFilter)?.label;
    if (label && subFilter !== "all") parts.push(label);
    return parts.join(" — ");
  }, [subFilter]);

  // ---------------------------------------------------------------------------
  // Selectable invoices for the "Catat Pembayaran" dialog (Task 5.2)
  //
  // Req 5.7: only invoices with status `unpaid` or `partial` are selectable.
  //          `paid` and `cancelled` invoices are never offered.
  // Req 5.2: option shows monospace invoice number, customer/recipient label,
  //          Indonesian type label, and remaining balance.
  // Remaining balance = invoice amount - total VERIFIED payment. We compute the
  // verified total from the payments already loaded so we never present a
  // fictional balance. No mutation/business logic is touched here.
  // ---------------------------------------------------------------------------
  const selectableInvoices = React.useMemo(() => {
    return initialInvoices
      .filter((inv) => inv.status === "unpaid" || inv.status === "partial")
      .map((inv) => {
        const verifiedTotal = initialPayments
          .filter((p) => p.invoiceId === inv.id && p.status === "verified")
          .reduce((sum, p) => sum + p.amount, 0);
        const remaining = Math.max(0, inv.amount - verifiedTotal);
        const context = getInvoiceDocumentContext({
          type: inv.type,
          customerId: inv.customerId,
          bookingId: inv.bookingId,
          customerName: inv.customerName,
          notes: inv.notes,
        });
        const typeLabel = getInvoiceTypeLabel(inv.type, {
          context: context.kind === "internal" ? "expense" : "customer",
        });
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          remaining,
          context,
          typeLabel,
        };
      });
  }, [initialInvoices, initialPayments]);

  return (
    <div className="space-y-6">
      <Card className="bg-card border-input">
        {/* Header */}
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Kas Masuk &amp; Pembayaran
              </CardTitle>
              <CardDescription className="text-xs">
                Daftar pembayaran customer dan setoran manual
              </CardDescription>
            </div>
            {/* Dialog Catat Pembayaran — Revamped (Task 5.2) */}
            {/* Rendered only when the session role may actually submit it — see
                the role gate on `createPayment` in server/actions/finance.ts. */}
            {canRecordPayment && (
            <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
              <DialogTrigger nativeButton={true} render={
                <Button className="btn-premium bg-[#4F6F52] hover:bg-[#3D563F] text-white flex items-center gap-1.5 text-xs px-3 min-h-11 rounded-xl cursor-pointer">
                  <Plus className="h-3.5 w-3.5" /> {t("finance.payment_btn_new")}
                </Button>
              } />
              <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl sm:max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border-border bg-popover p-0 shadow-sage-lg">
                <DialogHeader className="border-b border-border bg-gradient-to-r from-secondary/70 via-white to-transparent px-5 py-5 pr-12 sm:px-6 sm:pr-14">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary shadow-inner">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <DialogTitle className="text-lg font-bold text-foreground">{t("finance.payment_form_title")}</DialogTitle>
                      <DialogDescription className="mt-1 text-xs leading-5 text-muted-foreground">{t("finance.payment_form_desc")}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <form onSubmit={onCreatePaymentSubmit} className="max-h-[calc(90vh-132px)] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                  {errorMsg && (
                    <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-semibold text-[#8B3443] animate-shake">
                      {errorMsg}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.payment_lbl_invoice")}</label>
                    <Select
                      value={paymentForm.invoiceId}
                      onValueChange={(val) => {
                        if (!val) return;
                        if (val === "__no_invoice__") {
                          setPaymentForm(f => ({
                            ...f,
                            invoiceId: "",
                            amount: "",
                          }));
                          return;
                        }
                        const found = initialInvoices.find(inv => inv.id === val);
                        if (found) {
                          const verifiedTotal = initialPayments
                            .filter(p => p.invoiceId === found.id && p.status === "verified")
                            .reduce((sum, p) => sum + p.amount, 0);
                          const remaining = Math.max(0, found.amount - verifiedTotal);
                          setPaymentForm(f => ({
                            ...f,
                            invoiceId: val,
                            projectId: found.projectId,
                            unitId: found.unitId || "",
                            customerId: found.customerId || "",
                            amount: remaining.toString(),
                          }));
                        }
                      }}
                      items={[
                        { label: "Tanpa Invoice", value: "__no_invoice__" },
                        ...selectableInvoices.map(i => ({
                          label: `${i.invoiceNumber} — ${i.context.customerOrRecipientLabel} — Sisa ${formatRupiah(i.remaining)}`,
                          value: i.id,
                        })),
                      ]}
                    >
                      <SelectTrigger className="w-full min-w-0 bg-muted/30 border-border rounded-xl focus:ring-ring font-semibold text-xs h-9.5 text-foreground">
                        <SelectValue
                          placeholder="Pilih invoice atau setoran manual"
                          className="block max-w-full truncate text-left"
                        >
                          {paymentForm.invoiceId ? (() => {
                            const inv = selectableInvoices.find(i => i.id === paymentForm.invoiceId);
                            return inv
                              ? `${inv.invoiceNumber} — Sisa ${formatRupiah(inv.remaining)}`
                              : undefined;
                          })() : paymentForm.invoiceId === "" ? undefined : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="z-[60] max-h-[min(20rem,var(--available-height))] w-[var(--anchor-width)] max-w-[calc(100vw-2rem)] border-border rounded-xl shadow-lg">
                        {/* Tanpa Invoice option */}
                        <SelectItem value="__no_invoice__" className="text-xs font-medium py-2">
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="font-semibold text-foreground">
                              Tanpa Invoice
                            </span>
                            <span className="text-muted-foreground text-[10px]">
                              Setoran manual — tidak dihubungkan ke invoice
                            </span>
                          </span>
                        </SelectItem>
                        {/* Separator */}
                        {selectableInvoices.length > 0 && (
                          <div className="h-px bg-border mx-1.5 my-1" />
                        )}
                        {/* Invoice options */}
                        {selectableInvoices.length === 0 ? (
                          <div className="px-3 py-4 text-center">
                            <p className="text-xs text-muted-foreground font-medium">Tidak ada invoice tersedia</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Semua invoice telah lunas atau dibatalkan</p>
                          </div>
                        ) : (
                          selectableInvoices.map(inv => (
                            <SelectItem key={inv.id} value={inv.id} className="text-xs font-medium py-2">
                              <span className="flex min-w-0 w-full gap-2 items-start">
                                <span className="flex min-w-0 flex-col gap-0.5 flex-1">
                                  <span className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono font-bold text-foreground shrink-0">
                                      {inv.invoiceNumber}
                                    </span>
                                    <FinanceDocumentContextBadge
                                      variant={inv.context.badgeVariant}
                                      className="text-[9px] px-1.5 py-0"
                                    />
                                  </span>
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <span className="truncate text-muted-foreground max-w-[180px]">
                                      {inv.context.customerOrRecipientLabel}
                                    </span>
                                    <span className="text-muted-foreground/60">•</span>
                                    <span className="text-muted-foreground shrink-0">
                                      {inv.typeLabel}
                                    </span>
                                  </span>
                                </span>
                                <span className="shrink-0 text-right">
                                  <span className="font-mono font-bold text-primary tabular-nums text-[11px]">
                                    {formatRupiah(inv.remaining)}
                                  </span>
                                  <span className="block text-[9px] text-muted-foreground">sisa tagihan</span>
                                </span>
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.payment_lbl_project")}</label>
                      <Select
                        value={paymentForm.projectId}
                        onValueChange={(val) => setPaymentForm(f => ({ ...f, projectId: val || "" }))}
                        items={projects.map(p => ({ label: p.name, value: p.id }))}
                      >
                        <SelectTrigger className="bg-muted/30 border-border rounded-xl focus:ring-ring font-semibold text-xs h-9.5 text-foreground">
                          <SelectValue placeholder={t("finance.payment_lbl_project")}>
                            {paymentForm.projectId ? projects.find(p => p.id === paymentForm.projectId)?.name : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="border-border rounded-xl">
                          {projects.map(p => (
                            <SelectItem key={p.id} value={p.id} className="text-xs font-medium">{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.payment_lbl_amount")}</label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="Rp 0"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                        className="bg-muted/30 border-border rounded-xl focus-visible:ring-ring font-mono font-bold text-xs h-9.5 text-foreground"
                        required
                      />
                    </div>
                  </div>

                  {paymentForm.amount && !isNaN(Number(paymentForm.amount)) && Number(paymentForm.amount) > 0 && (
                    <div className="p-2.5 bg-secondary/50 border border-primary/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Preview Nominal</span>
                      <span className="font-mono font-extrabold text-sm text-primary tracking-tight tabular-nums">
                        {formatRupiah(Number(paymentForm.amount))}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.payment_lbl_method")}</label>
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
                        <SelectTrigger className="bg-muted/30 border-border rounded-xl focus:ring-ring font-semibold text-xs h-9.5 text-foreground">
                          <SelectValue placeholder={t("finance.payment_lbl_method")}>
                            {paymentForm.paymentMethod === "transfer" && t("finance.payment_method_transfer")}
                            {paymentForm.paymentMethod === "cash" && t("finance.payment_method_cash")}
                            {paymentForm.paymentMethod === "giro" && t("finance.payment_method_giro")}
                            {paymentForm.paymentMethod === "other" && t("finance.payment_method_other")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="border-border rounded-xl">
                          <SelectItem value="transfer" className="text-xs font-medium">{t("finance.payment_method_transfer")}</SelectItem>
                          <SelectItem value="cash" className="text-xs font-medium">{t("finance.payment_method_cash")}</SelectItem>
                          <SelectItem value="giro" className="text-xs font-medium">{t("finance.payment_method_giro")}</SelectItem>
                          <SelectItem value="other" className="text-xs font-medium">{t("finance.payment_method_other")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.payment_lbl_date")}</label>
                      <Input
                        type="date"
                        value={paymentForm.paymentDate}
                        onChange={(e) => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))}
                        className="bg-muted/30 border-border rounded-xl focus-visible:ring-ring font-medium text-xs h-9.5 text-foreground"
                        required
                      />
                    </div>
                  </div>

                  <DialogFooter className="-mx-5 -mb-5 mt-5 rounded-none border-x-0 border-b-0 px-5 py-4 sm:-mx-6 sm:-mb-5 sm:px-6">
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-white text-xs font-bold h-10 rounded-xl shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium"
                      disabled={isSubmitting || isOwnUpload}
                    >
                      {isSubmitting ? t("finance.saving") : t("finance.payment_btn_submit")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </CardHeader>

        {/* Sub-filter bar (Req 4.1, 5.1) */}
        <div
          className="flex overflow-x-auto gap-2 px-5 pb-4 scrollbar-none"
          role="group"
          aria-label="Filter pembayaran"
        >
          {SUB_FILTERS.map((f) => {
            const count = statusCounts[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => handleSubFilterChange(f.key)}
                aria-pressed={subFilter === f.key}
                className={cn(
                  "inline-flex min-h-10 items-center whitespace-nowrap rounded-full border px-4 text-xs font-semibold transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  subFilter === f.key
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-secondary/60 text-muted-foreground border-border hover:border-primary/30 hover:bg-secondary hover:text-foreground",
                )}
              >
                {f.label}
                <Badge
                  className={cn(
                    "ml-1.5 text-[9px] font-bold px-1.5 py-0 min-w-[1.25rem] h-4 rounded-full inline-flex items-center justify-center tabular-nums",
                    subFilter === f.key
                      ? "bg-white/20 text-white border-white/30"
                      : "bg-muted text-muted-foreground border-border/50",
                  )}
                >
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* Table (Req 4.2) */}
        <CardContent className="p-0">
          <FinanceTableScroll>
          <Table className="min-w-[1100px] table-fixed">
            <TableHeader className="bg-secondary/35">
              <TableRow className="text-xs hover:bg-transparent">
                <TableHead className="h-12 w-[170px] px-5 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Nomor Pembayaran</TableHead>
                <TableHead className="h-12 w-[170px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Invoice Terkait</TableHead>
                <TableHead className="h-12 w-[170px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Customer</TableHead>
                <TableHead className="h-12 w-[170px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Project</TableHead>
                <TableHead className="h-12 w-[140px] px-4 text-right text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Nominal</TableHead>
                <TableHead className="h-12 w-[120px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Metode</TableHead>
                <TableHead className="h-12 w-[150px] px-4 text-center text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Status</TableHead>
                <TableHead className="h-12 w-[130px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Tanggal</TableHead>
                <TableHead className="h-12 w-[120px] px-5 text-center text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-0">
                    <FinanceTableState
                      variant="empty"
                      icon={<CreditCard className="h-6 w-6" />}
                      filterContext={filterContext}
                      title={
                        subFilter === "all"
                          ? "Belum ada pembayaran"
                          : `Tidak ada pembayaran untuk filter "${SUB_FILTERS.find((sf) => sf.key === subFilter)?.label ?? subFilter}"`
                      }
                      description={
                        subFilter === "pending"
                          ? "Tidak ada pembayaran yang perlu diverifikasi saat ini."
                          : subFilter === "verified"
                          ? "Belum ada pembayaran terverifikasi pada filter aktif."
                          : subFilter === "rejected"
                          ? "Belum ada pembayaran yang ditolak pada filter aktif."
                          : subFilter === "voided"
                          ? "Belum ada pembayaran yang dibatalkan pada filter aktif."
                          : "Catat pembayaran baru atau ubah filter jika sedang mencari transaksi tertentu."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pagedPayments.map((pay) => (
                  <TableRow key={pay.id} className="h-[76px] text-xs hover:bg-secondary/25 transition-colors duration-100">
                    {/* Nomor Pembayaran — monospace, link to detail (Req 4.7) */}
                    <TableCell className="px-5 py-4 align-middle">
                      <FinanceDocLink
                        href={`/finance/payments/${pay.id}`}
                        className="font-mono text-xs font-semibold"
                      >
                        {pay.paymentNumber}
                      </FinanceDocLink>
                    </TableCell>

                    {/* Invoice Terkait — link or "Setoran Manual" (Req 4.4, 4.7) */}
                    <TableCell className="px-4 py-4 align-middle">
                      {pay.invoiceId && pay.invoiceNumber ? (
                        <FinanceDocLink
                          href={`/finance/invoices/${pay.invoiceId}`}
                          className="font-mono text-xs"
                        >
                          {pay.invoiceNumber}
                        </FinanceDocLink>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Setoran Manual
                        </span>
                      )}
                    </TableCell>

                    {/* Customer */}
                    <TableCell className="px-4 py-4 text-foreground max-w-[160px] align-middle">
                      <span className="block truncate" title={pay.customerName || undefined}>
                        {pay.customerName || "\u2014"}
                      </span>
                    </TableCell>

                    {/* Project */}
                    <TableCell className="px-4 py-4 text-muted-foreground max-w-[140px] align-middle">
                      <span className="block truncate" title={pay.projectName}>
                        {pay.projectName}
                      </span>
                    </TableCell>

                    {/* Nominal — tabular-nums (Req 4.2) */}
                    <TableCell className="px-4 py-4 text-right font-mono font-semibold tabular-nums align-middle">
                      {formatRupiah(pay.amount)}
                    </TableCell>

                    {/* Metode */}
                    <TableCell className="px-4 py-4 whitespace-nowrap align-middle">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase bg-secondary/50 px-2 py-0.5 rounded-md">
                        {getPaymentMethodLabel(pay.paymentMethod)}
                      </span>
                    </TableCell>

                    {/* Status (Req 4.3) */}
                    <TableCell className="px-4 py-4 text-center align-middle">
                      <PaymentStatusBadge status={pay.status} />
                    </TableCell>

                    {/* Tanggal */}
                    <TableCell className="px-4 py-4 whitespace-nowrap text-muted-foreground align-middle">
                      {formatDate(pay.paymentDate)}
                    </TableCell>

                    {/* Aksi (Req 4.5, 4.6) */}
                    <TableCell className="px-5 py-4 text-center align-middle">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {/* Tinjau — hanya pada pending (Req 5.4) */}
                        {pay.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedPayment(pay);
                              if (accounts.length > 0) {
                                setVerificationAccount(accounts[0].id);
                              }
                              setVerificationNotes("");
                            }}
                            aria-label={`Tinjau pembayaran ${pay.paymentNumber}`}
                            className="min-h-10 rounded-xl bg-primary px-3 text-xs font-semibold text-white hover:bg-primary/90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                          >
                            Tinjau
                          </Button>
                        )}

                        {pay.status !== "pending" && (
                          <FinanceDocLink
                            href={`/finance/payments/${pay.id}`}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-primary/20 bg-card px-3 text-xs font-semibold text-primary-dark hover:bg-secondary/70"
                          >
                            <Eye className="h-3.5 w-3.5" /> Detail
                          </FinanceDocLink>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </FinanceTableScroll>

          {/* Pagination (Req 5.8, 10.8) */}
          {totalCount > 0 && (
            <DataTablePagination
              totalItems={totalCount}
              itemsPerPage={PAGE_SIZE}
              currentPage={currentPage}
              pageParam="paymentPage"
            />
          )}
        </CardContent>
      </Card>

      {/* Payment Verification Dialog — preserved from existing implementation */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => { if (!open) setSelectedPayment(null); }}>
        <DialogContent className="bg-popover backdrop-blur-md border-border shadow-sage-lg rounded-3xl p-6 w-[calc(100vw-2rem)] max-w-md sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">{t("finance.verify_title")}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">{t("finance.verify_desc")}</DialogDescription>
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
                  const otherPayment = paymentPageData.data.find(
                    (p: PaymentListItem) => p.invoiceId === selectedPayment.invoiceId && p.proofFileUrl
                  ) || initialPayments.find(
                    p => p.invoiceId === selectedPayment.invoiceId && p.proofFileUrl
                  );
                  return otherPayment?.proofFileUrl || null;
                })();
                return (
                  <div className="p-3.5 bg-gradient-to-br from-white to-[#F7F8F3] border border-border rounded-2xl space-y-1.5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#8FAF9A]" />
                    <p className="text-xs text-muted-foreground">{t("finance.verify_lbl_payment_no")} <span className="font-mono font-bold text-foreground pl-1">{selectedPayment.paymentNumber}</span></p>
                    <p className="text-xs text-muted-foreground">{t("finance.verify_lbl_customer")} <span className="font-semibold text-foreground pl-1">{selectedPayment.customerName}</span></p>
                    <p className="text-xs text-muted-foreground">{t("finance.verify_lbl_amount")} <span className="font-mono font-extrabold text-sm text-primary pl-1">Rp {selectedPayment.amount.toLocaleString("id-ID")}</span></p>
                    {proofUrl && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 pt-1.5 border-t border-border/50">
                        {t("finance.verify_lbl_proof")}
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-[#3D563F] underline font-bold inline-flex items-center gap-1 ml-1"
                        >
                          <Eye className="h-3.5 w-3.5" /> {t("finance.view_proof")}
                        </a>
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.verify_lbl_deposit_account")}</label>
                <Select
                  value={verificationAccount}
                  onValueChange={(val) => setVerificationAccount(val || "")}
                  items={accounts.map(acc => ({ label: `${acc.name} (Saldo: Rp ${acc.openingBalance.toLocaleString()})`, value: acc.id }))}
                >
                  <SelectTrigger className="w-full max-w-full min-w-0 overflow-hidden bg-muted/30 border-border rounded-[12px] focus:ring-ring font-semibold text-xs h-10 text-foreground">
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
                  <SelectContent className="border-border rounded-[12px]">
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id} className="text-xs font-medium">{acc.name} ({t("finance.balance_lbl")} Rp {acc.openingBalance.toLocaleString()})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.verify_lbl_notes")}</label>
                <textarea
                  placeholder={t("finance.verify_notes_ph")}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  className="flex min-h-[80px] w-full rounded-[12px] border border-border bg-muted/30/60 px-3 py-2 text-xs focus:border-[#4F6F52] focus-visible:outline-none focus:bg-card transition-all font-medium leading-normal resize-none text-foreground"
                />
              </div>

              <div className="bg-amber-50/80 border border-amber-200/50 rounded-2xl p-4 text-[11px] text-[#8A6D1D] leading-relaxed space-y-2">
                <p className="font-extrabold flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-[#8A6D1D]">
                  ⚠️ {t("finance.verify_warning_title")}
                </p>
                <ul className="list-disc list-inside space-y-1 font-semibold pl-1">
                  <li><strong>{t("finance.verify_btn_approve")}:</strong> {t("finance.verify_warning_approve")}</li>
                  <li><strong>{t("finance.verify_btn_reject")}:</strong> {t("finance.verify_warning_reject")}</li>
                </ul>
              </div>

              {isOwnUpload && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-[11px] font-semibold leading-relaxed text-amber-800">
                  Bukti bayar ini diunggah oleh akun Anda sendiri, sehingga harus diverifikasi oleh user lain yang berwenang.
                </div>
              )}

              <div className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => onVerifyPaymentSubmit(false)}
                    className="bg-card text-[#D77A7A] border border-rose-200 hover:bg-rose-50 font-bold text-xs h-10 rounded-[12px] btn-premium"
                    disabled={isSubmitting || isOwnUpload}
                  >
                    {t("finance.verify_btn_reject")}
                  </Button>
                  <Button
                    onClick={() => onVerifyPaymentSubmit(true)}
                    className="bg-primary hover:bg-primary/90 text-white font-bold text-xs h-10 rounded-[12px] btn-premium"
                    disabled={isSubmitting}
                  >
                    {t("finance.verify_btn_approve")}
                  </Button>
                </div>

                {isSuperAdmin && (
                  <Button
                    onClick={onDeletePaymentSubmit}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10 rounded-[12px] shadow-[0_4px_14px_rgba(220,38,38,0.25)] btn-premium"
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
  );
}
