import { db } from "@/db";
import { payments, invoices, financeActivityHistory } from "@/db/schema/finance";
import { projects, units, customers } from "@/db/schema/master";
import { attachments } from "@/db/schema/system";
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
  Wallet,
  Hash,
  CreditCard,
  Calendar,
  Building2,
  User,
  FileText,
  ShieldCheck,
  ImageIcon,
  FileWarning,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { formatRupiah, formatDate } from "@/lib/format-utils";
import {
  getPaymentStatusLabel,
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

/** Payment status badge using the centralized Bahasa Indonesia label helper (Req 6.4, 11.4). */
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

/** Format a date as yyyy-mm-dd for a native <input type="date"> value. */
function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Detect the proof attachment kind from mime type and/or the file URL extension. */
function classifyProof(mimeType: string | null, fileUrl: string | null): "image" | "pdf" | "other" {
  const mime = (mimeType ?? "").toLowerCase();
  const url = (fileUrl ?? "").toLowerCase().split("?")[0];
  if (mime.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/.test(url)) return "image";
  if (mime === "application/pdf" || /\.pdf$/.test(url)) return "pdf";
  return "other";
}

export default async function PaymentDetailPage({
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

  // Fetch payment with relations.
  const [payment] = await db
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      invoiceId: payments.invoiceId,
      projectId: payments.projectId,
      unitId: payments.unitId,
      customerId: payments.customerId,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      paymentMethod: payments.paymentMethod,
      proofAttachmentId: payments.proofAttachmentId,
      status: payments.status,
      verifiedBy: payments.verifiedBy,
      verifiedAt: payments.verifiedAt,
      createdAt: payments.createdAt,
      invoiceNumber: invoices.invoiceNumber,
      invoiceBookingId: invoices.bookingId,
      invoiceType: invoices.type,
      invoiceScheduleKind: invoices.scheduleKind,
      projectName: projects.name,
      customerName: customers.name,
      unitCode: units.code,
      proofFileName: attachments.fileName,
      proofFileUrl: attachments.fileUrl,
      proofMimeType: attachments.mimeType,
    })
    .from(payments)
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .leftJoin(projects, eq(payments.projectId, projects.id))
    .leftJoin(customers, eq(payments.customerId, customers.id))
    .leftJoin(units, eq(payments.unitId, units.id))
    .leftJoin(attachments, eq(payments.proofAttachmentId, attachments.id))
    .where(eq(payments.id, id))
    .limit(1);

  // Not-found indication with a back-to-tab link (Req 1.9) via notFound().
  if (!payment) {
    notFound();
  }

  // Booking BF/DP/Pelunasan Cash lama menyimpan file pada attachment Booking,
  // bukan pada payment.proofAttachmentId. Tampilkan file itu untuk pembayaran
  // terverifikasi yang terkait, tanpa mengubah relasi atau menduplikasi file.
  const bookingProofEntityType =
    payment.invoiceType === "booking_fee"
      ? "booking_bf"
      : payment.invoiceType === "dp"
        ? "booking_dp"
        : payment.invoiceScheduleKind === "cash_settlement"
          ? "booking_cash_settlement"
          : null;
  const [bookingProof] =
    payment.invoiceBookingId && bookingProofEntityType
      ? await db
          .select({
            fileName: attachments.fileName,
            fileUrl: attachments.fileUrl,
            mimeType: attachments.mimeType,
          })
          .from(attachments)
          .where(
            and(
              eq(attachments.entityId, payment.invoiceBookingId),
              eq(attachments.entityType, bookingProofEntityType)
            )
          )
          .orderBy(desc(attachments.createdAt))
          .limit(1)
      : [];

  const isRejected = payment.status === "rejected";
  const canRevise = isKeuangan || isSuperAdmin; // Req 6.5 mutation-visibility gate.

  // Latest rejection reason from finance_activity_history (Req 4.1, 6.5).
  let rejectionReason: string | null = null;
  if (isRejected) {
    const [rejectedRow] = await db
      .select({ reason: financeActivityHistory.reason })
      .from(financeActivityHistory)
      .where(
        and(
          eq(financeActivityHistory.entityType, "payment"),
          eq(financeActivityHistory.entityId, id),
          eq(financeActivityHistory.action, "rejected"),
        ),
      )
      .orderBy(desc(financeActivityHistory.createdAt))
      .limit(1);
    rejectionReason = rejectedRow?.reason ?? null;
  }

  const proofFileUrl =
    payment.proofFileUrl ??
    (payment.status === "verified" ? bookingProof?.fileUrl ?? null : null);
  const proofFileName = payment.proofFileName ?? bookingProof?.fileName ?? null;
  const proofMimeType = payment.proofMimeType ?? bookingProof?.mimeType ?? null;
  const proofKind = classifyProof(proofMimeType, proofFileUrl);
  const hasProof = Boolean(proofFileUrl);
  const proofFromBooking = !payment.proofFileUrl && Boolean(proofFileUrl);

  // --- Summary cards (Req 2.3) ---
  const summary = (
    <FinanceDetailGrid cols={3}>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardDescription className="text-muted-foreground">Jumlah Pembayaran</CardDescription>
          <CardTitle className="font-mono text-2xl tabular-nums text-foreground">
            {formatRupiah(payment.amount)}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardDescription className="text-muted-foreground">Tanggal Pembayaran</CardDescription>
          <CardTitle className="text-lg text-foreground">{formatDate(payment.paymentDate)}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardDescription className="text-muted-foreground">Status Verifikasi</CardDescription>
          <div className="pt-1">{getPaymentStatusBadge(payment.status)}</div>
        </CardHeader>
      </Card>
    </FinanceDetailGrid>
  );

  // --- Detail metadata (Req 2.4) ---
  const details = (
    <div className="space-y-6">
      {/* Rejection notice + revision trigger (Req 6.5) */}
      {isRejected && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-800">
              <AlertTriangle className="h-5 w-5" />
              Pembayaran Ditolak
            </CardTitle>
            <CardDescription className="text-red-700">
              {rejectionReason && rejectionReason.trim() !== ""
                ? rejectionReason
                : "Alasan penolakan tidak tercatat pada timeline finance."}
            </CardDescription>
          </CardHeader>
          {canRevise && (
            <CardContent>
              <RevisionButton
                paymentId={payment.id}
                rejectionReason={rejectionReason}
                paymentNumber={payment.paymentNumber}
                createdAt={formatDate(payment.createdAt)}
                initialValues={{
                  amount: String(payment.amount ?? ""),
                  paymentDate: toDateInputValue(payment.paymentDate),
                  paymentMethod: payment.paymentMethod ?? "",
                  proofAttachmentId: payment.proofAttachmentId ?? "",
                }}
              />
            </CardContent>
          )}
        </Card>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Detail Pembayaran</CardTitle>
          <CardDescription className="text-muted-foreground">
            Informasi lengkap pembayaran dan dokumen terkait
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinanceDetailGrid cols={2}>
            <div className="space-y-3">
              <FinanceDetailField
                label="Nomor Pembayaran"
                icon={<Hash className="h-4 w-4" />}
                value={payment.paymentNumber}
                mono
              />
              <FinanceDetailField
                label="Metode Pembayaran"
                icon={<CreditCard className="h-4 w-4" />}
                value={getPaymentMethodLabel(payment.paymentMethod)}
              />
              <FinanceDetailField
                label="Tanggal Pembayaran"
                icon={<Calendar className="h-4 w-4" />}
                value={formatDate(payment.paymentDate)}
              />
              <FinanceDetailField
                label="Tanggal Dibuat"
                icon={<Calendar className="h-4 w-4" />}
                value={formatDate(payment.createdAt)}
              />
              <FinanceDetailField
                label="Diverifikasi Pada"
                icon={<ShieldCheck className="h-4 w-4" />}
                value={payment.verifiedAt ? formatDate(payment.verifiedAt) : null}
              />
            </div>
            <div className="space-y-3">
              {/* Linked invoice — the one relation with an existing detail route (Req 6.3). */}
              <FinanceDetailField label="Invoice Terkait" icon={<FileText className="h-4 w-4" />}>
                {payment.invoiceId && payment.invoiceNumber ? (
                  <FinanceDocLink href={`/finance/invoices/${payment.invoiceId}`}>
                    {payment.invoiceNumber}
                  </FinanceDocLink>
                ) : (
                  <span className="text-foreground">{"\u2014"}</span>
                )}
              </FinanceDetailField>
              {/* Project / customer / unit have no dedicated detail routes yet —
                  render as dash-when-null text/identifier (safe, Req 6.3). */}
              <FinanceDetailField
                label="Proyek"
                icon={<Building2 className="h-4 w-4" />}
                value={payment.projectName}
              />
              <FinanceDetailField
                label="Pelanggan"
                icon={<User className="h-4 w-4" />}
                value={payment.customerName}
              />
              <FinanceDetailField
                label="Unit / Kavling"
                icon={<Building2 className="h-4 w-4" />}
                value={payment.unitCode}
                mono
              />
            </div>
          </FinanceDetailGrid>
        </CardContent>
      </Card>

      {/* Proof attachment (Req 6.1, 6.2) */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <ImageIcon className="h-5 w-5 text-primary/70" />
            Bukti Pembayaran
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {proofFromBooking
              ? "Lampiran bukti pembayaran yang diunggah dari Detail Booking"
              : "Lampiran bukti transfer / pembayaran"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasProof || !proofFileUrl ? (
            // Placeholder when no proof uploaded (Req 6.2).
            <div className="rounded-md border border-dashed border-border bg-[#F7F8F3] px-4 py-10 text-center">
              <FileWarning className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Belum ada bukti pembayaran yang diunggah.</p>
            </div>
          ) : proofKind === "image" ? (
            // Image preview for jpg/png/webp (Req 6.1).
            <div className="space-y-2">
              <a href={proofFileUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proofFileUrl}
                  alt={proofFileName ?? "Bukti pembayaran"}
                  className="max-h-96 w-auto rounded-md border border-border object-contain"
                />
              </a>
              <a
                href={proofFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-[#4F6F52] hover:text-[#3D563F] hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Buka di tab baru
              </a>
            </div>
          ) : (
            // PDF and other file types: open-in-new-tab link (Req 6.1).
            <a
              href={proofFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-[#F7F8F3] px-4 py-3 text-sm font-medium text-[#4F6F52] hover:text-[#3D563F] hover:underline"
            >
              <FileText className="h-4 w-4" />
              {proofFileName ?? "Lihat Bukti (PDF)"}
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <FinanceDetailLayout
      docNumber={payment.paymentNumber}
      icon={<Wallet className="h-6 w-6" />}
      statusBadge={getPaymentStatusBadge(payment.status)}
      projectName={payment.projectName}
      descriptionExtra={
        payment.customerName ? (
          <span className="text-muted-foreground">{"\u2014"} {payment.customerName}</span>
        ) : null
      }
      backHref="/finance?tab=payments"
      summary={summary}
      details={details}
      timeline={<FinanceTimeline entityType="payment" entityId={id} />}
    />
  );
}
