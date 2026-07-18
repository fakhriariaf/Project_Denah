import { db } from "@/db";
import { invoices, payments } from "@/db/schema/finance";
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
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import {
  FileText,
  ArrowLeft,
  Printer,
  Calendar,
  Building2,
  User,
  CreditCard,
  Hash,
  Receipt,
  ClipboardCheck,
  History,
} from "lucide-react";
import { formatRupiah, formatDate } from "@/lib/format-utils";
import {
  getInvoiceStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  invoiceScheduleLabel,
} from "@/lib/label-helpers";
import { computeInvoicePaymentSummary } from "@/lib/finance-invoice-summary";
import { FinanceTimeline } from "@/components/finance/finance-timeline";
import { FinanceDocLink } from "@/components/finance/finance-doc-link";

export const revalidate = 0;

function getStatusBadge(status: string) {
  const label = getInvoiceStatusLabel(status);
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-800 border-green-300">{label}</Badge>;
    case "partial":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300">{label}</Badge>;
    case "unpaid":
      return <Badge className="bg-red-100 text-red-800 border-red-300">{label}</Badge>;
    case "cancelled":
      return <Badge className="bg-gray-100 text-gray-700 border-gray-300">{label}</Badge>;
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}

function getPaymentStatusBadge(status: string) {
  const label = getPaymentStatusLabel(status);
  switch (status) {
    case "verified":
      return <Badge className="bg-green-100 text-green-800 border-green-300">{label}</Badge>;
    case "pending":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300">{label}</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-800 border-red-300">{label}</Badge>;
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

  // Auth check
  const activeUser = await requireAuth();
  const { isSuperAdmin, isKeuangan, isDireksi, isAdminKantor } = await getSessionRole(activeUser.id);

  const hasAccess = isSuperAdmin || isKeuangan || isDireksi || isAdminKantor;
  if (!hasAccess) {
    redirect("/unauthorized");
  }

  // Fetch invoice with relations
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
              eq(attachments.entityType, bookingProofEntityType)
            )
          )
          .orderBy(desc(attachments.createdAt))
          .limit(1)
      : [];

  // Fetch all payments linked to this invoice
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

  // Calculate totals (verified payments only; remaining balance never negative)
  const { totalPaid, remainingBalance } = computeInvoicePaymentSummary(
    invoice.amount,
    paymentsList,
    { invoiceStatus: invoice.status },
  );
  const relatedApprovalId = invoice.notes?.startsWith("trxId:")
    ? invoice.notes.slice("trxId:".length)
    : null;
  const isExpenseApprovalInvoice = Boolean(relatedApprovalId);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <PageHeader
        title={invoice.invoiceNumber}
        icon={<FileText className="h-6 w-6" />}
        description={
          <span className="flex items-center gap-2">
            {getStatusBadge(invoice.status)}
            {invoice.customerName && (
              <span className="text-muted-foreground">— {invoice.customerName}</span>
            )}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href="/finance?tab=invoices">
              <Button variant="outline" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </Button>
            </Link>
            <Link href={`/finance/invoices/${id}/print`} target="_blank">
              <Button size="sm" className="gap-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Printer className="h-4 w-4" />
                Cetak Invoice
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Invoice Info Card */}
        <Card className="lg:col-span-2 border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Detail Invoice</CardTitle>
            <CardDescription className="text-muted-foreground">
              Informasi lengkap tagihan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Hash className="h-4 w-4 text-primary/70 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Nomor Invoice</p>
                    <p className="text-sm font-semibold text-foreground font-mono">{invoice.invoiceNumber}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Receipt className="h-4 w-4 text-primary/70 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Jenis Tagihan</p>
                    <p className="text-sm font-semibold text-foreground">{invoiceScheduleLabel({
                      type: invoice.type,
                      scheduleKind: invoice.scheduleKind ?? null,
                      scheduleSequence: invoice.scheduleSequence ?? null,
                      scheduleLabel: invoice.scheduleLabel ?? null,
                    })}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CreditCard className="h-4 w-4 text-primary/70 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Jumlah Tagihan</p>
                    <p className="text-sm font-bold text-foreground font-mono tabular-nums">{formatRupiah(invoice.amount)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-primary/70 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Jatuh Tempo</p>
                    <p className="text-sm text-foreground">{formatDate(invoice.dueDate)}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-primary/70 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Proyek</p>
                    <p className="text-sm font-semibold text-foreground">{invoice.projectName}</p>
                  </div>
                </div>
                {invoice.unitCode && (
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 text-primary/70 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Unit / Kavling</p>
                      <p className="text-sm font-semibold font-mono text-foreground">{invoice.unitCode}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-primary/70 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Pelanggan</p>
                    <p className="text-sm font-semibold text-foreground">{invoice.customerName || "—"}</p>
                  </div>
                </div>
                {invoice.bookingNumber && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-primary/70 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">No. Booking</p>
                      <p className="text-sm font-mono text-foreground">{invoice.bookingNumber}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {invoice.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium mb-1">Catatan</p>
                <p className="text-sm text-foreground">{invoice.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Ringkasan</CardTitle>
            <CardDescription className="text-muted-foreground">
              Status pembayaran
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Tagihan</span>
              <span className="text-sm font-bold font-mono tabular-nums text-foreground">
                {formatRupiah(invoice.amount)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Sudah Dibayar</span>
              <span className="text-sm font-bold font-mono tabular-nums text-green-700">
                {formatRupiah(totalPaid)}
              </span>
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-foreground">Sisa Tagihan</span>
                <span
                  className={`text-base font-black font-mono tabular-nums ${
                    remainingBalance > 0 ? "text-red-700" : "text-green-700"
                  }`}
                >
                  {formatRupiah(remainingBalance)}
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress Pembayaran</span>
                <span>
                  {invoice.amount > 0
                    ? Math.min(100, Math.round((totalPaid / invoice.amount) * 100))
                    : 0}
                  %
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${
                      invoice.amount > 0
                        ? Math.min(100, Math.round((totalPaid / invoice.amount) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment History Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Riwayat Pembayaran</CardTitle>
          <CardDescription className="text-muted-foreground">
            Seluruh pembayaran yang terkait dengan invoice ini
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
                className="text-sm font-semibold text-primary hover:underline"
              >
                Lihat Bukti
              </a>
            </div>
          )}
          {paymentsList.length === 0 ? (
            isExpenseApprovalInvoice ? (
              <div className="rounded-md border border-dashed border-border bg-[#F7F8F3] px-4 py-8 text-center">
                <ClipboardCheck className="h-8 w-8 mx-auto mb-3 text-primary/50" />
                <p className="text-sm font-semibold text-foreground">
                  Invoice ini diselesaikan melalui persetujuan kas keluar.
                </p>
                <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
                  Tidak ada pembayaran customer yang dicatat pada invoice ini. Status lunas
                  mengikuti pengajuan kas keluar terkait.
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
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Belum ada pembayaran customer untuk invoice ini.</p>
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
                            className="text-primary hover:underline text-sm font-medium"
                          >
                            Lihat Bukti
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
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

      {/* Timeline */}
      <FinanceTimeline
        entityType="invoice"
        entityId={id}
        emptyState={
          isExpenseApprovalInvoice ? (
            <div className="rounded-md border border-dashed border-border bg-[#F7F8F3] px-4 py-8 text-center">
              <History className="h-8 w-8 mx-auto mb-3 text-primary/50" />
              <p className="text-sm font-semibold text-foreground">
                Aktivitas utama tersedia di pengajuan kas keluar.
              </p>
              <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
                Invoice kas keluar mengikuti timeline approval transaksi terkait, bukan
                timeline pembayaran customer.
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
    </div>
  );
}
