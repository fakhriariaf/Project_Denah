import { db } from "@/db";
import { bookings as bookingsTable, bookingStatusHistories, customerDocuments } from "@/db/schema/marketing";
import { projects as projectsTable, units as unitsTable, customers as customersTable } from "@/db/schema/master";
import { user as userTable } from "@/db/schema/auth";
import { roles as rolesTable } from "@/db/schema/access";
import { attachments } from "@/db/schema/system";
import { invoices as invoicesTable, payments as paymentsTable } from "@/db/schema/finance";
import { desc, asc, eq, and, inArray } from "drizzle-orm";
import { requireAuth, getSessionRole } from "@/server/permissions";
import { redirect, notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import EditBookingDialog from "@/app/marketing/bookings/edit-booking-dialog";
import {
  FileText,
  Calendar,
  Building2,
  User,
  DollarSign,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Printer,
  FilePlus,
  ShieldCheck,
  ChevronRight,
  Edit3,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import CancelBookingDialog from "@/app/marketing/bookings/cancel-booking-dialog";
import BookingPaymentProofForm from "./payment-proof-form";
import { akadAction, completeAkadAction } from "./akad-action";
import { formatRupiah, formatDate } from "@/lib/format-utils";
import { getPaymentSchemeLabel, getPaymentStatusLabel } from "@/lib/label-helpers";
import { CustomerDocumentsPanel } from "@/components/customer-documents-panel";
import BookingAttachmentsList from "./attachments-list";
import BastConsumerCard from "./bast-consumer-card";
import { getI18n } from "@/lib/i18n-server";
import { getUnitBusinessState } from "@/lib/unit-business-state";
import { getBookingAkadReadiness } from "@/server/services/booking-akad-readiness";
import { getBookingNextStepReadiness } from "@/server/services/booking-next-step-readiness";

export const revalidate = 0;

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { t } = await getI18n();

  // Auth
  const activeUser = await requireAuth();
  const session = await getSessionRole(activeUser.id);



  // Fetch booking
  const [bookingData] = await db.select({
    id: bookingsTable.id,
    bookingNumber: bookingsTable.bookingNumber,
    bookingDate: bookingsTable.bookingDate,
    bookingFee: bookingsTable.bookingFee,
    dpAmount: bookingsTable.dpAmount,
    paymentScheme: bookingsTable.paymentScheme,
    status: bookingsTable.status,
    cancellationReason: bookingsTable.cancellationReason,
    marketingId: bookingsTable.marketingId,
    projectId: bookingsTable.projectId,
    unitId: bookingsTable.unitId,
    customerId: bookingsTable.customerId,
    projectName: projectsTable.name,
    unitCode: unitsTable.code,
    unitStatus: unitsTable.status,
    unitConstructionProgress: unitsTable.constructionProgress,
    unitIsReadyStock: unitsTable.isReadyStock,
    unitReadyStockSource: unitsTable.readyStockSource,
    unitCurrentSpkId: unitsTable.currentSpkId,
    landArea: unitsTable.landArea,
    buildingArea: unitsTable.buildingArea,
    price: unitsTable.price,
    customerName: customersTable.name,
    customerPhone: customersTable.phone,
    marketingName: userTable.name,
    termin: bookingsTable.termin,
  })
  .from(bookingsTable)
  .leftJoin(projectsTable, eq(bookingsTable.projectId, projectsTable.id))
  .leftJoin(unitsTable, eq(bookingsTable.unitId, unitsTable.id))
  .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
  .leftJoin(userTable, eq(bookingsTable.marketingId, userTable.id))
  .where(eq(bookingsTable.id, id));

  if (!bookingData) notFound();

  // RBAC: Marketing Biasa hanya bisa lihat booking miliknya
  const isBiasaRole = session.isMarketing && !session.isMarketingManager && !session.isAdminKantor && !session.isSuperAdmin;
  if (isBiasaRole && bookingData.marketingId !== activeUser.id) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-[#8FAF9A]/15 blur-3xl pointer-events-none animate-pulse duration-[8000ms]" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl pointer-events-none animate-pulse duration-[10000ms]" />
        
        <div className="relative max-w-md w-full bg-white/80 backdrop-blur-md border border-border rounded-3xl p-8 shadow-sage-lg text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="mx-auto h-20 w-20 rounded-3xl bg-rose-50 border border-rose-100 flex items-center justify-center shadow-[0_8px_30px_rgb(244,63,94,0.08)] mb-6">
            <ShieldAlert className="h-10 w-10 text-rose-500 animate-bounce duration-[2000ms]" />
          </div>
          
          <h1 className="text-2xl font-black text-foreground tracking-tight mb-2">
            {t("booking_detail.unauthorized_title")}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            {t("booking_detail.unauthorized_desc")}
          </p>
          
          <div className="flex flex-col gap-2">
            <Link href="/marketing/bookings" className="w-full">
              <Button className="w-full bg-primary hover:bg-primary/90 text-white active:scale-95 btn-premium h-10 rounded-xl font-bold text-xs">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("booking_detail.back_btn")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fetch attachments for this booking
  const bookingAttachments = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.entityId, id),
        inArray(attachments.entityType, ["booking", "booking_bf", "booking_dp", "booking_cash_settlement"])
      )
    )
    .orderBy(desc(attachments.createdAt));

  const bfAttachments = bookingAttachments.filter(
    (att) => att.entityType === "booking_bf" || att.entityType === "booking"
  );
  const dpAttachments = bookingAttachments.filter(
    (att) => att.entityType === "booking_dp"
  );
  const cashSettlementAttachments = bookingAttachments.filter(
    (att) => att.entityType === "booking_cash_settlement"
  );

  const [bookingFeeInvoice, dpInvoice] = await Promise.all([
    db
      .select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.bookingId, id), eq(invoicesTable.type, "booking_fee")))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.bookingId, id), eq(invoicesTable.type, "dp")))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const paymentSummaryFields = {
    id: paymentsTable.id,
    invoiceId: paymentsTable.invoiceId,
    paymentNumber: paymentsTable.paymentNumber,
    amount: paymentsTable.amount,
    paymentDate: paymentsTable.paymentDate,
    status: paymentsTable.status,
    proofAttachmentId: paymentsTable.proofAttachmentId,
  };
  const [bookingFeePayments, dpPayments] = await Promise.all([
    bookingFeeInvoice
      ? db.select(paymentSummaryFields).from(paymentsTable).where(eq(paymentsTable.invoiceId, bookingFeeInvoice.id)).orderBy(desc(paymentsTable.paymentDate))
      : Promise.resolve([]),
    dpInvoice
      ? db.select(paymentSummaryFields).from(paymentsTable).where(eq(paymentsTable.invoiceId, dpInvoice.id)).orderBy(desc(paymentsTable.paymentDate))
      : Promise.resolve([]),
  ]);

  const cashSettlementInvoice = bookingData.paymentScheme === "cash"
    ? (await db
        .select({
          id: invoicesTable.id,
          amount: invoicesTable.amount,
          status: invoicesTable.status,
          scheduleLabel: invoicesTable.scheduleLabel,
        })
        .from(invoicesTable)
        .where(
          and(
            eq(invoicesTable.bookingId, id),
            eq(invoicesTable.scheduleKind, "cash_settlement")
          )
        )
        .limit(1))[0] ?? null
    : null;
  const cashSettlementPayments = cashSettlementInvoice
    ? await db
        .select(paymentSummaryFields)
        .from(paymentsTable)
        .where(eq(paymentsTable.invoiceId, cashSettlementInvoice.id))
        .orderBy(desc(paymentsTable.paymentDate))
    : [];

  // Installment (Cash Bertahap) termin schedule + per-termin payments.
  const installmentInvoices = bookingData.paymentScheme === "installment"
    ? await db
        .select({
          id: invoicesTable.id,
          amount: invoicesTable.amount,
          status: invoicesTable.status,
          dueDate: invoicesTable.dueDate,
          scheduleSequence: invoicesTable.scheduleSequence,
          scheduleLabel: invoicesTable.scheduleLabel,
        })
        .from(invoicesTable)
        .where(
          and(
            eq(invoicesTable.bookingId, id),
            eq(invoicesTable.scheduleKind, "installment")
          )
        )
        .orderBy(asc(invoicesTable.scheduleSequence))
    : [];
  const installmentPaymentsByInvoice = new Map<string, typeof cashSettlementPayments>();
  if (installmentInvoices.length > 0) {
    const rows = await db
      .select(paymentSummaryFields)
      .from(paymentsTable)
      .where(inArray(paymentsTable.invoiceId, installmentInvoices.map((invoice) => invoice.id)))
      .orderBy(desc(paymentsTable.paymentDate));
    for (const row of rows) {
      const key = (row as { invoiceId?: string }).invoiceId ?? "";
      const list = installmentPaymentsByInvoice.get(key) ?? [];
      list.push(row);
      installmentPaymentsByInvoice.set(key, list);
    }
  }
  // Sequential gating: a termin can only be paid after all previous termins are paid.
  const firstUnpaidInstallmentIndex = installmentInvoices.findIndex(
    (invoice) => invoice.status !== "paid" && invoice.status !== "cancelled"
  );
  const allBookingInvoices = await db
    .select({ id: invoicesTable.id, amount: invoicesTable.amount, status: invoicesTable.status })
    .from(invoicesTable)
    .where(eq(invoicesTable.bookingId, id));
  const allBookingPayments = allBookingInvoices.length > 0
    ? await db
        .select({ amount: paymentsTable.amount, status: paymentsTable.status })
        .from(paymentsTable)
        .where(inArray(paymentsTable.invoiceId, allBookingInvoices.map((invoice) => invoice.id)))
    : [];
  const totalInvoiceAmount = allBookingInvoices
    .filter((invoice) => invoice.status !== "cancelled")
    .reduce((total, invoice) => total + Number(invoice.amount), 0);
  const totalVerifiedPayment = allBookingPayments
    .filter((payment) => payment.status === "verified")
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const cashSettlementPaymentWithoutProof = cashSettlementPayments.find(
    (payment) => payment.status !== "voided" && !payment.proofAttachmentId
  );
  // BF/DP mengikuti pola Pelunasan Cash dan Termin: bila pencatatan payment
  // sudah dibuat lebih dahulu, upload bukti harus menempel ke payment itu,
  // bukan membuat PAY-AUTO kedua untuk invoice yang sama.
  const bookingFeePaymentWithoutProof = bookingFeePayments.find(
    (payment) => payment.status !== "voided" && !payment.proofAttachmentId
  );
  const dpPaymentWithoutProof = dpPayments.find(
    (payment) => payment.status !== "voided" && !payment.proofAttachmentId
  );
  const renderRecordedPayments = (recordedPayments: typeof cashSettlementPayments) => {
    if (recordedPayments.length === 0) return null;

    return (
      <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border">
        {recordedPayments.map((payment) => (
          <div key={payment.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pembayaran tercatat</p>
              <Link href={`/finance/payments/${payment.id}`} className="font-mono text-xs font-bold text-secondary-foreground hover:underline">
                {payment.paymentNumber}
              </Link>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-xs font-bold text-foreground">{formatRupiah(payment.amount)}</p>
              <p className="text-[10px] text-muted-foreground">
                {getPaymentStatusLabel(payment.status)}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Fetch status history
  const statusHistory = await db
    .select()
    .from(bookingStatusHistories)
    .where(eq(bookingStatusHistories.bookingId, id))
    .orderBy(desc(bookingStatusHistories.changedAt));

  const [bastCustomerDocument] = await db
    .select({
      id: customerDocuments.id,
      status: customerDocuments.status,
      notes: customerDocuments.notes,
      fileName: attachments.fileName,
      fileUrl: attachments.fileUrl,
      mimeType: attachments.mimeType,
    })
    .from(customerDocuments)
    .innerJoin(attachments, eq(customerDocuments.attachmentId, attachments.id))
    .where(
      and(
        eq(customerDocuments.bookingId, id),
        eq(customerDocuments.documentType, "bast")
      )
    )
    .limit(1);

  // Dokumen dibaca per booking agar berkas KPR dari transaksi lain tidak
  // muncul pada booking Cash (dan sebaliknya).
  const custDocs = await db
    .select()
    .from(customerDocuments)
    .innerJoin(attachments, eq(customerDocuments.attachmentId, attachments.id))
    .where(eq(customerDocuments.bookingId, id))
    .orderBy(customerDocuments.uploadedAt);

  // Fetch active users for PIC selection
  const marketingsList = await db.select({
    id: userTable.id,
    name: userTable.name,
    roleName: rolesTable.name,
  })
  .from(userTable)
  .leftJoin(rolesTable, eq(userTable.roleId, rolesTable.id))
  .where(eq(userTable.status, "active"));

  const marketingUsers = marketingsList.filter(m =>
    m.roleName === "Marketing" || m.roleName === "Marketing Manager"
  );

  const canUploadProof = (session.isMarketing || session.isMarketingManager || session.isAdminKantor || session.isSuperAdmin) 
    && bookingData.status !== "cancelled";
  const isNonKprAkadStage = bookingData.paymentScheme !== "kpr"
    && (bookingData.status === "active" || bookingData.status === "akad");
  const canManageAkad = (session.isAdminKantor || session.isSuperAdmin) && isNonKprAkadStage;
  const isAkadMarked = bookingData.status === "akad";
  const akadReadiness = isNonKprAkadStage
    ? await getBookingAkadReadiness(id, isAkadMarked ? "akad" : "active")
    : null;
  const canAdvanceAkad = canManageAkad && !!akadReadiness?.eligible;
  const shouldShowAkadCard = isNonKprAkadStage;
  const akadBlockReason = !canManageAkad
    ? "Tahap Akad / PPJB hanya dapat diproses oleh Admin Kantor atau Super Admin."
    : akadReadiness?.reason || "Booking belum memenuhi syarat untuk Akad / PPJB.";
  const nextStepReadiness = await getBookingNextStepReadiness(id);
  const currentBookingAnchor = `/marketing/bookings/${id}#`;
  const nextStepAnchor = nextStepReadiness.href.startsWith(currentBookingAnchor)
    ? `#${nextStepReadiness.href.slice(currentBookingAnchor.length)}`
    : null;
  const canVerifyBast = session.isAdminKantor || session.isSuperAdmin || session.isDireksi;
  const canCompleteHandover = canVerifyBast
    && bookingData.status === "completed"
    && bookingData.unitStatus === "menunggu_serah_terima";
  const canRequestHandoverRevision = session.isSuperAdmin
    && bookingData.status === "completed"
    && bookingData.unitStatus === "handover_complete";
  const handoverNextStep = !bastCustomerDocument
    ? "Cetak BAST, minta tanda tangan Developer dan Konsumen, lalu unggah dokumennya."
    : bastCustomerDocument.status === "uploaded"
      ? "BAST sudah diunggah. Menunggu verifikasi dari Admin yang berwenang."
      : bastCustomerDocument.status === "rejected"
        ? "BAST perlu diperbaiki. Unggah BAST pengganti untuk diproses kembali."
        : "BAST telah terverifikasi. Lanjutkan dengan menyelesaikan serah terima unit.";

  const statusColorMap: Record<string, { bg: string; label: string; dot: string }> = {
    active:    { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: t("booking.status_active"), dot: "bg-emerald-500" },
    cancelled: { bg: "bg-rose-50 text-rose-700 border-rose-200", label: t("booking.status_cancelled"), dot: "bg-rose-500" },
    akad:      { bg: "bg-blue-50 text-blue-700 border-blue-200", label: t("booking.status_akad"), dot: "bg-blue-500" },
    completed: { bg: "bg-teal-50 text-teal-700 border-teal-200", label: t("booking.status_completed"), dot: "bg-teal-500" },
  };

  const schemeMap: Record<string, string> = { cash: t("booking.scheme_cash"), kpr: t("booking.scheme_kpr"), installment: t("booking.scheme_installment") };
  const statusStyle = statusColorMap[bookingData.status] || statusColorMap.active;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
<Link href="/marketing/bookings" className="flex items-center gap-1 hover:text-secondary-foreground transition-colors font-medium">
          <ArrowLeft className="h-4 w-4" />
          {t("booking_detail.back_to_list")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
        <span className="font-semibold text-foreground font-mono">{bookingData.bookingNumber}</span>
      </div>

      {/* ── PREMIUM HEADER ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-border rounded-2xl p-6 shadow-sage">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <FileText className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-black text-foreground tracking-tight font-mono">
                  {bookingData.bookingNumber}
                </h1>
                <Badge className={`border font-bold text-xs ${statusStyle.bg} flex items-center gap-1 rounded-full px-3 py-1`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                  {statusStyle.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-secondary-foreground" />
                  {bookingData.projectName}
                </span>
                <span className="text-muted-foreground/70">•</span>
                <span className="font-mono text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-bold">
                  {bookingData.unitCode}
                </span>
                <span className="text-muted-foreground/70">•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-secondary-foreground" />
                  {formatDate(bookingData.bookingDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 shrink-0">
            {(bookingData.status === "active" || bookingData.status === "akad" || bookingData.status === "completed") && (
              <a
                href={`/marketing/bookings/${id}/print`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-secondary-foreground hover:bg-secondary/30 text-sm font-semibold transition-all shadow-sm h-9"
              >
                <Printer className="h-4 w-4" />
                {t("booking_detail.print_sttb")}
              </a>
            )}
            {(() => {
              const isReady = bookingData.unitStatus === "menunggu_serah_terima" ||
                              bookingData.unitStatus === "handover_complete";
              return isReady ? (
                <a
                  href={`/marketing/bookings/${id}/bast/print`}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-500/50 bg-card text-emerald-700 hover:bg-emerald-50 text-sm font-semibold transition-all shadow-sm h-9"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  Cetak BAST Konsumen
                </a>
              ) : (
                <Button
                  disabled
                  title="BAST Konsumen baru dapat dicetak setelah Akad / PPJB atau Akad Kredit selesai dan unit memasuki tahap Menunggu Serah Terima."
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-sm font-semibold h-9 cursor-not-allowed opacity-60"
                >
                  <CheckCircle className="h-4 w-4 text-slate-300" />
                  Cetak BAST Konsumen (Belum Siap)
                </Button>
              );
            })()}
            {bookingData.status === "active" && (session.isMarketing || session.isMarketingManager || session.isAdminKantor || session.isSuperAdmin) && (
              <EditBookingDialog
                booking={bookingData as any}
                marketings={marketingUsers.length > 0 ? marketingUsers : marketingsList.filter(m => m.roleName?.includes("Marketing")) as any}
                currentUser={{ id: activeUser.id, name: activeUser.name || "" }}
                triggerButton={
                  <Button className="bg-primary hover:bg-[#3F5941] text-white font-bold rounded-xl px-3.5 py-2 flex items-center gap-1.5 shadow-[0_2px_8px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all text-xs h-9 shrink-0">
                    <Edit3 className="h-3.5 w-3.5" />
                    {t("booking_detail.edit_booking")}
                  </Button>
                }
              />
            )}
            {bookingData.status === "active" && (session.isMarketing || session.isAdminKantor || session.isSuperAdmin) && (
              <CancelBookingDialog booking={{
                id,
                bookingNumber: bookingData.bookingNumber,
                unitCode: bookingData.unitCode,
                status: bookingData.status,
                cancellationReason: bookingData.cancellationReason,
              }} />
            )}
          </div>
        </div>
      </div>

      {/* Grid: Detail + Riwayat */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Left: Main Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Konsumen & Unit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Konsumen Card */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sage">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-foreground text-sm">{t("booking_detail.consumer_title")}</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">{t("booking_detail.buyer_name")}</p>
                  <p className="font-bold text-foreground">{bookingData.customerName || "-"}</p>
                </div>
                {bookingData.customerPhone && (
                  <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">{t("booking_detail.phone_number")}</p>
                  <p className="font-mono text-foreground font-semibold">{bookingData.customerPhone}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">{t("booking_detail.marketing_pic")}</p>
                  <p className="font-semibold text-foreground">{bookingData.marketingName || "-"}</p>
                </div>
              </div>
            </div>

            {/* Unit Card */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sage">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-foreground text-sm">{t("booking_detail.unit_title")}</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">{t("booking_detail.unit_code")}</p>
                  <p className="font-mono font-black text-secondary-foreground text-lg">{bookingData.unitCode}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {bookingData.landArea && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">{t("booking_detail.land_area")}</p>
                      <p className="font-mono font-semibold text-foreground">{bookingData.landArea} m²</p>
                    </div>
                  )}
                  {bookingData.buildingArea && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">{t("booking_detail.building_area")}</p>
                      <p className="font-mono font-semibold text-foreground">{bookingData.buildingArea} m²</p>
                    </div>
                  )}
                </div>
                {bookingData.price && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">{t("booking_detail.unit_price")}</p>
                    <p className="font-mono font-bold text-foreground">{formatRupiah(bookingData.price)}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">Status Penjualan</p>
                  <span className="mt-0.5 inline-flex rounded-full border border-primary/20 bg-secondary/60 px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                    {nextStepReadiness.salesStatusLabel}
                  </span>
                </div>
                {/* Status fisik dan siap huni harus memakai sumber state unit yang sama dengan Siteplan. */}
                {bookingData.unitStatus && (() => {
                  const businessState = getUnitBusinessState({
                    status: bookingData.unitStatus,
                    isReadyStock: bookingData.unitIsReadyStock,
                    readyStockSource: bookingData.unitReadyStockSource as any,
                    currentBookingId: id,
                    constructionProgress: bookingData.unitConstructionProgress,
                  });
                  return (
                    <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">Status Fisik</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: businessState.isReadyStock ? "#4F6F52" : "#D9A514" }}
                        />
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-secondary/60 border-primary/20 text-secondary-foreground">
                          {businessState.displayLabel}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Pembayaran */}
          <div id="rincian-pembayaran" className="bg-card border border-border rounded-2xl p-5 shadow-sage scroll-mt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-foreground text-sm">{t("booking_detail.payment_title")}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-foreground/80">{t("booking_detail.booking_fee")}</p>
                  <p className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold ${bfAttachments.length > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                    {bfAttachments.length > 0 ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {bfAttachments.length > 0 ? "Bukti pembayaran terunggah" : "Bukti pembayaran belum diunggah"}
                  </p>
                </div>
                <span className="font-mono font-bold text-foreground">{formatRupiah(bookingData.bookingFee)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-foreground/80">{t("booking_detail.down_payment")}</p>
                  <p className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold ${dpAttachments.length > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                    {dpAttachments.length > 0 ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {dpAttachments.length > 0 ? "Bukti pembayaran terunggah" : "Bukti pembayaran belum diunggah"}
                  </p>
                </div>
                <span className="font-mono font-bold text-foreground">{formatRupiah(bookingData.dpAmount)}</span>
              </div>
              {cashSettlementInvoice && (
                <div className="flex justify-between items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground/80">Pelunasan Cash</p>
                    <p className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold ${cashSettlementAttachments.length > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                      {cashSettlementAttachments.length > 0 ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {cashSettlementAttachments.length > 0 ? "Bukti pembayaran terunggah" : "Bukti pembayaran belum diunggah"}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-foreground shrink-0">{formatRupiah(cashSettlementInvoice.amount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
                <span className="text-sm font-semibold text-muted-foreground">Total Nilai Tagihan</span>
                <span className="font-mono font-bold text-foreground">{formatRupiah(totalInvoiceAmount)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-secondary/40 rounded-xl border border-primary/20">
                <span className="text-sm font-bold text-foreground">Total Pembayaran Terverifikasi</span>
                <span className="font-mono font-black text-foreground text-base">
                  {formatRupiah(totalVerifiedPayment)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl">
                <span className="text-sm font-semibold text-foreground/80">Sisa Kewajiban</span>
                <span className="font-mono font-bold text-foreground">{formatRupiah(Math.max(0, totalInvoiceAmount - totalVerifiedPayment))}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl">
                <span className="text-sm font-semibold text-foreground/80">{t("booking_detail.payment_scheme")}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-bold text-muted-foreground border-border uppercase text-xs">
                    {schemeMap[bookingData.paymentScheme] ?? getPaymentSchemeLabel(bookingData.paymentScheme)}
                  </Badge>
                  {bookingData.paymentScheme === "installment" && bookingData.termin && (
                    <Badge className="bg-primary hover:bg-primary text-white font-bold text-xs rounded-full px-2 py-0.5">
                      {t("booking_detail.installment_term", { months: bookingData.termin })}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-secondary/70 via-card to-card p-5 shadow-sage">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-secondary-foreground">Tahap Berikutnya</p>
                <h2 className="mt-1 text-base font-bold text-foreground">{nextStepReadiness.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{nextStepReadiness.description}</p>
              </div>
              {nextStepAnchor ? (
                <a href={nextStepAnchor} className="inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto">
                  {nextStepReadiness.actionLabel}
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </a>
              ) : (
                <Link href={nextStepReadiness.href} className="inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto">
                  {nextStepReadiness.actionLabel}
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Link>
              )}
            </div>
            {nextStepReadiness.checks.length > 0 && (
              <div className="mt-4 grid gap-2 border-t border-primary/15 pt-4 sm:grid-cols-2">
                {nextStepReadiness.checks.map((check) => (
                  <div key={check.key} className={`flex items-center gap-2 text-xs font-medium ${check.passed ? "text-emerald-700" : "text-muted-foreground"}`}>
                    {check.passed ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0 text-amber-600" />}
                    <span>{check.label}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sprint 3: Serah Terima Info Cards */}
          {bookingData.unitStatus === "menunggu_serah_terima" && (
            <div className="bg-violet-50/70 border border-violet-200 rounded-2xl p-5 animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-bold text-violet-800 text-sm">Unit Siap Diserahterimakan</p>
                  <p className="text-xs text-violet-700 mt-0.5 leading-relaxed">
                    {handoverNextStep}
                  </p>
                  <a href="#bast-developer-konsumen" className="mt-3 inline-flex text-xs font-bold text-violet-800 underline underline-offset-2">
                    Buka dokumen BAST
                  </a>
                </div>
              </div>
            </div>
          )}

          {bookingData.unitStatus === "handover_complete" && (
            <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-5 animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="font-bold text-teal-800 text-sm">Serah Terima Selesai</p>
                  <p className="text-xs text-teal-700 mt-0.5 leading-relaxed">
                    Serah terima telah diselesaikan dan BAST Konsumen telah disetujui.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Akad / PPJB cash dan cicilan developer dilakukan dua langkah agar unit tidak meloncat tahap. */}
          {shouldShowAkadCard && (
            <div
              id="tahap-akad"
              className={`${canAdvanceAkad ? "bg-blue-50/50 border-blue-200" : "bg-amber-50/60 border-amber-200"} scroll-mt-6 border rounded-2xl p-5`}
            >
              <div className="flex items-start gap-3">
                <ShieldCheck className={`h-5 w-5 ${canAdvanceAkad ? "text-blue-600" : "text-amber-600"} shrink-0 mt-0.5`} />
                <div className="flex-1">
                  <p className={`font-bold text-sm ${canAdvanceAkad ? "text-blue-800" : "text-amber-800"}`}>
                    {isAkadMarked ? "Konfirmasi Penyelesaian Akad / PPJB" : t("booking_detail.akad_title")}
                  </p>
                  <p className={`text-xs mt-0.5 mb-3 ${canAdvanceAkad ? "text-blue-600" : "text-amber-700"}`}>
                    {canAdvanceAkad
                      ? isAkadMarked
                        ? "Akad / PPJB telah ditandai. Konfirmasikan setelah dokumen akad selesai agar unit masuk ke tahap Menunggu Serah Terima."
                        : "Tandai terlebih dahulu saat proses Akad / PPJB dimulai. Unit akan tetap pada tahap Booking sampai akad dikonfirmasi selesai."
                      : akadBlockReason}
                  </p>
                  <form
                    action={async () => {
                      "use server";
                      if (isAkadMarked) {
                        await completeAkadAction(id);
                        return;
                      }
                      await akadAction(id);
                    }}
                  >
                    <Button
                      type="submit"
                      disabled={!canAdvanceAkad}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl font-bold shadow-[0_2px_8px_rgba(37,99,235,0.25)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:border disabled:border-slate-200 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {isAkadMarked ? "Selesaikan Akad / PPJB" : t("booking_detail.akad_btn")}
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Dokumen dan riwayat di kolom utama supaya detail tidak menyisakan ruang kosong. */}
          {bookingData.customerId && (
            <div id="dokumen-konsumen" className="scroll-mt-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-foreground text-sm">
                  {bookingData.paymentScheme === "kpr"
                    ? "Berkas Pengajuan KPR"
                    : bookingData.paymentScheme === "installment"
                      ? "Dokumen Konsumen — Cash Bertahap"
                      : "Dokumen Konsumen — Cash"}
                </h3>
              </div>
              <CustomerDocumentsPanel
                customerId={bookingData.customerId}
                bookingId={id}
                paymentScheme={bookingData.paymentScheme as "cash" | "installment" | "kpr"}
                initialDocs={custDocs.filter((doc) => doc.customer_documents.documentType !== "bast") as any}
                canUpload={canUploadProof}
                canVerify={session.isAdminKantor || session.isSuperAdmin || session.isKeuangan || session.isDireksi}
              />
            </div>
          )}

          <div id="riwayat-status" className="bg-card border border-border rounded-2xl p-5 shadow-sage scroll-mt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-foreground text-sm">{t("booking_detail.history_title")}</h3>
            </div>

            {statusHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 text-center py-4 italic">{t("booking_detail.history_empty")}</p>
            ) : (
              <div className="space-y-3">
                {statusHistory.map((h, idx) => {
                  let statusIcon = <CheckCircle className="h-3 w-3 text-secondary-foreground" />;
                  let dotBg = "bg-primary/10 border-primary/50";

                  if (h.newStatus === "Doc Verified") {
                    statusIcon = <CheckCircle className="h-3 w-3 text-emerald-600" />;
                    dotBg = "bg-emerald-50 border-emerald-300";
                  } else if (h.newStatus === "Doc Rejected") {
                    statusIcon = <XCircle className="h-3 w-3 text-rose-600" />;
                    dotBg = "bg-rose-50 border-rose-300";
                  }

                  return (
                    <div key={h.id} className="relative flex gap-3">
                      {idx < statusHistory.length - 1 && (
                        <div className="absolute left-3 top-6 bottom-0 w-px bg-[#D6DED2]" />
                      )}
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 z-10 border-2 ${dotBg}`}>
                        {statusIcon}
                      </div>
                      <div className="pb-3 flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">
                          {h.previousStatus ? (
                            <>
                              <span className="text-muted-foreground">{h.previousStatus}</span>
                              <span className="mx-1 text-muted-foreground/70">→</span>
                              <span className="text-secondary-foreground">{h.newStatus}</span>
                            </>
                          ) : (
                            <span className="text-secondary-foreground">{h.newStatus}</span>
                          )}
                        </p>
                        {h.notes && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 italic">{h.notes}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                          {h.changedAt ? formatDate(h.changedAt) : "-"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Bukti pembayaran */}
        <div className="space-y-4">
          {/* Bukti Pembayaran Booking Fee (BF) */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sage space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center">
                <FilePlus className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-foreground text-sm">Bukti Pembayaran Booking Fee (BF)</h3>
              <span className="ml-auto text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-bold font-sans">
                {t("booking_detail.proof_count", { count: bfAttachments.length })}
              </span>
            </div>

            <BookingAttachmentsList
              bookingId={id}
              initialAttachments={bfAttachments as any}
              canDelete={canUploadProof}
            />

            {renderRecordedPayments(bookingFeePayments)}

            {canUploadProof && bfAttachments.length === 0 && (
              <BookingPaymentProofForm
                bookingId={id}
                paymentType="booking_fee"
                existingPaymentId={bookingFeePaymentWithoutProof?.id}
                invoiceId={bookingFeePaymentWithoutProof ? undefined : bookingFeeInvoice?.id}
              />
            )}
          </div>

          {/* Bukti Pembayaran Uang Muka (DP) */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sage space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center">
                <FilePlus className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-foreground text-sm">Bukti Pembayaran Uang Muka (DP)</h3>
              <span className="ml-auto text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-bold font-sans">
                {t("booking_detail.proof_count", { count: dpAttachments.length })}
              </span>
            </div>

            <BookingAttachmentsList
              bookingId={id}
              initialAttachments={dpAttachments as any}
              canDelete={canUploadProof}
            />

            {renderRecordedPayments(dpPayments)}

            {canUploadProof && dpAttachments.length === 0 && (
              <BookingPaymentProofForm
                bookingId={id}
                paymentType="dp"
                existingPaymentId={dpPaymentWithoutProof?.id}
                invoiceId={dpPaymentWithoutProof ? undefined : dpInvoice?.id}
              />
            )}
          </div>

          {/* Bukti Pelunasan Cash hanya untuk skema Cash dengan invoice valid */}
          {cashSettlementInvoice && (
            <div id="bukti-pelunasan-cash" className="bg-card border border-border rounded-2xl p-5 shadow-sage space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center">
                  <FilePlus className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-foreground text-sm">Bukti Pelunasan Cash</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {cashSettlementInvoice.scheduleLabel || "Pelunasan Cash"} · {formatRupiah(cashSettlementInvoice.amount)}
                  </p>
                </div>
                <span className="ml-auto text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-bold font-sans">
                  {t("booking_detail.proof_count", { count: cashSettlementAttachments.length })}
                </span>
              </div>

              <BookingAttachmentsList
                bookingId={id}
                initialAttachments={cashSettlementAttachments as any}
                canDelete={canUploadProof}
              />

              {cashSettlementPayments.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border">
                  {cashSettlementPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pembayaran tercatat</p>
                        <Link
                          href={"/finance/payments/" + payment.id}
                          className="font-mono text-xs font-bold text-secondary-foreground hover:underline"
                        >
                          {payment.paymentNumber}
                        </Link>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-xs font-bold text-foreground">{formatRupiah(payment.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {getPaymentStatusLabel(payment.status)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canUploadProof && cashSettlementPaymentWithoutProof ? (
                <BookingPaymentProofForm
                  bookingId={id}
                  paymentType="cash_settlement"
                  existingPaymentId={cashSettlementPaymentWithoutProof.id}
                />
              ) : canUploadProof && cashSettlementInvoice.status !== "paid" ? (
                <BookingPaymentProofForm
                  bookingId={id}
                  paymentType="cash_settlement"
                  invoiceId={cashSettlementInvoice.id}
                />
              ) : null}
            </div>
          )}

          {/* Jadwal Termin — hanya untuk skema Cash Bertahap (installment) */}
          {installmentInvoices.length > 0 && (
            <div id="jadwal-termin" className="bg-card border border-border rounded-2xl p-5 shadow-sage space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center">
                  <FilePlus className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-foreground text-sm">Jadwal Termin (Cash Bertahap)</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Bayar termin berurutan. Termin berikutnya aktif setelah termin sebelumnya lunas.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {installmentInvoices.map((termin, index) => {
                  const terminPayments = installmentPaymentsByInvoice.get(termin.id) ?? [];
                  const paymentWithoutProof = terminPayments.find(
                    (payment) => payment.status !== "voided" && !payment.proofAttachmentId
                  );
                  const isPaid = termin.status === "paid";
                  const isCurrent = index === firstUnpaidInstallmentIndex;
                  const isLocked = !isPaid && !isCurrent;
                  return (
                    <div
                      key={termin.id}
                      className={`rounded-xl border p-3 space-y-2 ${isPaid ? "border-emerald-200 bg-emerald-50/40" : isCurrent ? "border-primary/40 bg-secondary/30" : "border-border bg-muted/20"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-foreground text-xs">
                            {termin.scheduleLabel || `Termin ${termin.scheduleSequence ?? index + 1}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {termin.dueDate ? `Jatuh tempo ${new Date(termin.dueDate).toLocaleDateString("id-ID")}` : "Tanpa jatuh tempo"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-xs font-bold text-foreground">{formatRupiah(termin.amount)}</p>
                          <p className={`text-[10px] font-semibold ${isPaid ? "text-emerald-700" : isLocked ? "text-muted-foreground" : "text-secondary-foreground"}`}>
                            {isPaid ? "Lunas" : isLocked ? "Terkunci" : termin.status === "partial" ? "Sebagian" : "Belum dibayar"}
                          </p>
                        </div>
                      </div>

                      {terminPayments.length > 0 && (
                        <div className="rounded-lg border border-border bg-card divide-y divide-border">
                          {terminPayments.map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between gap-3 p-2">
                              <Link href={"/finance/payments/" + payment.id} className="font-mono text-[11px] font-bold text-secondary-foreground hover:underline">
                                {payment.paymentNumber}
                              </Link>
                              <div className="text-right shrink-0">
                                <p className="font-mono text-[11px] font-bold text-foreground">{formatRupiah(payment.amount)}</p>
                                <p className="text-[9px] text-muted-foreground">
                                  {getPaymentStatusLabel(payment.status)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {canUploadProof && !isPaid && !isLocked && (
                        paymentWithoutProof ? (
                          <BookingPaymentProofForm
                            bookingId={id}
                            paymentType="installment"
                            existingPaymentId={paymentWithoutProof.id}
                          />
                        ) : (
                          <BookingPaymentProofForm
                            bookingId={id}
                            paymentType="installment"
                            invoiceId={termin.id}
                          />
                        )
                      )}
                      {isLocked && (
                        <p className="text-[10px] text-muted-foreground italic">
                          Selesaikan termin sebelumnya terlebih dahulu.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(bookingData.unitStatus === "menunggu_serah_terima" || bookingData.unitStatus === "handover_complete") && (
            <div id="bast-developer-konsumen" className="scroll-mt-6">
              <BastConsumerCard
                bookingId={id}
                customerId={bookingData.customerId}
                document={bastCustomerDocument || null}
                canUpload={canUploadProof}
                canVerify={canVerifyBast}
                canCompleteHandover={canCompleteHandover}
                canRequestRevision={canRequestHandoverRevision}
                handoverComplete={bookingData.unitStatus === "handover_complete"}
              />
            </div>
          )}

          {false && (
          /* Riwayat status lama telah dipindahkan ke kolom utama. */
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sage">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-foreground text-sm">{t("booking_detail.history_title")}</h3>
            </div>

            {statusHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 text-center py-4 italic">{t("booking_detail.history_empty")}</p>
            ) : (
              <div className="space-y-3">
                {statusHistory.map((h, idx) => {
                  let statusIcon = <CheckCircle className="h-3 w-3 text-secondary-foreground" />;
                  let dotBg = "bg-primary/10 border-primary/50";

                  if (h.newStatus === "Doc Verified") {
                    statusIcon = <CheckCircle className="h-3 w-3 text-emerald-600" />;
                    dotBg = "bg-emerald-50 border-emerald-300";
                  } else if (h.newStatus === "Doc Rejected") {
                    statusIcon = <XCircle className="h-3 w-3 text-rose-600" />;
                    dotBg = "bg-rose-50 border-rose-300";
                  }

                  return (
                    <div key={h.id} className="relative flex gap-3">
                      {idx < statusHistory.length - 1 && (
                        <div className="absolute left-3 top-6 bottom-0 w-px bg-[#D6DED2]" />
                      )}
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 z-10 border-2 ${dotBg}`}>
                        {statusIcon}
                      </div>
                      <div className="pb-3 flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">
                          {h.previousStatus ? (
                            <>
                              <span className="text-muted-foreground">{h.previousStatus}</span>
                              <span className="mx-1 text-muted-foreground/70">→</span>
                              <span className="text-secondary-foreground">{h.newStatus}</span>
                            </>
                          ) : (
                            <span className="text-secondary-foreground">{h.newStatus}</span>
                          )}
                        </p>
                        {h.notes && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 italic">{h.notes}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                          {h.changedAt ? formatDate(h.changedAt) : "-"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
