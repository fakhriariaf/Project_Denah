import { db } from "@/db";
import {
  transactions,
  payments,
  invoices,
  transactionApprovals,
} from "@/db/schema/finance";
import { financeAccounts, financeCategories, projects, units, customers } from "@/db/schema/master";
import { user } from "@/db/schema/auth";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth, getSessionRole } from "@/server/permissions";
import { redirect, notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CircleDollarSign,
  Hash,
  CreditCard,
  Calendar,
  Building2,
  User,
  FileText,
  Wallet,
  Tag,
  AlignLeft,
  ClipboardCheck,
  Link2,
  Undo2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { formatRupiah, formatDate } from "@/lib/format-utils";
import {
  getApprovalStatusLabel,
  getTransactionTypeLabel,
  getPaymentMethodLabel,
} from "@/lib/label-helpers";
import {
  FinanceDetailLayout,
  FinanceDetailGrid,
  FinanceDetailField,
} from "@/components/finance/finance-detail-layout";
import { FinanceDocLink } from "@/components/finance/finance-doc-link";
import { FinanceTimeline } from "@/components/finance/finance-timeline";
import { ReverseButton } from "./reverse-button";

export const revalidate = 0;

const EM_DASH = "\u2014";

/** Approval-status values that require the approval section (everything but not_required). */
function isApprovalRelevant(status: string): boolean {
  return status !== "not_required";
}

/** Ledger approval-status badge via the centralized Bahasa Indonesia helper (Req 7.4, 11.4). */
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

/** Transaction-type badge (income / expense) with a distinct Sage-friendly tone. */
function getTypeBadge(type: string) {
  const label = getTransactionTypeLabel(type);
  if (type === "income") {
    return <Badge className="border-green-300 bg-green-100 text-green-800">{label}</Badge>;
  }
  return <Badge className="border-rose-300 bg-rose-100 text-rose-800">{label}</Badge>;
}

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  // Approver user alias so we can resolve the approver name off approvedBy.
  const approverUser = alias(user, "approver_user");
  // Payment relation alias fields (source-document relation, Req 7.1).
  const linkedPayment = alias(payments, "linked_payment");

  // Fetch the ledger transaction (route id = transactions.id) with relations.
  const [transaction] = await db
    .select({
      id: transactions.id,
      transactionNumber: transactions.transactionNumber,
      projectId: transactions.projectId,
      unitId: transactions.unitId,
      customerId: transactions.customerId,
      paymentId: transactions.paymentId,
      materialRequestId: transactions.materialRequestId,
      kprProcessId: transactions.kprProcessId,
      accountId: transactions.accountId,
      categoryId: transactions.categoryId,
      type: transactions.type,
      description: transactions.description,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
      paymentMethod: transactions.paymentMethod,
      approvalStatus: transactions.approvalStatus,
      approvedBy: transactions.approvedBy,
      approvalNotes: transactions.approvalNotes,
      attachmentId: transactions.attachmentId,
      reversalOfTransactionId: transactions.reversalOfTransactionId,
      reversalReason: transactions.reversalReason,
      createdBy: transactions.createdBy,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      accountName: financeAccounts.name,
      categoryName: financeCategories.name,
      projectName: projects.name,
      unitCode: units.code,
      customerName: customers.name,
      approverName: approverUser.name,
      // Source-document relations.
      paymentNumber: linkedPayment.paymentNumber,
      paymentInvoiceId: linkedPayment.invoiceId,
    })
    .from(transactions)
    .leftJoin(financeAccounts, eq(transactions.accountId, financeAccounts.id))
    .leftJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
    .leftJoin(projects, eq(transactions.projectId, projects.id))
    .leftJoin(units, eq(transactions.unitId, units.id))
    .leftJoin(customers, eq(transactions.customerId, customers.id))
    .leftJoin(approverUser, eq(transactions.approvedBy, approverUser.id))
    .leftJoin(linkedPayment, eq(transactions.paymentId, linkedPayment.id))
    .where(eq(transactions.id, id))
    .limit(1);

  // Not-found for a missing id — with a back-to-tab link via notFound() (Req 1.9).
  if (!transaction) {
    notFound();
  }

  // --- Resolve source-document invoice link (Req 7.1, 7.2) ---
  // Income path: the linked payment's invoice.
  // Expense (shadow) path: the invoice whose notes = `trxId:<transaction.id>`.
  let invoiceLinkId: string | null = null;
  let invoiceLinkNumber: string | null = null;

  if (transaction.paymentInvoiceId) {
    const [inv] = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.id, transaction.paymentInvoiceId))
      .limit(1);
    if (inv) {
      invoiceLinkId = inv.id;
      invoiceLinkNumber = inv.invoiceNumber;
    }
  }

  if (!invoiceLinkId && transaction.type === "expense") {
    const [shadowInv] = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.notes, `trxId:${transaction.id}`))
      .limit(1);
    if (shadowInv) {
      invoiceLinkId = shadowInv.id;
      invoiceLinkNumber = shadowInv.invoiceNumber;
    }
  }

  // Expense-approval lens: this transaction is itself an expense approval when it
  // is an expense with a real approval state (Req 7.1). Links to the approvals view.
  const isExpenseApproval =
    transaction.type === "expense" &&
    ["pending", "approved", "rejected", "insufficient_balance"].includes(
      transaction.approvalStatus,
    );

  // Manual Entry when NO source relation resolves (Req 7.2).
  const hasSourceRelation =
    Boolean(transaction.paymentId) ||
    Boolean(transaction.materialRequestId) ||
    Boolean(transaction.kprProcessId) ||
    Boolean(invoiceLinkId) ||
    isExpenseApproval;
  const isManualEntry = !hasSourceRelation;

  // --- Reversal state (Req 7.5, 7.6) ---
  const isFinalized =
    transaction.approvalStatus === "approved" ||
    transaction.approvalStatus === "not_required";
  const isAdjustment = Boolean(transaction.reversalOfTransactionId);
  const canReverse = isKeuangan || isSuperAdmin;

  // Has this transaction already been reversed? (an adjustment links back to it).
  let existingReversal: { id: string; transactionNumber: string } | null = null;
  {
    const [rev] = await db
      .select({ id: transactions.id, transactionNumber: transactions.transactionNumber })
      .from(transactions)
      .where(eq(transactions.reversalOfTransactionId, transaction.id))
      .limit(1);
    existingReversal = rev ?? null;
  }
  const alreadyReversed = Boolean(existingReversal);

  // A reverse action is offered only for a finalized, not-yet-reversed, non-adjustment entry.
  const showReverse = isFinalized && !alreadyReversed && !isAdjustment && canReverse;

  // --- Approval detail (Req 7.4) — only when approvalStatus != not_required ---
  const approvalRelevant = isApprovalRelevant(transaction.approvalStatus);
  let actedAt: Date | null = null;
  let approverName: string | null = transaction.approverName ?? null;
  let approvalNotes: string | null = transaction.approvalNotes ?? null;
  if (approvalRelevant && (transaction.approvalStatus === "approved" || transaction.approvalStatus === "rejected")) {
    const targetStatus = transaction.approvalStatus === "approved" ? "approved" : "rejected";
    const [approvalRow] = await db
      .select({
        notes: transactionApprovals.notes,
        actedAt: transactionApprovals.actedAt,
        approverName: user.name,
      })
      .from(transactionApprovals)
      .leftJoin(user, eq(transactionApprovals.approverId, user.id))
      .where(
        and(
          eq(transactionApprovals.transactionId, transaction.id),
          eq(transactionApprovals.status, targetStatus),
        ),
      )
      .orderBy(desc(transactionApprovals.createdAt))
      .limit(1);
    approverName = approvalRow?.approverName ?? transaction.approverName ?? null;
    actedAt = approvalRow?.actedAt ?? transaction.updatedAt ?? null;
    approvalNotes = approvalRow?.notes ?? transaction.approvalNotes ?? null;
  }

  // --- Summary cards (Req 2.3) ---
  const summary = (
    <FinanceDetailGrid cols={3}>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardDescription className="text-muted-foreground">Jumlah Transaksi</CardDescription>
          <CardTitle className="font-mono text-2xl tabular-nums text-foreground">
            {formatRupiah(transaction.amount)}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardDescription className="text-muted-foreground">Tanggal Transaksi</CardDescription>
          <CardTitle className="text-lg text-foreground">{formatDate(transaction.transactionDate)}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardDescription className="text-muted-foreground">Jenis Transaksi</CardDescription>
          <div className="pt-1">{getTypeBadge(transaction.type)}</div>
        </CardHeader>
      </Card>
    </FinanceDetailGrid>
  );

  // --- Detail metadata (Req 2.4, 7.1–7.6) ---
  const details = (
    <div className="space-y-6">
      {/* Immutability / reversal notice for finalized entries (Req 7.5, 7.6). */}
      {isFinalized && !isAdjustment && (
        <Card className="border-border bg-[#F7F8F3]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary/70" />
              Entri Final
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {alreadyReversed
                ? "Transaksi final ini sudah dibalik. Data asli tetap tidak berubah; koreksi dilakukan melalui transaksi penyesuaian."
                : "Transaksi final tidak dapat diubah langsung. Koreksi hanya dapat dilakukan melalui pembalikan (reversal) yang membuat transaksi penyesuaian tanpa mengubah data asli."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alreadyReversed && existingReversal && (
              <FinanceDetailField label="Transaksi Penyesuaian (Pembalikan)" icon={<Undo2 className="h-4 w-4" />}>
                <FinanceDocLink href={`/finance/transactions/${existingReversal.id}`}>
                  {existingReversal.transactionNumber}
                </FinanceDocLink>
              </FinanceDetailField>
            )}
            {showReverse && (
              <ReverseButton
                transactionId={transaction.id}
                transactionNumber={transaction.transactionNumber}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Adjustment (reversal) provenance (this row IS an adjustment). */}
      {isAdjustment && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-800">
              <Undo2 className="h-5 w-5" />
              Transaksi Penyesuaian (Pembalikan)
            </CardTitle>
            <CardDescription className="text-amber-700">
              {transaction.reversalReason && transaction.reversalReason.trim() !== ""
                ? transaction.reversalReason
                : "Transaksi ini adalah pembalikan atas transaksi lain."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FinanceDetailField label="Membalik Transaksi" icon={<Undo2 className="h-4 w-4" />}>
              {transaction.reversalOfTransactionId ? (
                <FinanceDocLink href={`/finance/transactions/${transaction.reversalOfTransactionId}`}>
                  Lihat transaksi asli
                </FinanceDocLink>
              ) : (
                <span className="text-foreground">{EM_DASH}</span>
              )}
            </FinanceDetailField>
          </CardContent>
        </Card>
      )}

      {/* Source-document relations (Req 7.1, 7.2). */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <Link2 className="h-5 w-5 text-primary/70" />
            Dokumen Sumber
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Dokumen yang menjadi asal transaksi buku kas ini
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isManualEntry ? (
            <div className="rounded-md border border-dashed border-border bg-[#F7F8F3] px-4 py-6 text-center">
              <FileText className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">Entri Manual</p>
              <p className="text-xs text-muted-foreground">
                Transaksi ini tidak terhubung dengan dokumen sumber lain.
              </p>
            </div>
          ) : (
            <FinanceDetailGrid cols={2}>
              {/* Linked payment (Req 7.1). */}
              <FinanceDetailField label="Pembayaran Terkait" icon={<Wallet className="h-4 w-4" />}>
                {transaction.paymentId && transaction.paymentNumber ? (
                  <FinanceDocLink href={`/finance/payments/${transaction.paymentId}`}>
                    {transaction.paymentNumber}
                  </FinanceDocLink>
                ) : (
                  <span className="text-foreground">{EM_DASH}</span>
                )}
              </FinanceDetailField>

              {/* Linked invoice (Req 7.1). */}
              <FinanceDetailField label="Invoice Terkait" icon={<FileText className="h-4 w-4" />}>
                {invoiceLinkId && invoiceLinkNumber ? (
                  <FinanceDocLink href={`/finance/invoices/${invoiceLinkId}`}>
                    {invoiceLinkNumber}
                  </FinanceDocLink>
                ) : (
                  <span className="text-foreground">{EM_DASH}</span>
                )}
              </FinanceDetailField>

              {/* Linked expense approval (Req 7.1). */}
              <FinanceDetailField label="Persetujuan Kas Keluar" icon={<ClipboardCheck className="h-4 w-4" />}>
                {isExpenseApproval ? (
                  <FinanceDocLink href={`/finance/approvals/${transaction.id}`}>
                    {transaction.transactionNumber}
                  </FinanceDocLink>
                ) : (
                  <span className="text-foreground">{EM_DASH}</span>
                )}
              </FinanceDetailField>
            </FinanceDetailGrid>
          )}
        </CardContent>
      </Card>

      {/* Approval detail — only when approvalStatus != not_required (Req 7.4). */}
      {approvalRelevant && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <ClipboardCheck className="h-5 w-5 text-primary/70" />
              Detail Persetujuan
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Status persetujuan kas keluar untuk transaksi ini
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {getApprovalStatusBadge(transaction.approvalStatus)}
            </div>
            <FinanceDetailGrid cols={2}>
              <FinanceDetailField
                label="Disetujui / Ditolak Oleh"
                icon={<User className="h-4 w-4" />}
                value={approverName}
              />
              <FinanceDetailField
                label="Waktu Tindakan"
                icon={<Calendar className="h-4 w-4" />}
                value={actedAt ? formatDate(actedAt) : null}
              />
            </FinanceDetailGrid>
            <FinanceDetailField
              label="Catatan Persetujuan"
              icon={<AlignLeft className="h-4 w-4" />}
              value={approvalNotes}
            />
          </CardContent>
        </Card>
      )}

      {/* Ledger metadata (Req 7.3). */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Detail Transaksi</CardTitle>
          <CardDescription className="text-muted-foreground">
            Informasi lengkap transaksi buku kas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinanceDetailGrid cols={2}>
            <div className="space-y-3">
              <FinanceDetailField
                label="Nomor Transaksi"
                icon={<Hash className="h-4 w-4" />}
                value={transaction.transactionNumber}
                mono
              />
              <FinanceDetailField
                label="Jumlah"
                icon={<Wallet className="h-4 w-4" />}
                value={formatRupiah(transaction.amount)}
                money
              />
              <FinanceDetailField
                label="Jenis"
                icon={<CircleDollarSign className="h-4 w-4" />}
                value={getTransactionTypeLabel(transaction.type)}
              />
              <FinanceDetailField
                label="Metode Pembayaran"
                icon={<CreditCard className="h-4 w-4" />}
                value={getPaymentMethodLabel(transaction.paymentMethod)}
              />
              <FinanceDetailField
                label="Tanggal Transaksi"
                icon={<Calendar className="h-4 w-4" />}
                value={formatDate(transaction.transactionDate)}
              />
              <FinanceDetailField
                label="Tanggal Dibuat"
                icon={<Calendar className="h-4 w-4" />}
                value={formatDate(transaction.createdAt)}
              />
            </div>
            <div className="space-y-3">
              {/* Account / category / project / unit / customer — dash when null (Req 7.3). */}
              <FinanceDetailField
                label="Akun"
                icon={<Wallet className="h-4 w-4" />}
                value={transaction.accountName}
              />
              <FinanceDetailField
                label="Kategori"
                icon={<Tag className="h-4 w-4" />}
                value={transaction.categoryName}
              />
              <FinanceDetailField
                label="Proyek"
                icon={<Building2 className="h-4 w-4" />}
                value={transaction.projectName}
              />
              <FinanceDetailField
                label="Unit / Kavling"
                icon={<Building2 className="h-4 w-4" />}
                value={transaction.unitCode}
                mono
              />
              <FinanceDetailField
                label="Pelanggan"
                icon={<User className="h-4 w-4" />}
                value={transaction.customerName}
              />
            </div>
          </FinanceDetailGrid>

          <div className="mt-6">
            <FinanceDetailField
              label="Deskripsi"
              icon={<AlignLeft className="h-4 w-4" />}
              value={transaction.description}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <FinanceDetailLayout
      docNumber={transaction.transactionNumber}
      icon={<CircleDollarSign className="h-6 w-6" />}
      statusBadge={getTypeBadge(transaction.type)}
      projectName={transaction.projectName}
      descriptionExtra={
        approvalRelevant ? getApprovalStatusBadge(transaction.approvalStatus) : null
      }
      backHref="/finance?tab=transactions"
      summary={summary}
      details={details}
      timeline={<FinanceTimeline entityType="transaction" entityId={id} />}
    />
  );
}
