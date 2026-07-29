import { db } from "@/db";
import {
  transactions,
  transactionApprovals,
  financeActivityHistory,
  invoices,
} from "@/db/schema/finance";
import { financeAccounts, financeCategories, projects } from "@/db/schema/master";
import { attachments } from "@/db/schema/system";
import { user } from "@/db/schema/auth";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq } from "drizzle-orm";
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
  ClipboardCheck,
  Hash,
  CreditCard,
  Calendar,
  Building2,
  User,
  FileText,
  Wallet,
  Tag,
  AlignLeft,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  BadgeCheck,
  StickyNote,
  CircleDollarSign,
  Receipt,
} from "lucide-react";
import { formatDate } from "@/lib/format-utils";
import {
  getApprovalStatusLabel,
  getPaymentMethodLabel,
} from "@/lib/label-helpers";
import {
  FinanceDetailLayout,
  FinanceDetailGrid,
  FinanceDetailField,
} from "@/components/finance/finance-detail-layout";
import { FinanceDocLink } from "@/components/finance/finance-doc-link";
import { FinanceTimeline } from "@/components/finance/finance-timeline";
import { RevisionButton } from "./revision-button";

export const revalidate = 0;

const EM_DASH = "\u2014";

/**
 * Format a monetary value with exactly 2 decimal places and Indonesian grouping
 * (Req 8.1). The shared `formatRupiah` uses 0 fraction digits, so this page
 * defines its own 2-decimal formatter for the requested amount.
 */
function formatRupiah2(val: number | null | undefined): string {
  if (val === null || val === undefined) return "Rp 0,00";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

/** Expense-approval status badge via the centralized Bahasa Indonesia helper (Req 8.2, 11.4). */
function getApprovalStatusBadge(status: string) {
  const label = getApprovalStatusLabel(status);
  switch (status) {
    case "approved":
      return <Badge className="border-green-300 bg-green-100 text-green-800">{label}</Badge>;
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

export default async function ApprovalDetailPage({
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

  // Approver user alias (join user twice: requester = createdBy, approver = approvedBy).
  const requesterUser = alias(user, "requester_user");
  const approverUser = alias(user, "approver_user");

  // Fetch the expense-approval transaction (route id = transactions.id, NEVER
  // transaction_approvals.id — design decision #3) with its relations.
  const [transaction] = await db
    .select({
      id: transactions.id,
      transactionNumber: transactions.transactionNumber,
      projectId: transactions.projectId,
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
      createdBy: transactions.createdBy,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      accountName: financeAccounts.name,
      categoryName: financeCategories.name,
      projectName: projects.name,
      requesterName: requesterUser.name,
      approverName: approverUser.name,
      attachmentFileName: attachments.fileName,
      attachmentFileUrl: attachments.fileUrl,
    })
    .from(transactions)
    .leftJoin(financeAccounts, eq(transactions.accountId, financeAccounts.id))
    .leftJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
    .leftJoin(projects, eq(transactions.projectId, projects.id))
    .leftJoin(requesterUser, eq(transactions.createdBy, requesterUser.id))
    .leftJoin(approverUser, eq(transactions.approvedBy, approverUser.id))
    .leftJoin(attachments, eq(transactions.attachmentId, attachments.id))
    .where(eq(transactions.id, id))
    .limit(1);

  // Not-found for a missing id OR a non-expense row (approvals are expense-type
  // only) — no data from other records is exposed (Req 8.6, 1.9).
  if (!transaction || transaction.type !== "expense") {
    notFound();
  }

  const isApproved = transaction.approvalStatus === "approved";
  const isRejected = transaction.approvalStatus === "rejected";
  const canRevise = isKeuangan || isSuperAdmin; // Req 8.3 mutation-visibility gate.

  // Approver / rejector name + timestamp per action, preferring transaction_approvals
  // (the per-action child audit log) and falling back to transaction.approvedBy /
  // approvalNotes / updatedAt (design "Approval detail" notes).
  let actorName: string | null = null;
  let actedAt: Date | null = null;
  let actionNotes: string | null = null;

  if (isApproved || isRejected) {
    const targetStatus = isApproved ? "approved" : "rejected";
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

    actorName = approvalRow?.approverName ?? transaction.approverName ?? null;
    actedAt = approvalRow?.actedAt ?? transaction.updatedAt ?? null;
    actionNotes = approvalRow?.notes ?? transaction.approvalNotes ?? null;
  }

  // Latest rejection reason from finance_activity_history (preferred source for
  // the revision dialog + inline notice), falling back to the action notes above.
  let rejectionReason: string | null = null;
  if (isRejected) {
    const [rejectedRow] = await db
      .select({ reason: financeActivityHistory.reason })
      .from(financeActivityHistory)
      .where(
        and(
          eq(financeActivityHistory.entityType, "approval"),
          eq(financeActivityHistory.entityId, id),
          eq(financeActivityHistory.action, "rejected"),
        ),
      )
      .orderBy(desc(financeActivityHistory.createdAt))
      .limit(1);
    rejectionReason = rejectedRow?.reason ?? actionNotes ?? null;
  }

  // --- Related documents (Req 8.2, 8.3, 13.1, 13.2, 13.3) ---
  // Ledger transaction: an expense approval only becomes a final ledger entry
  // once it is approved (Req 6.1). While approved, the SAME transactions.id row
  // is the ledger transaction, so its detail route is route-safe. For any other
  // status the ledger entry does not exist yet → render plain text, no link.
  const ledgerTransactionId = isApproved ? transaction.id : null;

  // Internal expense invoice (read-only, additive): the shadow invoice is linked
  // via invoices.notes = `trxId:<transactions.id>`. When present it enriches the
  // related documents; when absent nothing is rendered for it (no broken link).
  let internalInvoiceId: string | null = null;
  let internalInvoiceNumber: string | null = null;
  {
    const [internalInvoice] = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.notes, `trxId:${transaction.id}`))
      .limit(1);
    if (internalInvoice) {
      internalInvoiceId = internalInvoice.id;
      internalInvoiceNumber = internalInvoice.invoiceNumber;
    }
  }

  // Fetch account + expense-category options for the revision dialog selects
  // (only when a revision could actually be initiated).
  let accountOptions: Array<{ value: string; label: string }> = [];
  let categoryOptions: Array<{ value: string; label: string }> = [];
  if (isRejected && canRevise) {
    const accountRows = await db
      .select({ id: financeAccounts.id, name: financeAccounts.name })
      .from(financeAccounts)
      .where(eq(financeAccounts.status, "active"))
      .orderBy(asc(financeAccounts.name));
    accountOptions = accountRows.map((a) => ({ value: a.id, label: a.name }));

    const categoryRows = await db
      .select({ id: financeCategories.id, name: financeCategories.name })
      .from(financeCategories)
      .where(
        and(
          eq(financeCategories.status, "active"),
          eq(financeCategories.type, "expense"),
        ),
      )
      .orderBy(asc(financeCategories.name));
    categoryOptions = categoryRows.map((c) => ({ value: c.id, label: c.name }));
  }

  const hasAttachment = Boolean(transaction.attachmentFileUrl);

  // Catatan approval/penolakan untuk baris metadata (Req 8.1). Preferensi:
  // alasan penolakan (rejected) → catatan aksi (approved) → approvalNotes mentah.
  const metadataNotes = isRejected
    ? rejectionReason
    : isApproved
      ? actionNotes
      : transaction.approvalNotes;

  // --- Summary cards (Req 2.3, 8.1) ---
  const summary = (
    <FinanceDetailGrid cols={3}>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardDescription className="text-muted-foreground">Jumlah Diajukan</CardDescription>
          <CardTitle className="font-mono text-2xl tabular-nums text-foreground">
            {formatRupiah2(transaction.amount)}
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
          <CardDescription className="text-muted-foreground">Status Persetujuan</CardDescription>
          <div className="pt-1">{getApprovalStatusBadge(transaction.approvalStatus)}</div>
        </CardHeader>
      </Card>
    </FinanceDetailGrid>
  );

  // --- Detail metadata (Req 2.4, 8.1, 8.2) ---
  const details = (
    <div className="space-y-6">
      {/* Approval notice (approved) — notes + approver + timestamp (Req 8.2). */}
      {isApproved && (
        <Card className="border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-green-800">
              <CheckCircle2 className="h-5 w-5" />
              Pengajuan Disetujui
            </CardTitle>
            <CardDescription className="text-green-700">
              {actionNotes && actionNotes.trim() !== "" ? actionNotes : EM_DASH}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FinanceDetailGrid cols={2}>
              <FinanceDetailField
                label="Disetujui Oleh"
                icon={<User className="h-4 w-4" />}
                value={actorName}
              />
              <FinanceDetailField
                label="Waktu Persetujuan"
                icon={<Calendar className="h-4 w-4" />}
                value={actedAt ? formatDate(actedAt) : null}
              />
            </FinanceDetailGrid>
          </CardContent>
        </Card>
      )}

      {/* Rejection notice + revision trigger (Req 8.2, 8.3). */}
      {isRejected && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-800">
              <AlertTriangle className="h-5 w-5" />
              Pengajuan Ditolak
            </CardTitle>
            <CardDescription className="text-red-700">
              {rejectionReason && rejectionReason.trim() !== ""
                ? rejectionReason
                : "Alasan penolakan tidak tercatat pada timeline finance."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FinanceDetailGrid cols={2}>
              <FinanceDetailField
                label="Ditolak Oleh"
                icon={<User className="h-4 w-4" />}
                value={actorName}
              />
              <FinanceDetailField
                label="Waktu Penolakan"
                icon={<Calendar className="h-4 w-4" />}
                value={actedAt ? formatDate(actedAt) : null}
              />
            </FinanceDetailGrid>
            {canRevise && (
              <RevisionButton
                transactionId={transaction.id}
                rejectionReason={rejectionReason}
                transactionNumber={transaction.transactionNumber}
                createdAt={formatDate(transaction.createdAt)}
                initialValues={{
                  amount: String(transaction.amount ?? ""),
                  accountId: transaction.accountId ?? "",
                  categoryId: transaction.categoryId ?? "",
                  description: transaction.description ?? "",
                  attachmentId: transaction.attachmentId ?? "",
                }}
                accountOptions={accountOptions}
                categoryOptions={categoryOptions}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Detail Pengajuan Pengeluaran</CardTitle>
          <CardDescription className="text-muted-foreground">
            Informasi lengkap pengajuan pengeluaran kas
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
                label="Jumlah Diajukan"
                icon={<Wallet className="h-4 w-4" />}
                value={formatRupiah2(transaction.amount)}
                money
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
                label="Pemohon"
                icon={<User className="h-4 w-4" />}
                value={transaction.requesterName}
              />
              <FinanceDetailField
                label="Status Persetujuan"
                icon={<BadgeCheck className="h-4 w-4" />}
              >
                {getApprovalStatusBadge(transaction.approvalStatus)}
              </FinanceDetailField>
            </div>
          </FinanceDetailGrid>

          <div className="mt-6 space-y-3">
            <FinanceDetailField
              label="Deskripsi"
              icon={<AlignLeft className="h-4 w-4" />}
              value={transaction.description}
            />
            <FinanceDetailField
              label="Catatan Approval / Penolakan"
              icon={<StickyNote className="h-4 w-4" />}
              value={metadataNotes}
            />
          </div>
        </CardContent>
      </Card>

      {/* Attachment (Req 2.4) */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <FileText className="h-5 w-5 text-primary/70" />
            Lampiran
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Dokumen pendukung pengajuan pengeluaran
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasAttachment || !transaction.attachmentFileUrl ? (
            <span className="text-sm text-muted-foreground">{EM_DASH}</span>
          ) : (
            <a
              href={transaction.attachmentFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-[#F7F8F3] px-4 py-3 text-sm font-medium text-[#4F6F52] hover:text-[#3D563F] hover:underline"
            >
              <FileText className="h-4 w-4" />
              {transaction.attachmentFileName ?? "Lihat Lampiran"}
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // --- Dokumen Terkait (Req 8.2, 8.3, 13.1, 13.2, 13.3) ---
  // Ledger transaction: Finance_Doc_Link bila approved (route aman), teks biasa
  // monospace bila belum di-posting ke ledger. Invoice internal ditautkan bila
  // shadow invoice tersedia. Section tetap opt-in dengan empty state jelas.
  const relatedDocuments = (
    <div className="space-y-3">
      <Card className="border-border">
        <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4">
          <div className="flex items-start gap-3">
            <CircleDollarSign className="mt-0.5 h-5 w-5 text-primary/70" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Transaksi Ledger</p>
              {ledgerTransactionId ? (
                <FinanceDocLink href={`/finance/transactions/${ledgerTransactionId}`}>
                  {transaction.transactionNumber}
                </FinanceDocLink>
              ) : (
                <>
                  <span className="font-mono text-sm text-foreground">
                    {transaction.transactionNumber}
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Belum tercatat di buku kas ledger. Transaksi final tersedia
                    setelah pengajuan disetujui.
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {internalInvoiceId && (
        <Card className="border-border">
          <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4">
            <div className="flex items-start gap-3">
              <Receipt className="mt-0.5 h-5 w-5 text-primary/70" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  Invoice Pengeluaran Internal
                </p>
                <FinanceDocLink href={`/finance/invoices/${internalInvoiceId}`}>
                  {internalInvoiceNumber ?? EM_DASH}
                </FinanceDocLink>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <FinanceDetailLayout
      docNumber={transaction.transactionNumber}
      icon={<ClipboardCheck className="h-6 w-6" />}
      statusBadge={getApprovalStatusBadge(transaction.approvalStatus)}
      projectName={transaction.projectName}
      backHref="/finance?tab=approvals"
      summary={summary}
      details={details}
      relatedDocuments={relatedDocuments}
      relatedEmptyState="Belum ada transaksi ledger atau invoice internal yang terkait dengan pengajuan ini."
      timeline={<FinanceTimeline entityType="approval" entityId={id} />}
    />
  );
}
