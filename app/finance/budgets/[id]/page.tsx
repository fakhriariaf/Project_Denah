import { db } from "@/db";
import { transactions, budgets, budgetLines } from "@/db/schema/finance";
import { financeCategories, projects } from "@/db/schema/master";
import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { requireAuth, getSessionRole } from "@/server/permissions";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Wallet,
  Calendar,
  Building2,
  PieChart,
  Layers,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatRupiah, formatDate } from "@/lib/format-utils";
import {
  getBudgetStatusLabel,
  getTransactionTypeLabel,
  getApprovalStatusLabel,
} from "@/lib/label-helpers";
import {
  FinanceDetailLayout,
  FinanceDetailGrid,
  FinanceDetailField,
} from "@/components/finance/finance-detail-layout";
import { FinanceDocLink } from "@/components/finance/finance-doc-link";
import { FinanceTimeline } from "@/components/finance/finance-timeline";
import { BudgetUsageIndicator } from "@/components/finance/budget-usage-indicator";
import { computeBudgetTotals } from "@/lib/finance-budget-summary";

export const revalidate = 0;

const EM_DASH = "\u2014";

/** Max related transactions shown per page (Req 9.2). */
const PAGE_SIZE = 50;

/** Budget status badge via the centralized Bahasa Indonesia helper (Req 2.12, 11.4). */
function getBudgetStatusBadge(status: string) {
  const label = getBudgetStatusLabel(status);
  switch (status) {
    case "active":
      return <Badge className="border-green-300 bg-green-100 text-green-800">{label}</Badge>;
    case "draft":
      return <Badge className="border-slate-300 bg-slate-100 text-slate-700">{label}</Badge>;
    case "closed":
      return <Badge className="border-amber-300 bg-amber-100 text-amber-800">{label}</Badge>;
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}

/** Transaction type badge (income / expense) for the related-transactions table. */
function getTypeBadge(type: string) {
  const label = getTransactionTypeLabel(type);
  if (type === "income") {
    return <Badge className="border-green-300 bg-green-100 text-green-800">{label}</Badge>;
  }
  return <Badge className="border-rose-300 bg-rose-100 text-rose-800">{label}</Badge>;
}

/** Approval-status badge for the related-transactions table. */
function getApprovalStatusBadge(status: string) {
  const label = getApprovalStatusLabel(status);
  switch (status) {
    case "approved":
      return <Badge className="border-green-300 bg-green-100 text-green-800">{label}</Badge>;
    case "not_required":
      return <Badge className="border-slate-300 bg-slate-100 text-slate-700">{label}</Badge>;
    case "pending":
      return <Badge className="border-amber-300 bg-amber-100 text-amber-800">{label}</Badge>;
    case "rejected":
      return <Badge className="border-red-300 bg-red-100 text-red-800">{label}</Badge>;
    case "insufficient_balance":
      return <Badge className="border-orange-300 bg-orange-100 text-orange-800">{label}</Badge>;
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}

export default async function BudgetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;

  // Auth (Req 10.5): requireAuth redirects unauthenticated users to
  // /login?reason=session-expired&callbackUrl=... — reuse it as-is.
  const activeUser = await requireAuth();
  const { isSuperAdmin, isKeuangan, isDireksi, isAdminKantor } = await getSessionRole(
    activeUser.id,
  );

  // Read gate (Req 10.6) — preserve isAdminKantor view access.
  const hasReadAccess = isSuperAdmin || isKeuangan || isDireksi || isAdminKantor;
  if (!hasReadAccess) {
    redirect("/unauthorized");
  }

  // Fetch the budget (route id = budgets.id) joined to its project.
  const [budget] = await db
    .select({
      id: budgets.id,
      projectId: budgets.projectId,
      name: budgets.name,
      periodStart: budgets.periodStart,
      periodEnd: budgets.periodEnd,
      totalAmount: budgets.totalAmount,
      status: budgets.status,
      createdAt: budgets.createdAt,
      projectName: projects.name,
    })
    .from(budgets)
    .leftJoin(projects, eq(budgets.projectId, projects.id))
    .where(eq(budgets.id, id))
    .limit(1);

  // Not-found for a missing id — with a back-to-tab link via notFound() (Req 1.9).
  if (!budget) {
    notFound();
  }

  // Category allocation lines joined to finance categories for names (Req 9.1).
  const lines = await db
    .select({
      id: budgetLines.id,
      categoryId: budgetLines.categoryId,
      categoryName: financeCategories.name,
      allocatedAmount: budgetLines.allocatedAmount,
      usedAmount: budgetLines.usedAmount,
      remainingAmount: budgetLines.remainingAmount,
    })
    .from(budgetLines)
    .leftJoin(financeCategories, eq(budgetLines.categoryId, financeCategories.id))
    .where(eq(budgetLines.budgetId, id))
    .orderBy(asc(financeCategories.name));

  // Category ids that this budget allocates — related transactions are matched
  // against these plus the budget's project (Req 9.2).
  const categoryIds = lines.map((l) => l.categoryId).filter((c): c is string => Boolean(c));

  const periodEndInclusive = new Date(budget.periodEnd);
  periodEndInclusive.setHours(23, 59, 59, 999);

  const relatedTransactionWhereClause =
    categoryIds.length > 0
      ? and(
          eq(transactions.projectId, budget.projectId),
          inArray(transactions.categoryId, categoryIds),
          eq(transactions.type, "expense"),
          eq(transactions.approvalStatus, "approved"),
          gte(transactions.transactionDate, budget.periodStart),
          lte(transactions.transactionDate, periodEndInclusive),
        )
      : undefined;

  const usageRows = relatedTransactionWhereClause
    ? await db
        .select({
          categoryId: transactions.categoryId,
          usedAmount: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(relatedTransactionWhereClause)
        .groupBy(transactions.categoryId)
    : [];

  const liveUsageByCategory = new Map(
    usageRows.map((row) => [row.categoryId, Number(row.usedAmount) || 0]),
  );

  const displayLines = lines.map((line) => {
    const usedAmount = liveUsageByCategory.get(line.categoryId) ?? 0;

    return {
      ...line,
      usedAmount,
      remainingAmount: line.allocatedAmount - usedAmount,
    };
  });

  // Overall totals from the display allocation lines (Req 10.1, 10.2) via the
  // pure summary helper — "totalUsed" here is the live Realisasi Aktual sourced
  // from approved expense transactions (category + project + period), never the
  // paginated page slice. tabular-nums applied in cells.
  const { totalAllocated, totalUsed, totalRemaining } = computeBudgetTotals(displayLines);

  // Persisted allocation usage (budget_lines.usedAmount) kept for source
  // comparison — the UI labels the number source explicitly when the persisted
  // figure differs from the live Realisasi Aktual, without mutating any data
  // (design 5.5). `lines` still carries the persisted usedAmount before the
  // liveUsageByCategory override applied in displayLines.
  const totalUsedPersisted = lines.reduce((sum, line) => sum + (line.usedAmount ?? 0), 0);
  const persistedDiffersFromActual = totalUsedPersisted !== totalUsed;

  // --- Pagination for related transactions (Req 9.2) ---
  const requestedPage = Number.parseInt(pageParam ?? "1", 10);
  const safePage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let relatedTransactions: Array<{
    id: string;
    transactionNumber: string;
    type: string;
    amount: number;
    transactionDate: Date;
    approvalStatus: string;
    categoryName: string | null;
  }> = [];
  let totalTransactions = 0;

  if (relatedTransactionWhereClause) {
    const [countRow] = await db
      .select({ totalCount: count() })
      .from(transactions)
      .where(relatedTransactionWhereClause);
    totalTransactions = countRow?.totalCount ?? 0;

    relatedTransactions = await db
      .select({
        id: transactions.id,
        transactionNumber: transactions.transactionNumber,
        type: transactions.type,
        amount: transactions.amount,
        transactionDate: transactions.transactionDate,
        approvalStatus: transactions.approvalStatus,
        categoryName: financeCategories.name,
      })
      .from(transactions)
      .leftJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
      .where(relatedTransactionWhereClause)
      .orderBy(desc(transactions.transactionDate))
      .limit(PAGE_SIZE)
      .offset((safePage - 1) * PAGE_SIZE);
  }

  const totalPages = Math.max(1, Math.ceil(totalTransactions / PAGE_SIZE));
  const currentPage = Math.min(safePage, totalPages);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const pageHref = (p: number) => `/finance/budgets/${id}?page=${p}`;

  // --- Summary: Total Anggaran, Terpakai Aktual, Sisa + progress serapan
  // (Req 10.1). "Terpakai Aktual" is the live approved-expense total; when it
  // differs from the persisted budget_lines figure the source is stated
  // explicitly (design 5.5) so users know which number they are reading. ---
  const summary = (
    <div className="space-y-4">
      <FinanceDetailGrid cols={3}>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">Total Anggaran</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums text-foreground">
              {formatRupiah(budget.totalAmount)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">Terpakai Aktual</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums text-foreground">
              {formatRupiah(totalUsed)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Realisasi dari pengeluaran disetujui
            </p>
          </CardHeader>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">Sisa Anggaran</CardDescription>
            <CardTitle
              className={`font-mono text-2xl tabular-nums ${
                totalRemaining < 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {totalRemaining < 0 ? "-" : ""}
              {formatRupiah(Math.abs(totalRemaining))}
            </CardTitle>
          </CardHeader>
        </Card>
      </FinanceDetailGrid>

      {/* Progress serapan (Req 10.1) — over-budget capped at 100% visual +
          badge via BudgetUsageIndicator. Total Anggaran is the budget cap. */}
      <Card className="border-border">
        <CardContent className="pt-6">
          <BudgetUsageIndicator
            totalBudget={budget.totalAmount}
            usedAmount={totalUsed}
            label="Serapan Anggaran"
          />
          {persistedDiffersFromActual && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-[#8A6D1D]">
              Angka tersimpan pada baris anggaran (
              <span className="font-mono tabular-nums">{formatRupiah(totalUsedPersisted)}</span>)
              berbeda dari Realisasi Aktual (
              <span className="font-mono tabular-nums">{formatRupiah(totalUsed)}</span>). Nilai yang
              ditampilkan adalah Realisasi Aktual dari transaksi pengeluaran disetujui.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // --- Detail metadata (Req 2.4, 9.1, 9.2, 9.3) ---
  const details = (
    <div className="space-y-6">
      {/* Budget metadata — project + period (Req 9.1). */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Detail Anggaran</CardTitle>
          <CardDescription className="text-muted-foreground">
            Informasi proyek dan periode anggaran
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinanceDetailGrid cols={2}>
            <div className="space-y-3">
              <FinanceDetailField
                label="Nama Anggaran"
                icon={<Wallet className="h-4 w-4" />}
                value={budget.name}
              />
              <FinanceDetailField
                label="Proyek"
                icon={<Building2 className="h-4 w-4" />}
                value={budget.projectName}
              />
            </div>
            <div className="space-y-3">
              <FinanceDetailField
                label="Periode Mulai"
                icon={<Calendar className="h-4 w-4" />}
                value={formatDate(budget.periodStart)}
              />
              <FinanceDetailField
                label="Periode Selesai"
                icon={<Calendar className="h-4 w-4" />}
                value={formatDate(budget.periodEnd)}
              />
            </div>
          </FinanceDetailGrid>
        </CardContent>
      </Card>

      {/* Category allocation table (Req 9.1). */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <PieChart className="h-5 w-5 text-primary/70" />
            Alokasi Kategori
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Alokasi, penggunaan, dan sisa anggaran per kategori
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-[#F7F8F3] px-4 py-6 text-center">
              <Layers className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">Belum ada alokasi kategori</p>
              <p className="text-xs text-muted-foreground">
                Anggaran ini belum memiliki baris alokasi kategori.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="py-2 pr-4">Kategori</th>
                    <th className="py-2 px-4 text-right">Alokasi</th>
                    <th className="py-2 px-4 text-right">Terpakai</th>
                    <th className="py-2 pl-4 text-right">Sisa</th>
                  </tr>
                </thead>
                <tbody>
                  {displayLines.map((line) => (
                    <tr key={line.id} className="border-b border-border/60">
                      <td className="py-2 pr-4 text-foreground">{line.categoryName ?? EM_DASH}</td>
                      <td className="py-2 px-4 text-right font-mono tabular-nums text-foreground">
                        {formatRupiah(line.allocatedAmount)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono tabular-nums text-foreground">
                        {formatRupiah(line.usedAmount)}
                      </td>
                      <td className="py-2 pl-4 text-right font-mono tabular-nums text-foreground">
                        {formatRupiah(line.remainingAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-2 pr-4 text-foreground">Total Keseluruhan</td>
                    <td className="py-2 px-4 text-right font-mono tabular-nums text-foreground">
                      {formatRupiah(totalAllocated)}
                    </td>
                    <td className="py-2 px-4 text-right font-mono tabular-nums text-foreground">
                      {formatRupiah(totalUsed)}
                    </td>
                    <td className="py-2 pl-4 text-right font-mono tabular-nums text-foreground">
                      {formatRupiah(totalRemaining)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Related transactions with pagination (Req 9.2, 9.3). */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <Receipt className="h-5 w-5 text-primary/70" />
            Transaksi Terkait
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Transaksi buku kas yang terkait dengan kategori anggaran ini
          </CardDescription>
        </CardHeader>
        <CardContent>
          {relatedTransactions.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-[#F7F8F3] px-4 py-6 text-center">
              <Receipt className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">Belum ada transaksi</p>
              <p className="text-xs text-muted-foreground">
                Belum ada transaksi yang tercatat untuk anggaran ini.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                      <th className="py-2 pr-4">Nomor Transaksi</th>
                      <th className="py-2 px-4">Tanggal</th>
                      <th className="py-2 px-4">Kategori</th>
                      <th className="py-2 px-4">Jenis</th>
                      <th className="py-2 px-4">Status</th>
                      <th className="py-2 pl-4 text-right">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedTransactions.map((trx) => (
                      <tr key={trx.id} className="border-b border-border/60">
                        <td className="py-2 pr-4">
                          <FinanceDocLink href={`/finance/transactions/${trx.id}`}>
                            {trx.transactionNumber}
                          </FinanceDocLink>
                        </td>
                        <td className="py-2 px-4 text-foreground">{formatDate(trx.transactionDate)}</td>
                        <td className="py-2 px-4 text-foreground">{trx.categoryName ?? EM_DASH}</td>
                        <td className="py-2 px-4">{getTypeBadge(trx.type)}</td>
                        <td className="py-2 px-4">{getApprovalStatusBadge(trx.approvalStatus)}</td>
                        <td className="py-2 pl-4 text-right font-mono tabular-nums text-foreground">
                          {formatRupiah(trx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls (Req 9.2) — server-side via ?page= searchParam. */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  Halaman {currentPage} dari {totalPages} · {totalTransactions} transaksi
                </p>
                <div className="flex items-center gap-2">
                  {hasPrev ? (
                    <Link href={pageHref(currentPage - 1)}>
                      <Button variant="outline" size="sm" className="gap-1">
                        <ChevronLeft className="h-4 w-4" />
                        Sebelumnya
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-1" disabled>
                      <ChevronLeft className="h-4 w-4" />
                      Sebelumnya
                    </Button>
                  )}
                  {hasNext ? (
                    <Link href={pageHref(currentPage + 1)}>
                      <Button variant="outline" size="sm" className="gap-1">
                        Berikutnya
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-1" disabled>
                      Berikutnya
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <FinanceDetailLayout
      docNumber={budget.name}
      icon={<Wallet className="h-6 w-6" />}
      statusBadge={getBudgetStatusBadge(budget.status)}
      projectName={budget.projectName}
      backHref="/finance?tab=budgets"
      summary={summary}
      details={details}
      timeline={<FinanceTimeline entityType="budget" entityId={id} />}
    />
  );
}
