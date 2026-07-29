"use client";

import * as React from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, TrendingDown, ArrowUpRight, ArrowDownRight, Undo2, Eye } from "lucide-react";
import { FinanceDocLink } from "@/components/finance/finance-doc-link";
import { FinanceTableState } from "@/components/finance/finance-table-state";
import { FinanceTableScroll } from "@/components/finance/finance-table-scroll";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — mirror the richer transaction shape provided by FinanceShell
// (loader already includes reversal markers via Task 14.1)
// ---------------------------------------------------------------------------

interface Transaction {
  id: string;
  transactionNumber: string;
  projectId: string;
  accountId: string;
  categoryId: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  transactionDate: Date;
  paymentMethod: "cash" | "transfer" | "giro" | "other";
  approvalStatus:
    | "not_required"
    | "pending"
    | "approved"
    | "rejected"
    | "insufficient_balance";
  accountName: string;
  categoryName: string;
  projectName: string;
  unitCode: string | null;
  customerName: string | null;
  invoiceNumber?: string | null;
  invoiceId?: string | null;
  resolvedApproverName?: string | null;
  // Additive reversal markers (Task 14.1)
  reversalOfTransactionId?: string | null;
  reversalOfPaymentId?: string | null;
  reversalReason?: string | null;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: "cash" | "bank" | "receivable" | "payable" | "income" | "expense";
  openingBalance: number;
  currentBalance: number;
  status: "active" | "inactive";
}

interface TransactionsTabProps {
  filteredTransactions: Transaction[];
  accounts: Account[];
  projects: Array<{ id: string; name: string; code: string }>;
  categories: Array<{
    id: string;
    name: string;
    type: "income" | "expense";
    status: "active" | "inactive";
  }>;
  expenseForm: {
    projectId: string;
    accountId: string;
    categoryId: string;
    amount: string;
    description: string;
    transactionDate: string;
    paymentMethod: "cash" | "transfer" | "giro" | "other";
  };
  setExpenseForm: React.Dispatch<
    React.SetStateAction<{
      projectId: string;
      accountId: string;
      categoryId: string;
      amount: string;
      description: string;
      transactionDate: string;
      paymentMethod: "cash" | "transfer" | "giro" | "other";
    }>
  >;
  errorMsg: string | null;
  isSubmitting: boolean;
  onCreateExpenseSubmit: (e: React.FormEvent) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Presentation helpers (pure)
// ---------------------------------------------------------------------------

/** Rupiah with tabular-nums friendly non-breaking space. */
function formatRupiah(amount: number): string {
  const prefix = amount < 0 ? "-" : "";
  return `${prefix}Rp\u00A0${Math.abs(amount).toLocaleString("id-ID")}`;
}

/** Short locale-ID date. */
function formatDate(date: Date | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Ledger finality (Req 6.1): only income `not_required` OR expense `approved`.
 * pending / rejected / insufficient_balance are never final.
 * Reversal rows are `income` + `not_required`, so they pass here too.
 */
function isFinalLedgerTransaction(trx: Transaction): boolean {
  if (trx.type === "income" && trx.approvalStatus === "not_required") return true;
  if (trx.type === "expense" && trx.approvalStatus === "approved") return true;
  return false;
}

/**
 * A row is a reversal ONLY when an explicit reversal marker is present
 * (Req 6.2). We never infer from the free-text `reversalReason`.
 */
function isReversal(trx: Transaction): boolean {
  return Boolean(trx.reversalOfTransactionId || trx.reversalOfPaymentId);
}

type LedgerKind = "income" | "expense" | "reversal";

function getLedgerKind(trx: Transaction): LedgerKind {
  if (isReversal(trx)) return "reversal";
  return trx.type === "income" ? "income" : "expense";
}

const KIND_LABEL: Record<LedgerKind, string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  reversal: "Pembalikan",
};

/**
 * Debit/Kredit split. Positive cash movement (uang masuk) is Debit,
 * negative cash movement (uang keluar) is Kredit. A reversal of income
 * carries a negative amount, so it naturally lands in Kredit.
 */
function getDebitKredit(trx: Transaction): { debit: number; kredit: number } {
  const cashDelta = trx.type === "income" ? trx.amount : -trx.amount;
  if (cashDelta > 0) return { debit: cashDelta, kredit: 0 };
  if (cashDelta < 0) return { debit: 0, kredit: -cashDelta };
  return { debit: 0, kredit: 0 };
}

// ---------------------------------------------------------------------------
// Sub-filters (Jenis Transaksi)
// ---------------------------------------------------------------------------

type LedgerSubFilter = "all" | LedgerKind;

const SUB_FILTERS: Array<{ key: LedgerSubFilter; label: string }> = [
  { key: "all", label: "Semua Jenis" },
  { key: "income", label: "Pemasukan" },
  { key: "expense", label: "Pengeluaran" },
  { key: "reversal", label: "Pembalikan" },
];

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

function LedgerKindBadge({ kind }: { kind: LedgerKind }) {
  const IconMap: Record<LedgerKind, React.ElementType> = {
    income: ArrowUpRight,
    expense: ArrowDownRight,
    reversal: Undo2,
  };
  const styles: Record<LedgerKind, string> = {
    income: "bg-emerald-50 text-emerald-700 border border-emerald-200/80",
    expense: "bg-amber-50 text-amber-700 border border-amber-200/80",
    reversal: "bg-rose-50 text-rose-700 border border-rose-200/80",
  };
  const Icon = IconMap[kind];
  return (
    <Badge className={cn("text-[10px] font-semibold", styles[kind])}>
      <Icon className="h-3 w-3 mr-1" aria-hidden="true" />
      {KIND_LABEL[kind]}
    </Badge>
  );
}

function LedgerStatusBadge({
  kind,
}: {
  kind: LedgerKind;
}) {
  // Ledger only carries final transactions, so status is presentational.
  if (kind === "reversal") {
    return (
      <Badge className="bg-rose-50 text-rose-700 border border-rose-200/80 text-[10px] font-semibold">
        Pembalikan
      </Badge>
    );
  }
  if (kind === "expense") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-semibold">
        Disetujui
      </Badge>
    );
  }
  return (
    <Badge className="bg-secondary text-primary border border-primary/20 text-[10px] font-semibold">
      Final
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Referensi Dokumen — route-safe via FinanceDocLink
// ---------------------------------------------------------------------------

function DocumentReference({ trx }: { trx: Transaction }) {
  // Reversal: point to the original transaction it reverses (route-safe).
  if (trx.reversalOfTransactionId) {
    return (
      <FinanceDocLink
        href={`/finance/transactions/${trx.reversalOfTransactionId}`}
        className="text-xs"
      >
        Transaksi Asli
      </FinanceDocLink>
    );
  }

  // Invoice reference when available.
  if (trx.invoiceNumber) {
    return (
      <FinanceDocLink
        href={trx.invoiceId ? `/finance/invoices/${trx.invoiceId}` : undefined}
        className="text-xs"
      >
        {trx.invoiceNumber}
      </FinanceDocLink>
    );
  }

  return <span className="text-muted-foreground/50">—</span>;
}

// ---------------------------------------------------------------------------
// Empty-state filter context
// ---------------------------------------------------------------------------

function buildFilterContext(
  subFilter: LedgerSubFilter,
  accountId: string,
  accounts: Account[],
): string {
  const parts: string[] = ["Buku Kas Ledger"];
  const subLabel = SUB_FILTERS.find((f) => f.key === subFilter)?.label;
  if (subLabel && subFilter !== "all") parts.push(subLabel);
  if (accountId !== "all") {
    const acc = accounts.find((a) => a.id === accountId);
    if (acc) parts.push(acc.name);
  }
  return parts.join(" — ");
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const LEDGER_PAGE_SIZE = 20;

export function TransactionsTab({
  filteredTransactions,
  accounts,
  projects,
  categories,
  expenseForm,
  setExpenseForm,
  errorMsg,
  isSubmitting,
  onCreateExpenseSubmit,
}: TransactionsTabProps) {
  const { t } = useI18n();
  const [subFilter, setSubFilter] = React.useState<LedgerSubFilter>("all");
  const [accountFilter, setAccountFilter] = React.useState<string>("all");
  const [ledgerPage, setLedgerPage] = React.useState(1);

  const accountOptions = React.useMemo(
    () => accounts.filter((a) => a.status === "active"),
    [accounts],
  );

  // Whether a specific account is selected (not "Semua Akun")
  const isAccountSelected = accountFilter !== "all";

  // Selected account object (for openingBalance)
  const selectedAccount = React.useMemo(
    () => (isAccountSelected ? accounts.find((a) => a.id === accountFilter) : undefined),
    [accounts, accountFilter, isAccountSelected],
  );

  // Presentation pipeline:
  // 1) Ledger finality (Req 6.1) — reversal originals are NOT hidden (Req 6.5)
  // 2) Jenis sub-filter
  // 3) Account filter
  const ledgerRows = React.useMemo(() => {
    return filteredTransactions
      .filter(isFinalLedgerTransaction)
      .filter((trx) => {
        if (subFilter === "all") return true;
        return getLedgerKind(trx) === subFilter;
      })
      .filter((trx) => accountFilter === "all" || trx.accountId === accountFilter);
  }, [filteredTransactions, subFilter, accountFilter]);

  // Summary bar totals (only meaningful when account is selected)
  const summaryTotals = React.useMemo(() => {
    if (!isAccountSelected || !selectedAccount) return null;
    let totalDebit = 0;
    let totalKredit = 0;
    for (const trx of ledgerRows) {
      const { debit, kredit } = getDebitKredit(trx);
      totalDebit += debit;
      totalKredit += kredit;
    }
    const saldoAwal = selectedAccount.openingBalance;
    const saldoAkhir = saldoAwal + totalDebit - totalKredit;
    return { saldoAwal, totalDebit, totalKredit, saldoAkhir };
  }, [ledgerRows, isAccountSelected, selectedAccount]);

  // Running balance computation — chronological (oldest first)
  // Sort ledgerRows by transactionDate ascending, compute cumulative balance
  const ledgerRowsWithBalance = React.useMemo(() => {
    if (!isAccountSelected || !selectedAccount) return ledgerRows.map((trx) => ({ ...trx, runningBalance: 0 }));
    // Sort chronologically (oldest first)
    const sorted = [...ledgerRows].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime(),
    );
    let cumBalance = selectedAccount.openingBalance;
    const withBalance = sorted.map((trx) => {
      const { debit, kredit } = getDebitKredit(trx);
      cumBalance = cumBalance + debit - kredit;
      return { ...trx, runningBalance: cumBalance };
    });
    // Reverse for display (newest first)
    withBalance.reverse();
    return withBalance;
  }, [ledgerRows, isAccountSelected, selectedAccount]);

  React.useEffect(() => {
    setLedgerPage(1);
  }, [subFilter, accountFilter]);

  const ledgerTotalPages = Math.max(1, Math.ceil(ledgerRowsWithBalance.length / LEDGER_PAGE_SIZE));
  const safeLedgerPage = Math.min(ledgerPage, ledgerTotalPages);
  const pagedLedgerRows = ledgerRowsWithBalance.slice(
    (safeLedgerPage - 1) * LEDGER_PAGE_SIZE,
    safeLedgerPage * LEDGER_PAGE_SIZE,
  );

  const filterContext = buildFilterContext(subFilter, accountFilter, accounts);

  return (
    <div className="space-y-6">
      {/* ============================ LEDGER (full width) ============================ */}
      <Card className="bg-card border-input">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {t("finance.ledger_title")}
            </CardTitle>
            <CardDescription className="text-xs">
              Transaksi kas final: pemasukan, pengeluaran disetujui, dan pembalikan
            </CardDescription>
          </div>
        </CardHeader>

        {/* Filters: Jenis pills + Akun Kas/Bank select */}
        <div className="flex flex-col gap-3 px-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="flex overflow-x-auto gap-1.5 scrollbar-none"
            role="group"
            aria-label="Filter jenis transaksi"
          >
            {SUB_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setSubFilter(f.key)}
                aria-pressed={subFilter === f.key}
                className={cn(
                  "inline-flex items-center whitespace-nowrap rounded-full px-3.5 py-1 text-xs font-semibold border transition-colors duration-150 min-h-11",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  subFilter === f.key
                    ? "bg-primary text-white border-primary"
                    : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-56">
            <Select
              value={accountFilter}
              onValueChange={(val) => setAccountFilter(val || "all")}
              items={[
                { label: "Semua Akun", value: "all" },
                ...accountOptions.map((a) => ({ label: a.name, value: a.id })),
              ]}
            >
              <SelectTrigger className="bg-muted/30 border-border rounded-xl focus:ring-ring font-semibold text-xs h-9 text-foreground">
                <SelectValue placeholder="Semua Akun">
                  {accountFilter === "all"
                    ? "Semua Akun"
                    : accountOptions.find((a) => a.id === accountFilter)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border-border rounded-xl">
                <SelectItem value="all" className="text-xs font-medium">
                  Semua Akun
                </SelectItem>
                {accountOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs font-medium">
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardContent className="p-0">
          {/* Summary bar — conditional on account selection (Req 6.1–6.3) */}
          {isAccountSelected && summaryTotals ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-4">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Saldo Awal</p>
                <p className="font-mono tabular-nums text-sm font-bold text-foreground mt-0.5">{formatRupiah(summaryTotals.saldoAwal)}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Debit</p>
                <p className="font-mono tabular-nums text-sm font-bold text-emerald-700 mt-0.5">{formatRupiah(summaryTotals.totalDebit)}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Kredit</p>
                <p className="font-mono tabular-nums text-sm font-bold text-rose-700 mt-0.5">{formatRupiah(summaryTotals.totalKredit)}</p>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Saldo Akhir</p>
                <p className="font-mono tabular-nums text-sm font-bold text-primary mt-0.5">{formatRupiah(summaryTotals.saldoAkhir)}</p>
              </div>
            </div>
          ) : (
            <div className="px-4 pb-3">
              <p className="text-xs text-muted-foreground italic">Pilih rekening untuk melihat saldo berjalan.</p>
            </div>
          )}
          <FinanceTableScroll>
          <Table className="min-w-[1280px] table-fixed">
            <TableHeader className="bg-secondary/35">
              <TableRow className="text-xs hover:bg-transparent">
                <TableHead className="h-12 w-[170px] px-5 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Nomor Transaksi</TableHead>
                <TableHead className="h-12 w-[120px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Tanggal</TableHead>
                <TableHead className="h-12 w-[130px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Jenis</TableHead>
                <TableHead className="h-12 w-[150px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Kategori</TableHead>
                <TableHead className="h-12 w-[150px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Akun Kas/Bank</TableHead>
                <TableHead className="h-12 w-[160px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Project</TableHead>
                <TableHead className="h-12 w-[150px] px-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Referensi Dokumen</TableHead>
                <TableHead className="h-12 w-[140px] px-4 text-right text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Debit</TableHead>
                <TableHead className="h-12 w-[140px] px-4 text-right text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Kredit</TableHead>
                {isAccountSelected && (
                  <TableHead className="h-12 w-[150px] px-4 text-right text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Saldo Berjalan</TableHead>
                )}
                <TableHead className="h-12 w-[120px] px-4 text-center text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Status</TableHead>
                <TableHead className="h-12 w-[110px] px-5 text-center text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerRowsWithBalance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAccountSelected ? 12 : 11} className="p-0">
                    <FinanceTableState
                      variant="empty"
                      icon={<BookOpen className="h-6 w-6" />}
                      filterContext={filterContext}
                      title={
                        subFilter === "all"
                          ? "Belum ada transaksi final"
                          : `Tidak ada transaksi untuk jenis "${
                              SUB_FILTERS.find((f) => f.key === subFilter)?.label ??
                              subFilter
                            }"`
                      }
                      description="Buku Kas Ledger hanya menampilkan transaksi final (pemasukan, pengeluaran disetujui, dan pembalikan). Coba ubah filter jenis atau akun."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pagedLedgerRows.map((trx) => {
                  const kind = getLedgerKind(trx);
                  const { debit, kredit } = getDebitKredit(trx);
                  return (
                    <TableRow key={trx.id} className="h-[76px] text-xs hover:bg-secondary/25 transition-colors duration-100">
                      {/* Nomor Transaksi — monospace, link detail */}
                      <TableCell className="px-5 py-4 align-middle">
                        <FinanceDocLink
                          href={`/finance/transactions/${trx.id}`}
                          className="font-mono text-xs font-semibold"
                        >
                          {trx.transactionNumber}
                        </FinanceDocLink>
                      </TableCell>

                      {/* Tanggal */}
                      <TableCell className="px-4 py-4 whitespace-nowrap text-muted-foreground align-middle">
                        {formatDate(trx.transactionDate)}
                      </TableCell>

                      {/* Jenis */}
                      <TableCell className="px-4 py-4 align-middle">
                        <LedgerKindBadge kind={kind} />
                      </TableCell>

                      {/* Kategori */}
                      <TableCell className="px-4 py-4 text-foreground max-w-[140px] align-middle">
                        <span className="block truncate" title={trx.categoryName || undefined}>
                          {trx.categoryName || "—"}
                        </span>
                      </TableCell>

                      {/* Akun Kas/Bank */}
                      <TableCell className="px-4 py-4 text-muted-foreground max-w-[140px] align-middle">
                        <span className="block truncate" title={trx.accountName || undefined}>
                          {trx.accountName || "—"}
                        </span>
                      </TableCell>

                      {/* Project */}
                      <TableCell className="px-4 py-4 text-muted-foreground max-w-[140px] align-middle">
                        <span className="block truncate" title={trx.projectName || undefined}>
                          {trx.projectName || "—"}
                        </span>
                      </TableCell>

                      {/* Referensi Dokumen */}
                      <TableCell className="px-4 py-4 whitespace-nowrap align-middle">
                        <DocumentReference trx={trx} />
                      </TableCell>

                      {/* Debit */}
                      <TableCell className="px-4 py-4 text-right font-mono tabular-nums align-middle">
                        {debit > 0 ? (
                          <span className="text-emerald-700 font-semibold">
                            {formatRupiah(debit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>

                      {/* Kredit */}
                      <TableCell className="px-4 py-4 text-right font-mono tabular-nums align-middle">
                        {kredit > 0 ? (
                          <span className="text-rose-700 font-semibold">
                            {formatRupiah(kredit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>

                      {/* Saldo Berjalan — only when account selected */}
                      {isAccountSelected && (
                        <TableCell className="px-4 py-4 text-right font-mono tabular-nums align-middle">
                          <span className={cn("font-semibold", trx.runningBalance < 0 ? "text-rose-700" : "text-foreground")}>
                            {formatRupiah(trx.runningBalance)}
                          </span>
                        </TableCell>
                      )}

                      {/* Status */}
                      <TableCell className="px-4 py-4 text-center align-middle">
                        <LedgerStatusBadge kind={kind} />
                      </TableCell>

                      {/* Aksi */}
                      <TableCell className="px-5 py-4 text-center align-middle">
                        <FinanceDocLink
                          href={`/finance/transactions/${trx.id}`}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-primary/20 bg-card px-3 text-xs font-semibold text-primary-dark hover:bg-secondary/70"
                          title="Lihat detail transaksi"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          Detail
                        </FinanceDocLink>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </FinanceTableScroll>
          <DataTablePagination
            totalItems={ledgerRowsWithBalance.length}
            itemsPerPage={LEDGER_PAGE_SIZE}
            currentPage={safeLedgerPage}
            onPageChange={setLedgerPage}
            pageParam="ledgerPage"
          />
          <p className="px-6 py-3 text-xs text-muted-foreground">
            Klik nomor transaksi untuk melihat detail.
          </p>
        </CardContent>
      </Card>

      {/* Informasi operasional sekunder disembunyikan secara default agar
          Ledger tetap menjadi layar pembukuan final seperti pada mock. */}
      <details className="rounded-xl border border-border bg-card shadow-sm">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span>Saldo rekening dan pengajuan pengeluaran</span>
          <span className="text-xs font-normal text-muted-foreground">Buka bila diperlukan</span>
        </summary>
        <div className="grid grid-cols-1 gap-6 border-t border-border p-4 lg:grid-cols-3">
        <Card className="bg-white/70 backdrop-blur-md border border-border/80 shadow-sage hover:shadow-sage-lg transition-premium rounded-3xl overflow-hidden lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">{t("finance.balance_title")}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-medium">{t("finance.balance_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3 font-sans">
            {accounts.filter(a => a.status === "active").map(acc => {
              const diff = acc.currentBalance - acc.openingBalance;
              return (
                <div
                  key={acc.id}
                  className="flex justify-between items-center p-3.5 bg-gradient-to-r from-white to-[#F7F8F3] border border-border rounded-2xl hover:border-primary/50 hover:shadow-sage transition-premium duration-300 group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${acc.currentBalance > 0 ? "bg-[#8FAF9A]" : "bg-rose-400"} group-hover:scale-150 transition-premium`} />
                    <div>
                      <p className="text-xs font-bold text-foreground">{acc.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">{acc.code}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={`font-mono font-extrabold text-xs tabular-nums ${acc.currentBalance < 0 ? "text-rose-600" : "text-primary"}`}>
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

        <Card className="bg-card border-input shadow-sage rounded-2xl overflow-hidden hover:shadow-sage-lg transition-premium lg:col-span-2">
          <div className="bg-primary h-1 w-full" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <TrendingDown className="h-4.5 w-4.5 text-[#D77A7A]" />
              {t("finance.expense_title")}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-medium">
              {t("finance.expense_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 font-sans space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 text-[#8B3443] border border-rose-100 rounded-xl text-xs font-semibold animate-shake">
                {errorMsg}
              </div>
            )}

            <form onSubmit={onCreateExpenseSubmit} className="space-y-4">
              {/* Project Selector field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.expense_lbl_project")}</label>
                <Select
                  value={expenseForm.projectId}
                  onValueChange={(val) => setExpenseForm(f => ({ ...f, projectId: val || "" }))}
                  items={projects.map(p => ({ label: p.name, value: p.id }))}
                >
                  <SelectTrigger className="bg-muted/30 border-border rounded-xl focus:ring-ring font-semibold text-xs h-9.5 text-foreground">
                    <SelectValue placeholder={t("finance.expense_lbl_project")}>
                      {expenseForm.projectId ? projects.find(p => p.id === expenseForm.projectId)?.name : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border-border rounded-xl">
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs font-medium">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cash Account & Category Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.expense_lbl_account")}</label>
                  <Select
                    value={expenseForm.accountId}
                    onValueChange={(val) => setExpenseForm(f => ({ ...f, accountId: val || "" }))}
                    items={accounts.map(a => ({ label: a.name, value: a.id }))}
                  >
                    <SelectTrigger className="bg-muted/30 border-border rounded-xl focus:ring-ring font-semibold text-xs h-9.5 text-foreground">
                      <SelectValue placeholder={t("finance.expense_lbl_account")}>
                        {expenseForm.accountId ? accounts.find(a => a.id === expenseForm.accountId)?.name : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border-border rounded-xl">
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id} className="text-xs font-medium">{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.expense_lbl_category")}</label>
                  <Select
                    value={expenseForm.categoryId}
                    onValueChange={(val) => setExpenseForm(f => ({ ...f, categoryId: val || "" }))}
                    items={categories.filter(c => c.type === "expense").map(c => ({ label: c.name, value: c.id }))}
                  >
                    <SelectTrigger className="bg-muted/30 border-border rounded-xl focus:ring-ring font-semibold text-xs h-9.5 text-foreground">
                      <SelectValue placeholder={t("finance.expense_lbl_category")}>
                        {expenseForm.categoryId ? categories.find(c => c.id === expenseForm.categoryId)?.name : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border-border rounded-xl">
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
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.expense_lbl_amount")}</label>
                  <Input
                    type="number"
                    placeholder="Rp 0"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                    className="bg-muted/30 border-border rounded-xl focus-visible:ring-ring font-mono font-bold text-xs h-9.5 text-foreground"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.expense_lbl_method")}</label>
                  <Select
                    value={expenseForm.paymentMethod}
                    onValueChange={(val: any) => setExpenseForm(f => ({ ...f, paymentMethod: val }))}
                    items={[
                      { label: t("finance.payment_method_transfer"), value: "transfer" },
                      { label: t("finance.payment_method_cash"), value: "cash" },
                      { label: t("finance.payment_method_giro"), value: "giro" },
                    ]}
                  >
                    <SelectTrigger className="bg-muted/30 border-border rounded-xl focus:ring-ring font-semibold text-xs h-9.5 text-foreground">
                      <SelectValue placeholder={t("finance.expense_lbl_method")}>
                        {expenseForm.paymentMethod === "transfer" && t("finance.payment_method_transfer")}
                        {expenseForm.paymentMethod === "cash" && t("finance.payment_method_cash")}
                        {expenseForm.paymentMethod === "giro" && t("finance.payment_method_giro")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border-border rounded-xl">
                      <SelectItem value="transfer" className="text-xs font-medium">{t("finance.payment_method_transfer")}</SelectItem>
                      <SelectItem value="cash" className="text-xs font-medium">{t("finance.payment_method_cash")}</SelectItem>
                      <SelectItem value="giro" className="text-xs font-medium">{t("finance.payment_method_giro")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dynamic Readable Amount Live Preview Card */}
              {expenseForm.amount && !isNaN(Number(expenseForm.amount)) && (
                <div className="p-3 bg-secondary/50 border border-primary/30 rounded-xl space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">{t("finance.invoice_format_rupiah")}</span>
                  <span className="font-mono font-extrabold text-sm text-primary tracking-tight tabular-nums">
                    Rp {Number(expenseForm.amount).toLocaleString("id-ID")}
                  </span>
                </div>
              )}

              {/* Description Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t("finance.expense_lbl_notes")}</label>
                <Input
                  placeholder={t("finance.expense_notes_ph")}
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                  className="bg-muted/30 border-border rounded-xl focus-visible:ring-ring font-medium text-xs h-9.5 text-foreground"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white text-xs font-bold h-10 rounded-xl shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium"
                disabled={isSubmitting}
              >
                {isSubmitting ? t("finance.submitting") : t("finance.expense_btn_submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
        </div>
      </details>
    </div>
  );
}
