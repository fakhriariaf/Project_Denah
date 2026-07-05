import { db } from "@/db";
import { invoices, payments } from "@/db/schema/finance";
import { projects, units, customers } from "@/db/schema/master";
import { bookings } from "@/db/schema/marketing";
import { attachments } from "@/db/schema/system";
import { eq, desc } from "drizzle-orm";
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
} from "lucide-react";
import { formatRupiah, formatDate } from "@/lib/format-utils";

export const revalidate = 0;

const TYPE_LABELS: Record<string, string> = {
  booking_fee: "Biaya Pemesanan (Booking Fee)",
  dp: "Uang Muka / Down Payment (DP)",
  installment: "Cicilan Bertahap",
  other: "Lain-Lain",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Tunai",
  transfer: "Transfer Bank",
  giro: "Giro / Bilyet",
  other: "Lainnya",
};

function getStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-800 border-green-300">Lunas</Badge>;
    case "partial":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300">Sebagian</Badge>;
    case "unpaid":
      return <Badge className="bg-red-100 text-red-800 border-red-300">Belum Bayar</Badge>;
    case "cancelled":
      return <Badge className="bg-gray-100 text-gray-700 border-gray-300">Dibatalkan</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getPaymentStatusBadge(status: string) {
  switch (status) {
    case "verified":
      return <Badge className="bg-green-100 text-green-800 border-green-300">Terverifikasi</Badge>;
    case "pending":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300">Pending</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-800 border-red-300">Ditolak</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
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

  // Calculate totals
  const totalPaid = paymentsList
    .filter((p) => p.status === "verified")
    .reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = Math.max(0, invoice.amount - totalPaid);

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
              <span className="text-[#66736A]">— {invoice.customerName}</span>
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
              <Button size="sm" className="gap-1 bg-[#4F6F52] hover:bg-[#3d5940] text-white">
                <Printer className="h-4 w-4" />
                Cetak Invoice
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Info Card */}
        <Card className="lg:col-span-2 border-[#D6DED2]">
          <CardHeader>
            <CardTitle className="text-lg text-[#243028]">Detail Invoice</CardTitle>
            <CardDescription className="text-[#66736A]">
              Informasi lengkap tagihan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Hash className="h-4 w-4 text-[#8FAF9A] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-[#66736A] font-medium">Nomor Invoice</p>
                    <p className="text-sm font-semibold text-[#243028] font-mono">{invoice.invoiceNumber}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Receipt className="h-4 w-4 text-[#8FAF9A] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-[#66736A] font-medium">Jenis Tagihan</p>
                    <p className="text-sm font-semibold text-[#243028]">{TYPE_LABELS[invoice.type] || invoice.type}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CreditCard className="h-4 w-4 text-[#8FAF9A] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-[#66736A] font-medium">Jumlah Tagihan</p>
                    <p className="text-sm font-bold text-[#243028]">{formatRupiah(invoice.amount)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-[#8FAF9A] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-[#66736A] font-medium">Jatuh Tempo</p>
                    <p className="text-sm text-[#243028]">{formatDate(invoice.dueDate)}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-[#8FAF9A] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-[#66736A] font-medium">Proyek</p>
                    <p className="text-sm font-semibold text-[#243028]">{invoice.projectName}</p>
                  </div>
                </div>
                {invoice.unitCode && (
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 text-[#8FAF9A] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-[#66736A] font-medium">Unit / Kavling</p>
                      <p className="text-sm font-semibold font-mono text-[#243028]">{invoice.unitCode}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-[#8FAF9A] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-[#66736A] font-medium">Pelanggan</p>
                    <p className="text-sm font-semibold text-[#243028]">{invoice.customerName || "—"}</p>
                  </div>
                </div>
                {invoice.bookingNumber && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-[#8FAF9A] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-[#66736A] font-medium">No. Booking</p>
                      <p className="text-sm font-mono text-[#243028]">{invoice.bookingNumber}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {invoice.notes && (
              <div className="mt-4 pt-4 border-t border-[#D6DED2]">
                <p className="text-xs text-[#66736A] font-medium mb-1">Catatan</p>
                <p className="text-sm text-[#243028]">{invoice.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card className="border-[#D6DED2]">
          <CardHeader>
            <CardTitle className="text-lg text-[#243028]">Ringkasan</CardTitle>
            <CardDescription className="text-[#66736A]">
              Status pembayaran
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#66736A]">Total Tagihan</span>
              <span className="text-sm font-bold font-mono text-[#243028]">
                {formatRupiah(invoice.amount)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#66736A]">Sudah Dibayar</span>
              <span className="text-sm font-bold font-mono text-green-700">
                {formatRupiah(totalPaid)}
              </span>
            </div>
            <div className="border-t border-[#D6DED2] pt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-[#243028]">Sisa Tagihan</span>
                <span
                  className={`text-base font-black font-mono ${
                    remainingBalance > 0 ? "text-red-700" : "text-green-700"
                  }`}
                >
                  {formatRupiah(remainingBalance)}
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#66736A]">
                <span>Progress Pembayaran</span>
                <span>
                  {invoice.amount > 0
                    ? Math.min(100, Math.round((totalPaid / invoice.amount) * 100))
                    : 0}
                  %
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#DDE8D8] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#4F6F52] transition-all"
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
      <Card className="border-[#D6DED2]">
        <CardHeader>
          <CardTitle className="text-lg text-[#243028]">Riwayat Pembayaran</CardTitle>
          <CardDescription className="text-[#66736A]">
            Seluruh pembayaran yang terkait dengan invoice ini
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentsList.length === 0 ? (
            <div className="text-center py-8 text-[#66736A]">
              <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Belum ada pembayaran tercatat.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[#66736A]">No. Pembayaran</TableHead>
                    <TableHead className="text-[#66736A]">Jumlah</TableHead>
                    <TableHead className="text-[#66736A]">Tanggal</TableHead>
                    <TableHead className="text-[#66736A]">Metode</TableHead>
                    <TableHead className="text-[#66736A]">Bukti</TableHead>
                    <TableHead className="text-[#66736A]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsList.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono font-medium text-[#243028]">
                        {payment.paymentNumber}
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-[#243028]">
                        {formatRupiah(payment.amount)}
                      </TableCell>
                      <TableCell className="text-[#66736A]">
                        {formatDate(payment.paymentDate)}
                      </TableCell>
                      <TableCell className="text-[#66736A]">
                        {METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}
                      </TableCell>
                      <TableCell>
                        {payment.proofFileUrl ? (
                          <a
                            href={payment.proofFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#4F6F52] hover:underline text-sm font-medium"
                          >
                            Lihat Bukti
                          </a>
                        ) : (
                          <span className="text-[#66736A] text-sm">—</span>
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
}
