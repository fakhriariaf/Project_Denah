import { db } from "@/db";
import { invoices, payments, transactions } from "@/db/schema/finance";
import { projects, units, customers } from "@/db/schema/master";
import { bookings } from "@/db/schema/marketing";
import { attachments } from "@/db/schema/system";
import { and, eq, desc } from "drizzle-orm";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Printer,
  Calendar,
  Building2,
  User,
  CreditCard,
  Hash,
  Receipt,
  ClipboardCheck,
  Ticket,
  ExternalLink,
} from "lucide-react";
import { formatRupiah, formatDate } from "@/lib/format-utils";
import {
  getInvoiceStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  invoiceScheduleLabel,
} from "@/lib/label-helpers";
import {
  computeInvoicePaymentSummary,
  getInvoiceDocumentContext,
} from "@/lib/finance-invoice-summary";
import {
  FinanceDetailLayout,
  FinanceDetailGrid,
  FinanceDetailField,
} from "@/components/finance/finance-detail-layout";
import { FinanceTimeline } from "@/components/finance/finance-timeline";
import { FinanceDocLink } from "@/components/finance/finance-doc-link";

export const revalidate = 0;

/** Invoice status badge via the centralized Bahasa Indonesia label helper (Req 3.1, 14.5). */
function getStatusBadge(status: string) {
  const label = getInvoiceStatusLabel(status);
  switch (status) {
    case "paid":
      return <Badge className="border-green-300 bg-green-100 text-green-800">{label}</Badge>;
    case "partial":
      return <Badge className="border-amber-300 bg-amber-100 text-amber-800">{label}</Badge>;
    case "unpaid":
      return <Badge className="border-red-300 bg-red-100 text-red-800">{label}</Badge>;
    case "cancelled":
      return <Badge className="border-gray-300 bg-gray-100 text-gray-700">{label}</Badge>;
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}

/** Payment verification badge (Req 3.3, 14.3). */
function getPaymentStatusBadge(status: string) {
  const label = getPaymentStatusLabel(status);
  switch (status) {
    case "verified":
      return <Badge className="border-green-300 bg-green-100 text-green-800">{label}</Badge>;
    case "pending":
      return <Badge className="border-amber-300 bg-amber-100 text-amber-800">{label}</Badge>;
    case "rejected":
      return <Badge className="border-red-300 bg-red-100 text-red-800">{label}</Badge>;
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Auth (Req 3): requireAuth redirects unauthenticated users; then gate by role.
  const activeUser = await requireAuth();
  const { isSuperAdmin, isKeuangan, isDireksi, isAdminKantor } = await getSessionRole(
    activeUser.id,
  );

  const hasAccess = isSuperAdmin || isKeuangan || isDireksi || isAdminKantor;
  if (!hasAccess) {
    redirect("/unauthorized");
  }

  // Fetch invoice with relations.
  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      projectId: invoices.projectId,
      unitId: invoices.unitId,
      customerId: invoices.customerId,
      bookingId: invoices.bookingId,
      type: invoices.type,
      amount: invoices.amount,
      dueDate: invoices.dueDate,
      status: invoices.status,
      notes: invoices.notes,
      createdAt: invoices.createdAt,
      scheduleKind: invoices.scheduleKind,
      scheduleSequence: invoices.scheduleSequence,
      scheduleLabel: invoices.scheduleLabel,
      projectName: projects.name,
      customerName: customers.name,
      unitCode: units.code,
      bookingNumber: bookings.bookingNumber,
    })
    .from(invoices)
    .innerJoin(projects, eq(invoices.projectId, projects.id))
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(units, eq(invoices.unitId, units.id))
    .leftJoin(bookings, eq(invoices.bookingId, bookings.id))
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) {
    notFound();
  }

  // Read-only additive verification for internal classification (Req 3.5, 2.4):
  // an invoice is "Pengeluaran Internal" ONLY when notes = "trxId:<id>" and
  // <id> resolves to a real EXPENSE transaction. customerId=null / type=other
  // alone is never sufficient. This does not mutate any data.
  const trxIdFromNotes = invoice.notes?.startsWith("trxId:")
    ? invoice.notes.slice("trxId:".length).trim()
    : null;

  let relatedExpenseTransactionId: string | null = null;
  if (trxIdFromNotes) {
    const [expenseTrx] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.id, trxIdFromNotes), eq(transactions.type, "expense")))
      .limit(1);
    relatedExpenseTransactionId = expenseTrx?.id ?? null;
  }

  const docContext = getInvoiceDocumentContext({
    type: invoice.type,
    customerId: invoice.customerId,
    bookingId: invoice.bookingId,
    customerName: invoice.customerName,
    notes: invoice.notes,
    scheduleKind: invoice.scheduleKind,
    relatedExpenseTransactionId,
    // The approval detail route is keyed by transactions.id (design decision #3).
    relatedApprovalId: relatedExpenseTransactionId,
  });
  const isInternal = docContext.kind === "internal";
  const relatedApprovalId = docContext.relatedApprovalId ?? null;

  // Older booking flows store the uploaded proof under the Booking attachment
  // rather than payments.proofAttachmentId. Reuse that same file for the
  // matching BF, DP, or Pelunasan Cash invoice detail without duplicating it.
  const bookingProofEntityType =
    invoice.type === "booking_fee"
      ? "booking_bf"
      : invoice.type === "dp"
        ? "booking_dp"
        : invoice.scheduleKind === "cash_settlement"
          ? "booking_cash_settlement"
          : null;

  const [bookingProof] =
    invoice.bookingId && bookingProofEntityType
      ? await db
          .select({ fileUrl: attachments.fileUrl, fileName: attachments.fileName })
          .from(attachments)
          .where(
            and(
              eq(attachments.entityId, invoice.bookingId),
              eq(attachments.entityType, bookingProofEntityType),
            ),
          )
          .orderBy(desc(attachments.createdAt))
          .limit(1)
      : [];

  // Payment history: newest → oldest (Req 3.3).
  const paymentsList = await db
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      paymentMethod: payments.paymentMethod,
      proofAttachmentId: payments.proofAttachmentId,
      proofFileUrl: attachments.fileUrl,
      status: payments.status,
      verifiedAt: payments.verifiedAt,
    })
    .from(payments)
    .leftJoin(attachments, eq(payments.proofAttachmentId, attachments.id))
    .where(eq(payments.invoiceId, id))
    .orderBy(desc(payments.paymentDate));

  const showBookingProofFallback =
    Boolean(bookingProof?.fileUrl) &&
    !paymentsList.some((payment) => Boolean(payment.proofFileUrl));

  // Summary (Req 3.2): verified payments only; remaining balance never negative.
  const { totalPaid, remainingBalance } = computeInvoicePaymentSummary(
    invoice.amount,
    paymentsList,
    { invoiceStatus: invoice.status },
  );
  const progressPct =
    invoice.amount > 0 ? Math.min(100, Math.round((totalPaid / invoice.amount) * 100)) : 0;

  const scheduleText = invoiceScheduleLabel({
    type: invoice.type,
    scheduleKind: invoice.scheduleKind ?? null,
    scheduleSequence: invoice.scheduleSequence ?? null,
    scheduleLabel: invoice.scheduleLabel ?? null,
  });

  // -------------------------------------------------------------------------
  // Summary cards (Req 3.2) — Total Tagihan, Sudah Dibayar, Sisa Tagihan.
  // -------------------------------------------------------------------------
  const summary = (
    <div className="space-y-4">
      <FinanceDetailGrid cols={3}>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">Total Tagihan</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums text-foreground">
              {formatRupiah(invoice.amount)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">Sudah Dibayar</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums text-green-700">
              {formatRupiah(totalPaid)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">Sisa Tagihan</CardDescription>
            <CardTitle
              className={`font-mono text-2xl tabular-nums ${
                remainingBalance > 0 ? "text-red-700" : "text-green-700"
              }`}
            >
              {formatRupiah(remainingBalance)}
            </CardTitle>
          </CardHeader>
        </Card>
      </FinanceDetailGrid>

      {/* Progress pembayaran (visual di-cap pada 100%). */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress Pembayaran</span>
          <span className="tabular-nums">{progressPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Detail metadata (Req 13.1 order #3) + payment history (Req 3.3, 3.4, 3.5).
  // Payment history is rendered inside `details` so the top-to-bottom order is:
  // header → summary → metadata → riwayat pembayaran → dokumen terkait → timeline.
  // -------------------------------------------------------------------------
  const details = (
    <div className="space-y-6">
      {/* Internal expense context (Req 3.5): only when verified as internal. */}
      {isInternal && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <ClipboardCheck className="h-5 w-5 text-primary/70" />
              Pengeluaran Internal
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Invoice ini merupakan dokumen pengeluaran internal yang diselesaikan melalui
              pengajuan kas keluar, bukan pembayaran customer.
            </CardDescription>
          </CardHeader>
          {relatedApprovalId && (
            <CardContent>
              <Link href={`/finance/approvals/${relatedApprovalId}`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Lihat Pengajuan Kas Keluar
                </Button>
              </Link>
            </CardContent>
          )}
        </Card>
      )}

      {/* Metadata */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Detail Invoice</CardTitle>
          <CardDescription className="text-muted-foreground">
            Informasi lengkap tagihan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinanceDetailGrid cols={2}>
            <div className="space-y-3">
              <FinanceDetailField
                label="Nomor Invoice"
                icon={<Hash className="h-4 w-4" />}
                value={invoice.invoiceNumber}
                mono
              />
              <FinanceDetailField
                label="Jenis Tagihan"
                icon={<Receipt className="h-4 w-4" />}
                value={scheduleText}
              />
              <FinanceDetailField
                label="Jumlah Tagihan"
                icon={<CreditCard className="h-4 w-4" />}
                value={formatRupiah(invoice.amount)}
                mono
                money
              />
              <FinanceDetailField
                label="Jatuh Tempo"
                icon={<Calendar className="h-4 w-4" />}
                value={invoice.dueDate ? formatDate(invoice.dueDate) : null}
              />
              <FinanceDetailField
                label="Tanggal Dibuat"
                icon={<Calendar className="h-4 w-4" />}
                value={formatDate(invoice.createdAt)}
              />
            </div>
            <div className="space-y-3">
              <FinanceDetailField
                label="Proyek"
                icon={<Building2 className="h-4 w-4" />}
                value={invoice.projectName}
              />
              <FinanceDetailField
                label="Unit / Kavling"
                icon={<Building2 className="h-4 w-4" />}
                value={invoice.unitCode}
                mono
              />
              <FinanceDetailField
                label={isInternal ? "Penerima" : "Pelanggan"}
                icon={<User className="h-4 w-4" />}
                value={invoice.customerName}
              />
              <FinanceDetailField
                label="No. Booking"
                icon={<Ticket className="h-4 w-4" />}
                value={invoice.bookingNumber}
                mono
              />
            </div>
          </FinanceDetailGrid>
          {invoice.notes && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Catatan</p>
              <p className="text-sm text-foreground">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Riwayat Pembayaran (Req 3.3, 3.4, 3.5) */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Riwayat Pembayaran</CardTitle>
          <CardDescription className="text-muted-foreground">
            Seluruh pembayaran yang terkait dengan invoice ini, terbaru ke terlama
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showBookingProofFallback && bookingProof?.fileUrl && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Bukti pembayaran diunggah dari Detail Booking
                </p>
                <p className="text-xs text-muted-foreground">
                  {bookingProof.fileName ?? "Lampiran bukti pembayaran"}
                </p>
              </div>
              <a
                href={bookingProof.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#4F6F52] hover:text-[#3D563F] hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Lihat Bukti
              </a>
            </div>
          )}
          {paymentsList.length === 0 ? (
            isInternal ? (
              <div className="rounded-md border border-dashed border-border bg-[#F7F8F3] px-4 py-8 text-center">
                <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-primary/50" />
                <p className="text-sm font-semibold text-foreground">
                  Diselesaikan melalui persetujuan kas keluar
                </p>
                <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
                  Tidak ada pembayaran customer yang dicatat pada invoice ini. Status
                  pembayaran mengikuti pengajuan kas keluar terkait.
                </p>
                {relatedApprovalId && (
                  <Link href={`/finance/approvals/${relatedApprovalId}`}>
                    <Button variant="outline" size="sm" className="mt-4 gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      Lihat Pengajuan Kas Keluar
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border bg-[#F7F8F3] px-4 py-8 text-center">
                <CreditCard className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">Belum ada pembayaran</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  Belum ada pembayaran customer yang tercatat untuk invoice ini.
                </p>
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-muted-foreground">No. Pembayaran</TableHead>
                    <TableHead className="text-muted-foreground">Jumlah</TableHead>
                    <TableHead className="text-muted-foreground">Tanggal</TableHead>
                    <TableHead className="text-muted-foreground">Metode</TableHead>
                    <TableHead className="text-muted-foreground">Bukti</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsList.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono font-medium">
                        <FinanceDocLink
                          href={`/finance/payments/${payment.id}`}
                          className="font-medium"
                        >
                          {payment.paymentNumber}
                        </FinanceDocLink>
                      </TableCell>
                      <TableCell className="font-mono font-semibold tabular-nums text-foreground">
                        {formatRupiah(payment.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(payment.paymentDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getPaymentMethodLabel(payment.paymentMethod)}
                      </TableCell>
                      <TableCell>
                        {payment.proofFileUrl ? (
                          <a
                            href={payment.proofFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-[#4F6F52] hover:text-[#3D563F] hover:underline"
                          >
                            Lihat Bukti
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // -------------------------------------------------------------------------
  // Dokumen Terkait (Req 3.7, 13.2, 13.3): only relations that actually exist.
  // Routes: expense approval → /finance/approvals/<trxId> (FinanceDocLink).
  // Booking / unit have no detail route here → monospace non-clickable text.
  // -------------------------------------------------------------------------
  const hasRelated =
    Boolean(relatedApprovalId) ||
    Boolean(invoice.bookingNumber) ||
    Boolean(invoice.unitCode) ||
    Boolean(invoice.customerName);

  const relatedDocuments = hasRelated ? (
    <Card className="border-border">
      <CardContent className="pt-6">
        <FinanceDetailGrid cols={2}>
          <div className="space-y-3">
            {isInternal && (
              <FinanceDetailField
                label="Pengajuan Kas Keluar"
                icon={<ClipboardCheck className="h-4 w-4" />}
              >
                <FinanceDocLink
                  href={relatedApprovalId ? `/finance/approvals/${relatedApprovalId}` : null}
                >
                  {relatedApprovalId ?? "\u2014"}
                </FinanceDocLink>
              </FinanceDetailField>
            )}
            <FinanceDetailField
              label="No. Booking"
              icon={<Ticket className="h-4 w-4" />}
              value={invoice.bookingNumber}
              mono
            />
          </div>
          <div className="space-y-3">
            <FinanceDetailField
              label="Unit / Kavling"
              icon={<Building2 className="h-4 w-4" />}
              value={invoice.unitCode}
              mono
            />
            <FinanceDetailField
              label={isInternal ? "Penerima" : "Pelanggan"}
              icon={<User className="h-4 w-4" />}
              value={invoice.customerName}
            />
          </div>
        </FinanceDetailGrid>
      </CardContent>
    </Card>
  ) : null;

  return (
    <FinanceDetailLayout
      docNumber={invoice.invoiceNumber}
      icon={<FileText className="h-6 w-6" />}
      statusBadge={getStatusBadge(invoice.status)}
      projectName={invoice.projectName}
      descriptionExtra={
        <span className="text-muted-foreground">
          {"\u2014"} {docContext.label}
        </span>
      }
      backHref="/finance?tab=invoices"
      headerActions={
        <Link href={`/finance/invoices/${id}/print`} target="_blank">
          <Button
            size="sm"
            className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Printer className="h-4 w-4" />
            Cetak Invoice
          </Button>
        </Link>
      }
      summary={summary}
      details={details}
      relatedDocuments={relatedDocuments}
      relatedEmptyState="Belum ada dokumen lain yang berelasi dengan invoice ini."
      timeline={
        <FinanceTimeline
          entityType="invoice"
          entityId={id}
          emptyState={
            isInternal ? (
              <div className="rounded-md border border-dashed border-border bg-[#F7F8F3] px-4 py-8 text-center">
                <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-primary/50" />
                <p className="text-sm font-semibold text-foreground">
                  Aktivitas utama tersedia di pengajuan kas keluar
                </p>
                <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
                  Invoice pengeluaran internal mengikuti timeline approval transaksi
                  terkait, bukan timeline pembayaran customer.
                </p>
                {relatedApprovalId && (
                  <Link href={`/finance/approvals/${relatedApprovalId}`}>
                    <Button variant="outline" size="sm" className="mt-4 gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      Lihat Timeline Pengajuan
                    </Button>
                  </Link>
                )}
              </div>
            ) : undefined
          }
        />
      }
    />
  );
}
