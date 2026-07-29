"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FileText, MoreVertical, Printer, Receipt, Eye, CheckCircle2, CircleDot, Circle, Ban, AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { FinanceDocLink } from "@/components/finance/finance-doc-link";
import { FinanceDocumentContextBadge } from "@/components/finance/finance-document-context-badge";
import { FinanceTableState } from "@/components/finance/finance-table-state";
import { FinanceTableScroll } from "@/components/finance/finance-table-scroll";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
  getInvoiceDocumentContext,
  computeInvoicePaymentSummary,
} from "@/lib/finance-invoice-summary";
import { getInvoiceStatusLabel, getInvoiceTypeLabel } from "@/lib/label-helpers";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InvoiceItem = {
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
  // Additive fields from Task 14.1
  totalPaidVerified?: number;
  remainingBalance?: number;
  relatedExpenseTransactionId?: string | null;
  relatedApprovalId?: string | null;
};

type PaymentItem = {
  id: string;
  invoiceId: string | null;
  amount: number;
  status: "pending" | "verified" | "rejected" | "voided";
};

export interface InvoicesTabProps {
  projects: Array<{ id: string; name: string; code: string }>;
  units: Array<{ id: string; code: string; projectId: string; price: number }>;
  customers: Array<{ id: string; name: string; phone: string }>;
  initialInvoices: InvoiceItem[];
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
    status: "pending" | "verified" | "rejected" | "voided";
    verifiedBy: string | null;
    verifiedAt: Date | null;
    createdAt: Date;
    projectName: string;
    customerName: string | null;
    unitCode: string | null;
    invoiceNumber: string | null;
  }>;
  selectedProjectId: string;
  searchQuery: string;
  /**
   * Global period filter (null = Semua Periode). Applied on the invoice period
   * basis `dueDate ?? createdAt` so the tab stays consistent with the Finance
   * Home "Piutang Berjalan" summary and the Reports tab (Req 1.3, 1.10).
   */
  periodStart?: Date | null;
  periodEnd?: Date | null;
}

// ---------------------------------------------------------------------------
// Sub-filter definitions — Jenis chip bar + Status dropdown (Req 4.2)
// ---------------------------------------------------------------------------

type InvoiceDocumentFilter = "all" | "customer" | "internal";
type InvoiceStatusFilter = "all" | "belum_lunas" | "lunas" | "jatuh_tempo";

const DOCUMENT_FILTERS: Array<{ key: InvoiceDocumentFilter; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "customer", label: "Customer" },
  { key: "internal", label: "Internal" },
];

const STATUS_FILTERS: Array<{ key: InvoiceStatusFilter; label: string }> = [
  { key: "all", label: "Semua Status" },
  { key: "belum_lunas", label: "Belum Lunas" },
  { key: "lunas", label: "Lunas" },
  { key: "jatuh_tempo", label: "Jatuh Tempo" },
];

function getStatusFilterLabel(value: InvoiceStatusFilter): string {
  return STATUS_FILTERS.find((filter) => filter.key === value)?.label ?? "Semua Status";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format Rupiah with tabular-nums */
function formatRupiah(amount: number): string {
  return `Rp\u00A0${amount.toLocaleString("id-ID")}`;
}

/** Format date to locale ID short string */
function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Is the invoice overdue? dueDate < today AND status is not paid/cancelled */
function isOverdue(inv: InvoiceItem): boolean {
  if (!inv.dueDate) return false;
  if (inv.status === "paid" || inv.status === "cancelled") return false;
  return new Date(inv.dueDate) < new Date();
}

/** Build a filter context description for empty state */
function buildFilterContext(
  documentFilter: InvoiceDocumentFilter,
  statusFilter: InvoiceStatusFilter,
  searchQuery: string,
  selectedProjectId: string,
  projects: Array<{ id: string; name: string }>,
): string {
  const parts: string[] = ["Invoice & Tagihan"];
  const documentLabel = DOCUMENT_FILTERS.find((f) => f.key === documentFilter)?.label;
  const statusLabel = STATUS_FILTERS.find((f) => f.key === statusFilter)?.label;
  if (documentLabel && documentFilter !== "all") parts.push(documentLabel);
  if (statusLabel && statusFilter !== "all") parts.push(statusLabel);
  if (selectedProjectId !== "all") {
    const proj = projects.find((p) => p.id === selectedProjectId);
    if (proj) parts.push(proj.name);
  }
  if (searchQuery) parts.push(`"${searchQuery}"`);
  return parts.join(" — ");
}

// ---------------------------------------------------------------------------
// Status badge styles
// ---------------------------------------------------------------------------

function InvoiceStatusBadge({
  status,
  overdue,
}: {
  status: InvoiceItem["status"];
  overdue: boolean;
}) {
  // Badge icons (never color-only — UX Rule: always icon + text)
  const IconMap: Record<InvoiceItem["status"], React.ElementType> = {
    paid: CheckCircle2,
    partial: CircleDot,
    unpaid: Circle,
    cancelled: Ban,
  };

  if (overdue && status !== "paid" && status !== "cancelled") {
    return (
      <Badge className="bg-rose-50 text-rose-700 border border-rose-200/80 text-[10px] font-semibold">
        <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />
        Jatuh Tempo
      </Badge>
    );
  }
  const styles: Record<InvoiceItem["status"], string> = {
    paid: "bg-emerald-50 text-emerald-700 border border-emerald-200/80",
    partial: "bg-amber-50 text-amber-700 border border-amber-200/80",
    unpaid: "bg-slate-50 text-slate-600 border border-slate-200/80",
    cancelled: "bg-gray-100 text-gray-500 border border-gray-200/80",
  };
  const Icon = IconMap[status];
  return (
    <Badge className={cn("text-[10px] font-semibold", styles[status])}>
      <Icon className="h-3 w-3 mr-1" aria-hidden="true" />
      {getInvoiceStatusLabel(status)}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Summary Cards (Req 4.3) — 3 inline cards above table
// ---------------------------------------------------------------------------

function InvoiceSummaryCards({
  invoices,
}: {
  invoices: InvoiceItem[];
}) {
  const totalTagihan = invoices.reduce((s, i) => s + i.amount, 0);
  const sudahDibayar = invoices.reduce((s, i) => s + (i.totalPaidVerified ?? 0), 0);
  const sisaTagihan = invoices.reduce(
    (s, i) => s + Math.max(0, i.remainingBalance ?? i.amount - (i.totalPaidVerified ?? 0)),
    0,
  );
  const docCount = invoices.length;
  const pctPaid = totalTagihan > 0 ? ((sudahDibayar / totalTagihan) * 100).toFixed(1) : "0.0";
  const pctSisa = totalTagihan > 0 ? ((sisaTagihan / totalTagihan) * 100).toFixed(1) : "0.0";

  const cards = [
    {
      label: "Total Tagihan",
      value: formatRupiah(totalTagihan),
      sub: `${docCount} dokumen`,
      color: "text-foreground",
      accent: false,
    },
    {
      label: "Sudah Dibayar",
      value: formatRupiah(sudahDibayar),
      sub: `${pctPaid}% dari total`,
      color: "text-emerald-700",
      accent: false,
    },
    {
      label: "Sisa Tagihan",
      value: formatRupiah(sisaTagihan),
      sub: `${pctSisa}% dari total`,
      color: sisaTagihan > 0 ? "text-rose-700" : "text-emerald-700",
      accent: sisaTagihan > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 px-4 pt-4 pb-2 sm:grid-cols-3">
      {cards.map(({ label, value, sub, color, accent }) => (
        <div
          key={label}
          className={cn(
            "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5",
            accent
              ? "border-rose-200/80 bg-rose-50/30"
              : "border-border/60 bg-secondary/30",
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className={cn("font-mono text-sm font-bold tabular-nums", color)}>
            {value}
          </span>
          <span className="text-[10px] text-muted-foreground">{sub}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

/**
 * Check if the print route is available for an invoice.
 * The route /finance/invoices/[id]/print exists in the app router.
 */
const PRINT_ROUTE_AVAILABLE = true;

export function InvoicesTab({
  projects,
  initialInvoices,
  initialPayments,
  selectedProjectId,
  searchQuery,
  periodStart = null,
  periodEnd = null,
}: InvoicesTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter state (Req 4.2)
  const [jenisFilter, setJenisFilter] = React.useState<InvoiceDocumentFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<InvoiceStatusFilter>("all");

  // Pagination via URL namespace "invoicePage" (Req 10.8)
  const invoicePage = Number(searchParams.get("invoicePage")) || 1;

  /** Reset pagination to 1 when filter changes (Req 10.7) */
  const resetPage = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("invoicePage", "1");
    router.push(`?${params.toString()}`);
  }, [searchParams, router]);

  const handleJenisChange = (key: InvoiceDocumentFilter) => {
    setJenisFilter(key);
    resetPage();
  };

  const handleStatusChange = (value: InvoiceStatusFilter | null) => {
    setStatusFilter(value ?? "all");
    resetPage();
  };

  // Build per-invoice payment map for fallback computation
  const paymentsPerInvoice = React.useMemo(() => {
    const map = new Map<string, PaymentItem[]>();
    for (const p of initialPayments) {
      if (!p.invoiceId) continue;
      const existing = map.get(p.invoiceId) ?? [];
      existing.push({ id: p.id, invoiceId: p.invoiceId, amount: p.amount, status: p.status });
      map.set(p.invoiceId, existing);
    }
    return map;
  }, [initialPayments]);

  // Enrich invoices with computed payment summary if additive fields missing
  const enrichedInvoices = React.useMemo(() => {
    return initialInvoices.map((inv) => {
      if (inv.totalPaidVerified !== undefined && inv.remainingBalance !== undefined) {
        return inv;
      }
      const payments = paymentsPerInvoice.get(inv.id) ?? [];
      const summary = computeInvoicePaymentSummary(inv.amount, payments, {
        invoiceStatus: inv.status,
      });
      return {
        ...inv,
        totalPaidVerified: summary.totalPaid,
        remainingBalance: summary.remainingBalance,
      };
    });
  }, [initialInvoices, paymentsPerInvoice]);

  // Apply filters — AND logic (Req 4.2)
  const filteredInvoices = React.useMemo(() => {
    const now = new Date();

    return enrichedInvoices.filter((inv) => {
      // Project filter
      if (selectedProjectId !== "all" && inv.projectId !== selectedProjectId) {
        return false;
      }

      // Period filter — basis dueDate fallback createdAt
      if (periodStart || periodEnd) {
        const dateForPeriod = inv.dueDate ?? inv.createdAt;
        if (!dateForPeriod) return false;
        const d = new Date(dateForPeriod);
        if (periodStart && d < periodStart) return false;
        if (periodEnd && d > periodEnd) return false;
      }

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          inv.invoiceNumber.toLowerCase().includes(q) ||
          (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
          (inv.unitCode && inv.unitCode.toLowerCase().includes(q)) ||
          inv.projectName.toLowerCase().includes(q);
        if (!matches) return false;
      }

      const ctx = getInvoiceDocumentContext({
        type: inv.type,
        customerId: inv.customerId,
        bookingId: inv.bookingId,
        customerName: inv.customerName,
        notes: inv.notes,
        scheduleKind: inv.scheduleKind,
        relatedExpenseTransactionId: inv.relatedExpenseTransactionId,
        relatedApprovalId: inv.relatedApprovalId,
      });

      // Jenis filter (document type context)
      if (jenisFilter === "customer" && ctx.kind !== "customer") return false;
      if (jenisFilter === "internal" && ctx.kind !== "internal") return false;

      // Status filter — Indonesian labels mapped to logic
      if (statusFilter === "lunas") return inv.status === "paid";
      if (statusFilter === "belum_lunas")
        return inv.status === "unpaid" || inv.status === "partial";
      if (statusFilter === "jatuh_tempo") {
        if (!inv.dueDate) return false;
        if (inv.status === "paid" || inv.status === "cancelled") return false;
        return new Date(inv.dueDate) < now;
      }

      return true;
    });
  }, [enrichedInvoices, selectedProjectId, searchQuery, jenisFilter, statusFilter, periodStart, periodEnd]);

  // Pagination
  const totalCount = filteredInvoices.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(invoicePage, totalPages);
  const pagedInvoices = filteredInvoices.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const filterContext = buildFilterContext(
    jenisFilter,
    statusFilter,
    searchQuery,
    selectedProjectId,
    projects,
  );

  return (
    <Card className="bg-card border-input">
      {/* Header with + Buat Invoice button (Req 4.1) */}
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Invoice &amp; Tagihan
            </CardTitle>
            <CardDescription className="text-xs">
              Daftar tagihan customer dan pengeluaran internal
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* Filter row — Jenis chips + Status dropdown (Req 4.2) */}
      <div className="grid gap-4 px-4 pb-4 sm:grid-cols-[auto_220px] sm:items-start sm:gap-6">
        <div className="flex flex-col gap-2" role="group" aria-label="Filter jenis dokumen">
          <p className="block h-4 text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-muted-foreground">Jenis</p>
          <div className="flex flex-wrap gap-2">
            {DOCUMENT_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => handleJenisChange(filter.key)}
                aria-pressed={jenisFilter === filter.key}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full border px-4 text-xs font-semibold transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  jenisFilter === filter.key
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-secondary/60 text-muted-foreground hover:border-primary/30 hover:bg-secondary hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-[220px]">
          <label className="block h-4 text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-muted-foreground" htmlFor="invoice-status-filter">
            Status
          </label>
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger
              id="invoice-status-filter"
              className="min-h-10 w-full rounded-xl border-border bg-secondary/35 px-3 text-sm font-medium text-foreground hover:border-primary/30 focus-visible:border-primary focus-visible:ring-primary/20"
            >
              <SelectValue>{getStatusFilterLabel(statusFilter)}</SelectValue>
            </SelectTrigger>
            <SelectContent align="start" className="rounded-xl border-border p-1">
              {STATUS_FILTERS.map((filter) => (
                <SelectItem
                  key={filter.key}
                  value={filter.key}
                  className="min-h-9 rounded-lg text-sm"
                >
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards (Req 4.3) */}
      {filteredInvoices.length > 0 && (
        <InvoiceSummaryCards invoices={filteredInvoices} />
      )}

      {/* Table */}
      <CardContent className="p-0">
        <FinanceTableScroll>
        <Table className="min-w-[1320px] table-fixed">
          <TableHeader className="bg-secondary/35">
            <TableRow className="text-xs hover:bg-transparent">
              <TableHead className="h-12 w-[170px] px-5 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Nomor Invoice</TableHead>
              <TableHead className="h-12 w-[170px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Tipe Dokumen</TableHead>
              <TableHead className="h-12 w-[180px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Customer/Penerima</TableHead>
              <TableHead className="h-12 w-[160px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Proyek</TableHead>
              <TableHead className="h-12 w-[110px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Unit/Kavling</TableHead>
              <TableHead className="h-12 w-[140px] px-4 text-right text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Total</TableHead>
              <TableHead className="h-12 w-[140px] px-4 text-right text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Dibayar</TableHead>
              <TableHead className="h-12 w-[140px] px-4 text-right text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Sisa</TableHead>
              <TableHead className="h-12 w-[130px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Jatuh Tempo</TableHead>
              <TableHead className="h-12 w-[130px] px-4 text-center text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Status</TableHead>
              <TableHead className="h-12 w-[100px] px-5 text-center text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="p-0">
                  <FinanceTableState
                    variant="empty"
                    icon={<FileText className="h-6 w-6" />}
                    filterContext={filterContext}
                    title={
                      jenisFilter === "all" && statusFilter === "all"
                        ? "Belum ada invoice"
                        : "Tidak ada invoice untuk filter yang dipilih"
                    }
                    description={
                      searchQuery
                        ? `Tidak ada invoice yang cocok dengan pencarian "${searchQuery}". Coba ubah kata kunci atau filter.`
                        : statusFilter === "jatuh_tempo"
                        ? "Tidak ada invoice yang melewati jatuh tempo."
                        : statusFilter === "lunas"
                        ? "Belum ada invoice yang berstatus Lunas."
                        : statusFilter === "belum_lunas"
                        ? "Semua invoice sudah lunas atau tidak ada invoice aktif."
                        : "Tidak ada data untuk filter yang dipilih. Coba ubah filter atau pencarian."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              pagedInvoices.map((inv) => {
                const ctx = getInvoiceDocumentContext({
                  type: inv.type,
                  customerId: inv.customerId,
                  bookingId: inv.bookingId,
                  customerName: inv.customerName,
                  notes: inv.notes,
                  scheduleKind: inv.scheduleKind,
                  relatedExpenseTransactionId: inv.relatedExpenseTransactionId,
                  relatedApprovalId: inv.relatedApprovalId,
                });

                const totalPaid = inv.totalPaidVerified ?? 0;
                const sisa = Math.max(0, inv.remainingBalance ?? inv.amount - totalPaid);
                const overdue = isOverdue(inv);

                // Tipe dokumen label: use context-aware label
                const typeLabel = getInvoiceTypeLabel(inv.type, {
                  context:
                    ctx.kind === "internal"
                      ? "expense"
                      : ctx.kind === "customer"
                      ? "customer"
                      : "neutral",
                });

                return (
                  <TableRow
                    key={inv.id}
                    className={cn(
                      "h-[82px] text-xs hover:bg-secondary/25 transition-colors duration-100",
                      overdue && "bg-rose-50/30",
                    )}
                  >
                    {/* Nomor Invoice — monospace, link to detail */}
                    <TableCell className="px-5 py-4 align-middle">
                      <FinanceDocLink
                        href={`/finance/invoices/${inv.id}`}
                        className="font-mono text-xs font-semibold"
                      >
                        {inv.invoiceNumber}
                      </FinanceDocLink>
                    </TableCell>

                    {/* Tipe Dokumen — badge konteks */}
                    <TableCell className="px-4 py-4 align-middle">
                      <div className="flex flex-col gap-1">
                        <FinanceDocumentContextBadge
                          variant={ctx.badgeVariant}
                          label={ctx.kind === "internal" ? "Pengeluaran Internal" : ctx.label}
                        />
                        <span className="text-[10px] text-muted-foreground">{typeLabel}</span>
                      </div>
                    </TableCell>

                    {/* Customer/Penerima */}
                    <TableCell className="px-4 py-4 text-foreground max-w-[160px] align-middle">
                      <span className="block truncate" title={ctx.customerOrRecipientLabel || undefined}>
                        {ctx.customerOrRecipientLabel || "—"}
                      </span>
                    </TableCell>

                    {/* Proyek */}
                    <TableCell className="px-4 py-4 text-muted-foreground max-w-[140px] align-middle">
                      <span className="block truncate" title={inv.projectName}>
                        {inv.projectName}
                      </span>
                    </TableCell>

                    {/* Unit/Kavling */}
                    <TableCell className="px-4 py-4 align-middle">
                      {inv.unitCode ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {inv.unitCode}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>

                    {/* Total */}
                    <TableCell className="px-4 py-4 text-right font-mono font-semibold tabular-nums align-middle">
                      {formatRupiah(inv.amount)}
                    </TableCell>

                    {/* Dibayar */}
                    <TableCell className="px-4 py-4 text-right font-mono tabular-nums text-emerald-700 align-middle">
                      {ctx.kind === "internal" && totalPaid === 0 ? (
                        <span className="text-muted-foreground/50">—</span>
                      ) : (
                        formatRupiah(totalPaid)
                      )}
                    </TableCell>

                    {/* Sisa */}
                    <TableCell className="px-4 py-4 text-right font-mono tabular-nums align-middle">
                      {ctx.kind === "internal" && sisa === 0 ? (
                        <span className="text-muted-foreground/50">—</span>
                      ) : (
                        <span className={sisa > 0 ? "text-rose-700" : "text-emerald-700"}>
                          {formatRupiah(sisa)}
                        </span>
                      )}
                    </TableCell>

                    {/* Jatuh Tempo */}
                    <TableCell
                      className={cn(
                        "px-4 py-4 whitespace-nowrap align-middle",
                        overdue ? "text-rose-600 font-semibold" : "text-muted-foreground",
                      )}
                    >
                      {formatDate(inv.dueDate)}
                    </TableCell>

                    {/* Status badge */}
                    <TableCell className="px-4 py-4 text-center align-middle">
                      <InvoiceStatusBadge status={inv.status} overdue={overdue} />
                    </TableCell>

                    {/* Aksi — Gear icon dropdown (Req 4.5, 11.5) */}
                    <TableCell className="px-5 py-4 text-center align-middle">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className={cn(
                            "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg",
                            "border border-border bg-secondary/60 text-muted-foreground",
                            "hover:bg-primary hover:text-white transition-colors duration-150",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                            "cursor-pointer",
                          )}
                          aria-label={`Menu aksi ${inv.invoiceNumber}`}
                          title="Menu aksi"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
                          <DropdownMenuItem
                            className="cursor-pointer gap-2"
                            onClick={() => router.push(`/finance/invoices/${inv.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                            Lihat Detail
                          </DropdownMenuItem>
                          {PRINT_ROUTE_AVAILABLE && (
                            <DropdownMenuItem
                              className="cursor-pointer gap-2"
                              onClick={() => window.open(`/finance/invoices/${inv.id}/print`, "_blank")}
                            >
                              <Printer className="h-4 w-4" />
                              Cetak
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </FinanceTableScroll>

        {/* Pagination (Req 10.8 — pageParam="invoicePage") */}
        {totalCount > 0 && (
          <DataTablePagination
            totalItems={totalCount}
            itemsPerPage={PAGE_SIZE}
            currentPage={safePage}
            pageParam="invoicePage"
          />
        )}
      </CardContent>
    </Card>
  );
}
