import { db } from "@/db";
import { bookings as bookingsTable, bookingStatusHistories, customerDocuments } from "@/db/schema/marketing";
import { projects as projectsTable, units as unitsTable, customers as customersTable } from "@/db/schema/master";
import { user as userTable } from "@/db/schema/auth";
import { roles as rolesTable } from "@/db/schema/access";
import { attachments } from "@/db/schema/system";
import { desc, eq, and, inArray } from "drizzle-orm";
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
import { akadAction } from "./akad-action";
import { formatRupiah, formatDate } from "@/lib/format-utils";
import { CustomerDocumentsPanel } from "@/components/customer-documents-panel";
import BookingAttachmentsList from "./attachments-list";
import { getI18n } from "@/lib/i18n-server";
import { getStatusBadge } from "@/lib/siteplan-utils";

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
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-[#4F6F52]/10 blur-3xl pointer-events-none animate-pulse duration-[10000ms]" />
        
        <div className="relative max-w-md w-full bg-white/80 backdrop-blur-md border border-[#D6DED2] rounded-3xl p-8 shadow-sage-lg text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="mx-auto h-20 w-20 rounded-3xl bg-rose-50 border border-rose-100 flex items-center justify-center shadow-[0_8px_30px_rgb(244,63,94,0.08)] mb-6">
            <ShieldAlert className="h-10 w-10 text-rose-500 animate-bounce duration-[2000ms]" />
          </div>
          
          <h1 className="text-2xl font-black text-[#243028] tracking-tight mb-2">
            {t("booking_detail.unauthorized_title")}
          </h1>
          <p className="text-sm text-[#66736A] leading-relaxed mb-8">
            {t("booking_detail.unauthorized_desc")}
          </p>
          
          <div className="flex flex-col gap-2">
            <Link href="/marketing/bookings" className="w-full">
              <Button className="w-full bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-10 rounded-xl font-bold text-xs">
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
        inArray(attachments.entityType, ["booking", "booking_bf", "booking_dp"])
      )
    )
    .orderBy(desc(attachments.createdAt));

  const bfAttachments = bookingAttachments.filter(
    (att) => att.entityType === "booking_bf" || att.entityType === "booking"
  );
  const dpAttachments = bookingAttachments.filter(
    (att) => att.entityType === "booking_dp"
  );

  // Fetch status history
  const statusHistory = await db
    .select()
    .from(bookingStatusHistories)
    .where(eq(bookingStatusHistories.bookingId, id))
    .orderBy(desc(bookingStatusHistories.changedAt));

  // Fetch customer documents
  const custDocs = await db
    .select()
    .from(customerDocuments)
    .innerJoin(attachments, eq(customerDocuments.attachmentId, attachments.id))
    .where(eq(customerDocuments.customerId, bookingData.customerId))
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
  const canUpgradeToAkad = (session.isAdminKantor || session.isSuperAdmin) && bookingData.status === "active";

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
      <div className="flex items-center gap-2 text-sm text-[#66736A]">
        <Link href="/marketing/bookings" className="flex items-center gap-1 hover:text-[#4F6F52] transition-colors font-medium">
          <ArrowLeft className="h-4 w-4" />
          {t("booking_detail.back_to_list")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-[#A8B0AA]" />
        <span className="font-semibold text-[#243028] font-mono">{bookingData.bookingNumber}</span>
      </div>

      {/* ── PREMIUM HEADER ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] rounded-2xl p-6 shadow-sage">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-[#4F6F52] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <FileText className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-black text-[#243028] tracking-tight font-mono">
                  {bookingData.bookingNumber}
                </h1>
                <Badge className={`border font-bold text-xs ${statusStyle.bg} flex items-center gap-1 rounded-full px-3 py-1`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                  {statusStyle.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-[#66736A]">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-[#8FAF9A]" />
                  {bookingData.projectName}
                </span>
                <span className="text-[#A8B0AA]">•</span>
                <span className="font-mono text-xs bg-[#DDE8D8] text-[#4F6F52] px-2 py-0.5 rounded font-bold">
                  {bookingData.unitCode}
                </span>
                <span className="text-[#A8B0AA]">•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-[#8FAF9A]" />
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
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#D6DED2] bg-white text-[#66736A] hover:text-[#4F6F52] hover:bg-[#DDE8D8]/30 text-sm font-semibold transition-all shadow-sm h-9"
              >
                <Printer className="h-4 w-4" />
                {t("booking_detail.print_sttb")}
              </a>
            )}
            {(() => {
              const isReady = bookingData.unitStatus === "construction_done" || 
                              bookingData.unitStatus === "sold" || 
                              bookingData.unitStatus === "menunggu_serah_terima" || 
                              bookingData.unitStatus === "handover_complete";
              return isReady ? (
                <a
                  href={`/marketing/bookings/${id}/bast/print`}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-500/50 bg-white text-emerald-700 hover:bg-emerald-50 text-sm font-semibold transition-all shadow-sm h-9"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  Cetak BAST Konsumen
                </a>
              ) : (
                <Button
                  disabled
                  title="Fisik unit pembangunan belum selesai 100% dari Vendor (Status unit harus 'Selesai Bangun')."
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
                  <Button className="bg-[#4F6F52] hover:bg-[#3F5941] text-white font-bold rounded-xl px-3.5 py-2 flex items-center gap-1.5 shadow-[0_2px_8px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all text-xs h-9 shrink-0">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Konsumen & Unit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Konsumen Card */}
            <div className="bg-white border border-[#D6DED2] rounded-2xl p-5 shadow-sage">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-[#243028] text-sm">{t("booking_detail.consumer_title")}</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8FAF9A]">{t("booking_detail.buyer_name")}</p>
                  <p className="font-bold text-[#243028]">{bookingData.customerName || "-"}</p>
                </div>
                {bookingData.customerPhone && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8FAF9A]">{t("booking_detail.phone_number")}</p>
                    <p className="font-mono text-[#4F6F52] font-semibold">{bookingData.customerPhone}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8FAF9A]">{t("booking_detail.marketing_pic")}</p>
                  <p className="font-semibold text-[#243028]">{bookingData.marketingName || "-"}</p>
                </div>
              </div>
            </div>

            {/* Unit Card */}
            <div className="bg-white border border-[#D6DED2] rounded-2xl p-5 shadow-sage">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-[#243028] text-sm">{t("booking_detail.unit_title")}</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8FAF9A]">{t("booking_detail.unit_code")}</p>
                  <p className="font-mono font-black text-[#4F6F52] text-lg">{bookingData.unitCode}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {bookingData.landArea && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8FAF9A]">{t("booking_detail.land_area")}</p>
                      <p className="font-mono font-semibold text-[#243028]">{bookingData.landArea} m²</p>
                    </div>
                  )}
                  {bookingData.buildingArea && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8FAF9A]">{t("booking_detail.building_area")}</p>
                      <p className="font-mono font-semibold text-[#243028]">{bookingData.buildingArea} m²</p>
                    </div>
                  )}
                </div>
                {bookingData.price && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8FAF9A]">{t("booking_detail.unit_price")}</p>
                    <p className="font-mono font-bold text-[#4F6F52]">{formatRupiah(bookingData.price)}</p>
                  </div>
                )}
                {/* Sprint 3: Unit status badge — pakai getStatusBadge dari siteplan-utils agar konsisten */}
                {bookingData.unitStatus && (() => {
                  const badge = getStatusBadge(bookingData.unitStatus!, false, t);
                  return (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8FAF9A]">Status Unit</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: badge.dotColor }}
                        />
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badge.badgeClass || "bg-slate-50"}`}>
                          {badge.label ?? bookingData.unitStatus}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Pembayaran */}
          <div className="bg-white border border-[#D6DED2] rounded-2xl p-5 shadow-sage">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-[#243028] text-sm">{t("booking_detail.payment_title")}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-[#F7F8F3] rounded-xl">
                <span className="text-sm font-semibold text-[#66736A]">{t("booking_detail.booking_fee")}</span>
                <span className="font-mono font-bold text-[#4F6F52]">{formatRupiah(bookingData.bookingFee)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#F7F8F3] rounded-xl">
                <span className="text-sm font-semibold text-[#66736A]">{t("booking_detail.down_payment")}</span>
                <span className="font-mono font-bold text-[#4F6F52]">{formatRupiah(bookingData.dpAmount)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#DDE8D8]/40 rounded-xl border border-[#8FAF9A]/20">
                <span className="text-sm font-bold text-[#243028]">{t("booking_detail.total_paid")}</span>
                <span className="font-mono font-black text-[#4F6F52] text-base">
                  {formatRupiah(bookingData.bookingFee + bookingData.dpAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl">
                <span className="text-sm font-semibold text-[#66736A]">{t("booking_detail.payment_scheme")}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-bold text-[#66736A] border-[#D6DED2] uppercase text-xs">
                    {schemeMap[bookingData.paymentScheme] || bookingData.paymentScheme}
                  </Badge>
                  {bookingData.paymentScheme === "installment" && bookingData.termin && (
                    <Badge className="bg-[#4F6F52] hover:bg-[#4F6F52] text-white font-bold text-xs rounded-full px-2 py-0.5">
                      {t("booking_detail.installment_term", { months: bookingData.termin })}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>



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
                    Seluruh kewajiban pembayaran telah diselesaikan. Unit siap dijadwalkan untuk proses serah terima kepada konsumen.
                  </p>
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

          {/* Upgrade ke Akad */}
          {canUpgradeToAkad && (
            <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-blue-800 text-sm">{t("booking_detail.akad_title")}</p>
                  <p className="text-xs text-blue-600 mt-0.5 mb-3">
                    {t("booking_detail.akad_desc")}
                  </p>
                  <form
                    action={async () => {
                      "use server";
                      await akadAction(id);
                    }}
                  >
                    <Button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl font-bold shadow-[0_2px_8px_rgba(37,99,235,0.25)] hover:scale-[1.01] active:scale-[0.98] transition-all"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t("booking_detail.akad_btn")}
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Bukti Bayar + Status History */}
        <div className="space-y-6">
          {/* Bukti Pembayaran Booking Fee (BF) */}
          <div className="bg-white border border-[#D6DED2] rounded-2xl p-5 shadow-sage space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center">
                <FilePlus className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-[#243028] text-sm">Bukti Pembayaran Booking Fee (BF)</h3>
              <span className="ml-auto text-xs bg-[#DDE8D8] text-[#4F6F52] px-2 py-0.5 rounded-full font-bold font-sans">
                {t("booking_detail.proof_count", { count: bfAttachments.length })}
              </span>
            </div>

            <BookingAttachmentsList
              bookingId={id}
              initialAttachments={bfAttachments as any}
            />

            {canUploadProof && (
              <BookingPaymentProofForm bookingId={id} paymentType="booking_fee" />
            )}
          </div>

          {/* Bukti Pembayaran Uang Muka (DP) */}
          <div className="bg-white border border-[#D6DED2] rounded-2xl p-5 shadow-sage space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center">
                <FilePlus className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-[#243028] text-sm">Bukti Pembayaran Uang Muka (DP)</h3>
              <span className="ml-auto text-xs bg-[#DDE8D8] text-[#4F6F52] px-2 py-0.5 rounded-full font-bold font-sans">
                {t("booking_detail.proof_count", { count: dpAttachments.length })}
              </span>
            </div>

            <BookingAttachmentsList
              bookingId={id}
              initialAttachments={dpAttachments as any}
            />

            {canUploadProof && (
              <BookingPaymentProofForm bookingId={id} paymentType="dp" />
            )}
          </div>

          {/* Dokumen Konsumen KPR */}
          {bookingData.customerId && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-[#243028] text-sm">{t("booking_detail.kpr_title")}</h3>
              </div>
              <CustomerDocumentsPanel
                customerId={bookingData.customerId}
                bookingId={id}
                initialDocs={custDocs as any}
                canUpload={canUploadProof}
                canVerify={session.isAdminKantor || session.isSuperAdmin || session.isKeuangan || session.isDireksi}
              />
            </div>
          )}

          {/* Riwayat Status */}
          <div className="bg-white border border-[#D6DED2] rounded-2xl p-5 shadow-sage">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-[#243028] text-sm">{t("booking_detail.history_title")}</h3>
            </div>

            {statusHistory.length === 0 ? (
              <p className="text-xs text-[#A8B0AA] text-center py-4 italic">{t("booking_detail.history_empty")}</p>
            ) : (
              <div className="space-y-3">
                {statusHistory.map((h, idx) => {
                  let statusIcon = <CheckCircle className="h-3 w-3 text-[#4F6F52]" />;
                  let dotBg = "bg-[#4F6F52]/10 border-[#8FAF9A]";

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
                        <p className="text-xs font-bold text-[#243028]">
                          {h.previousStatus ? (
                            <>
                              <span className="text-[#66736A]">{h.previousStatus}</span>
                              <span className="mx-1 text-[#A8B0AA]">→</span>
                              <span className="text-[#4F6F52]">{h.newStatus}</span>
                            </>
                          ) : (
                            <span className="text-[#4F6F52]">{h.newStatus}</span>
                          )}
                        </p>
                        {h.notes && (
                          <p className="text-[10px] text-[#66736A] mt-0.5 italic">{h.notes}</p>
                        )}
                        <p className="text-[10px] text-[#A8B0AA] font-mono mt-0.5">
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
      </div>
    </div>
  );
}
