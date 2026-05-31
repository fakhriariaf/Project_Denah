import { db } from "@/db";
import { bookings as bookingsTable, leads as leadsTable } from "@/db/schema/marketing";
import { projects as projectsTable, units as unitsTable, customers as customersTable } from "@/db/schema/master";
import { user as userTable } from "@/db/schema/auth";
import { roles as rolesTable } from "@/db/schema/access";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  Layers, 
  AlertTriangle, 
  Calendar,
  CheckCircle,
  FileText,
  ShieldAlert,
} from "lucide-react";
// Local components
import CancelBookingDialog from "@/app/marketing/bookings/cancel-booking-dialog";
import AddBookingDialog from "@/app/marketing/bookings/add-booking-dialog";
import EditBookingDialog from "@/app/marketing/bookings/edit-booking-dialog";
import { BookingIconLink } from "@/app/marketing/bookings/booking-icon-link";
import { SearchInput } from "@/components/ui/search-input";
import { formatRupiah, formatDate } from "@/lib/format-utils";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { requireAuth, getSessionRole } from "@/server/permissions";
import { Translate } from "@/components/translate";

export const revalidate = 0;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; mine?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const statusFilter = params.status || "";
  const page = params.page || "";
  const mineFilter = params.mine === "1";
  const currentPage = Number(page) || 1;
  const itemsPerPage = 20;

  // 0. Auth + RBAC
  const activeUser = await requireAuth();
  const sessionRoleInfo = await getSessionRole(activeUser.id);
  
  // Marketing Biasa hanya lihat booking miliknya
  const isBiasaRole = sessionRoleInfo.isMarketing && 
    !sessionRoleInfo.isMarketingManager && 
    !sessionRoleInfo.isAdminKantor && 
    !sessionRoleInfo.isSuperAdmin;

  // 1. Fetch Bookings with relational details
  const [allBookings, projectsList, unitsList, customersList, marketingsList, leadsList] = await Promise.all([
    db.select({
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
      termin: bookingsTable.termin,
      projectName: projectsTable.name,
      unitCode: unitsTable.code,
      customerName: customersTable.name,
      marketingName: userTable.name,
    })
    .from(bookingsTable)
    .leftJoin(projectsTable, eq(bookingsTable.projectId, projectsTable.id))
    .leftJoin(unitsTable, eq(bookingsTable.unitId, unitsTable.id))
    .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
    .leftJoin(userTable, eq(bookingsTable.marketingId, userTable.id))
    .orderBy(desc(bookingsTable.bookingDate)),

    db.select().from(projectsTable),
    db.select({
      id: unitsTable.id,
      code: unitsTable.code,
      projectId: unitsTable.projectId,
      price: unitsTable.price,
      status: unitsTable.status,
    }).from(unitsTable).where(eq(unitsTable.status, "available")),
    db.select({ id: customersTable.id, name: customersTable.name, phone: customersTable.phone }).from(customersTable),
    db.select({
      id: userTable.id,
      name: userTable.name,
      roleName: rolesTable.name,
    })
    .from(userTable)
    .leftJoin(rolesTable, eq(userTable.roleId, rolesTable.id))
    .where(eq(userTable.status, "active")),
    db.select({
      id: leadsTable.id,
      name: leadsTable.name,
      phone: leadsTable.phone,
      status: leadsTable.status,
      assignedMarketingId: leadsTable.assignedMarketingId,
    }).from(leadsTable),
  ]);

  // Only show marketing roles in PIC dropdown
  const marketingUsers = marketingsList.filter(m =>
    m.roleName === "Marketing" || m.roleName === "Marketing Manager"
  );

  // 2. RBAC Scope: Marketing Biasa hanya lihat booking miliknya
  let scopedBookings = allBookings;
  if (isBiasaRole) {
    scopedBookings = allBookings.filter(b => b.marketingId === activeUser.id);
  } else if (mineFilter) {
    scopedBookings = allBookings.filter(b => b.marketingId === activeUser.id);
  }

  // 3. Filter bookings
  const filteredBookings = scopedBookings.filter(booking => {
    const bookingNum = booking.bookingNumber || "";
    const custName = booking.customerName || "";
    const uCode = booking.unitCode || "";
    const pName = booking.projectName || "";

    const matchesSearch = q === "" || 
      bookingNum.toLowerCase().includes(q.toLowerCase()) || 
      custName.toLowerCase().includes(q.toLowerCase()) || 
      uCode.toLowerCase().includes(q.toLowerCase()) ||
      pName.toLowerCase().includes(q.toLowerCase());
      
    const matchesStatus = statusFilter === "" || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalFilteredItems = filteredBookings.length;
  const paginatedBookings = filteredBookings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Calculate Metrics (from scoped data)
  const totalBookings = scopedBookings.length;
  const activeBookingsCount = scopedBookings.filter(b => b.status === "active").length;
  const cancelledBookingsCount = scopedBookings.filter(b => b.status === "cancelled").length;
  const totalAkadCount = scopedBookings.filter(b => b.status === "completed").length;
  const totalRevenue = scopedBookings
    .filter(b => b.status !== "cancelled")
    .reduce((acc, curr) => acc + curr.bookingFee + curr.dpAmount, 0);

  // RBAC Permissions
  const canCancel = sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor || 
                    sessionRoleInfo.isMarketing || sessionRoleInfo.isMarketingManager;
  const canAdd = sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor ||
                 sessionRoleInfo.isMarketing || sessionRoleInfo.isMarketingManager;

  const statusColorMap: Record<string, { bg: string; label: string }> = {
    active: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Aktif" },
    cancelled: { bg: "bg-rose-50 text-rose-700 border-rose-200", label: "Batal" },
    akad: { bg: "bg-blue-50 text-blue-700 border-blue-200", label: "Akad" },
    completed: { bg: "bg-teal-50 text-teal-700 border-teal-200", label: "Akad Kredit" },
  };

  const schemeMap: Record<string, string> = {
    cash: "Cash",
    kpr: "KPR",
    installment: "Cash Bertahap",
  };

  const statusFilterOptions = [
    { value: "", label: "status_all" },
    { value: "active", label: "status_active" },
    { value: "akad", label: "status_akad" },
    { value: "completed", label: "status_completed" },
    { value: "cancelled", label: "status_cancelled" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ── PREMIUM HEADER ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] rounded-2xl p-6 shadow-sage animate-in fade-in duration-500">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 h-20 w-20 rounded-full bg-[#4F6F52]/5 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#243028] tracking-tight font-inter">
                <Translate namespace="booking" translationKey="title" />
              </h1>
              <p className="text-sm text-[#66736A] mt-0.5 flex items-center gap-2">
                <Translate namespace="booking" translationKey="subtitle" />
                {isBiasaRole && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#4F6F52] bg-[#DDE8D8] px-2 py-0.5 rounded-full font-semibold">
                    <ShieldAlert className="h-3 w-3" />
                    <Translate namespace="booking" translationKey="showing_mine" />
                  </span>
                )}
              </p>
            </div>
          </div>
          {canAdd && (
            <AddBookingDialog
              projects={projectsList}
              units={unitsList}
              customers={customersList}
              leads={leadsList}
              marketings={marketingUsers.length > 0 ? marketingUsers : marketingsList.filter(m => m.roleName?.includes("Marketing"))}
              currentUser={{ id: activeUser.id, name: activeUser.name || "" }}
            />
          )}
        </div>
      </div>

      {/* ── KPI METRIC CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white border-l-4 border-l-[#4F6F52] border border-[#D6DED2] rounded-2xl shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="p-5 flex items-center justify-between">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="booking" translationKey="total_revenue" /></p>
              <h3 className="text-base font-black font-mono tracking-tight text-[#4F6F52] tabular-nums truncate">
                {formatRupiah(totalRevenue)}
              </h3>
            </div>
            <div className="h-10 w-10 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Active Bookings */}
        <div className="bg-white border-l-4 border-l-sky-500 border border-[#D6DED2] rounded-2xl shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="booking" translationKey="active_bookings" /></p>
              <h3 className="text-2xl font-black font-mono text-[#243028] tabular-nums">{activeBookingsCount}</h3>
            </div>
            <div className="h-10 w-10 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Layers className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Cancelled */}
        <div className="bg-white border-l-4 border-l-rose-500 border border-[#D6DED2] rounded-2xl shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="booking" translationKey="cancelled" /></p>
              <h3 className="text-2xl font-black font-mono text-rose-700 tabular-nums">{cancelledBookingsCount}</h3>
            </div>
            <div className="h-10 w-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Akad Selesai */}
        <div className="bg-white border-l-4 border-l-emerald-500 border border-[#D6DED2] rounded-2xl shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="booking" translationKey="completed" /></p>
              <h3 className="text-2xl font-black font-mono text-emerald-700 tabular-nums">{totalAkadCount}</h3>
            </div>
            <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH ── */}
      <div className="bg-white/70 backdrop-blur-md border border-[#D6DED2] rounded-2xl p-4 shadow-sage">
        <form method="GET" className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
              <SearchInput
                i18nKey="booking.search_placeholder"
                name="q"
                defaultValue={q}
              />
            <Button
              type="submit"
              className="w-full md:w-auto h-10 px-5 bg-[#4F6F52] hover:bg-[#3F5941] text-white rounded-xl font-semibold text-sm shadow-[0_2px_8px_rgba(79,111,82,0.25)]"
            >
              <Translate namespace="action" translationKey="search" />
            </Button>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[#D6DED2]/40">
            {/* "Booking Saya" filter - only for non-Biasa */}
            {!isBiasaRole && (
              <a
                href={`?${new URLSearchParams({ ...(q ? { q } : {}), ...(statusFilter ? { status: statusFilter } : {}), ...(mineFilter ? {} : { mine: "1" }) }).toString()}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 whitespace-nowrap flex items-center gap-1
                  ${mineFilter
                    ? "bg-[#4F6F52] text-white border-[#4F6F52] shadow-[0_2px_8px_rgba(79,111,82,0.3)]"
                    : "bg-white text-[#66736A] border-[#D6DED2] hover:border-[#8FAF9A] hover:text-[#4F6F52] hover:bg-[#DDE8D8]/30"
                  }`}
              >
                <ShieldAlert className="h-3 w-3" />
                {mineFilter ? <Translate namespace="booking" translationKey="filter_mine_active" /> : <Translate namespace="booking" translationKey="filter_mine" />}
              </a>
            )}

            {statusFilterOptions.map((opt) => (
              <a
                key={opt.value}
                href={`?${new URLSearchParams({ ...(q ? { q } : {}), ...(opt.value ? { status: opt.value } : {}), ...(mineFilter ? { mine: "1" } : {}) }).toString()}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 whitespace-nowrap
                  ${statusFilter === opt.value || (opt.value === "" && !statusFilter)
                    ? "bg-[#4F6F52] text-white border-[#4F6F52] shadow-[0_2px_8px_rgba(79,111,82,0.3)]"
                    : "bg-white text-[#66736A] border-[#D6DED2] hover:border-[#8FAF9A] hover:text-[#4F6F52] hover:bg-[#DDE8D8]/30"
                  }`}
              >
                <Translate namespace="booking" translationKey={opt.label as any} />
              </a>
            ))}
          </div>
        </form>
      </div>

      {/* ── DATA TABLE ── */}
      <div className="bg-white border border-[#D6DED2] rounded-2xl shadow-sage overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-3.5 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#66736A] uppercase tracking-wider">
              <Translate namespace="booking" translationKey="list_title" />
              {mineFilter && !isBiasaRole && (
                <span className="ml-2 text-[#4F6F52] bg-[#DDE8D8] px-2 py-0.5 rounded-full normal-case font-semibold">
                  <Translate namespace="booking" translationKey="filter_mine" />
                </span>
              )}
            </span>
            <span className="text-xs font-mono text-[#8FAF9A] tabular-nums">
              <Translate namespace="booking" translationKey="list_subtitle" values={{ filtered: filteredBookings.length.toString(), total: totalBookings.toString() }} />
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#D6DED2] text-[#66736A] text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-6"><Translate namespace="booking" translationKey="col_number" /></th>
                <th className="py-3.5 px-6"><Translate namespace="booking" translationKey="col_customer_unit" /></th>
                <th className="py-3.5 px-6"><Translate namespace="booking" translationKey="col_marketing" /></th>
                <th className="py-3.5 px-6 text-right"><Translate namespace="booking" translationKey="col_amount" /></th>
                <th className="py-3.5 px-6 text-center"><Translate namespace="booking" translationKey="col_scheme" /></th>
                <th className="py-3.5 px-6 text-center"><Translate namespace="booking" translationKey="col_status" /></th>
                <th className="py-3.5 px-6 text-right"><Translate namespace="booking" translationKey="col_action" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DED2]/60 text-sm">
              {paginatedBookings.length > 0 ? (
                paginatedBookings.map((booking) => {
                  const initials = (booking.customerName || "TN").slice(0, 2).toUpperCase();
                  const statusStyle = statusColorMap[booking.status];
                  return (
                    <tr key={booking.id} className="hover:bg-[#F7F8F3]/80 transition-colors duration-150 group">
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[#243028] font-mono text-[13px]">
                            {booking.bookingNumber || "-"}
                          </div>
                          <div className="flex items-center text-xs text-[#66736A]">
                            <Calendar className="h-3 w-3 mr-1 text-[#8FAF9A]" />
                            <span className="font-mono">{formatDate(booking.bookingDate)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center font-bold text-xs shrink-0 border border-[#8FAF9A]/20">
                            {initials}
                          </div>
                          <div className="space-y-0.5">
                            <div className="font-semibold text-[#243028] text-sm">
                              {booking.customerName || <Translate namespace="booking" translationKey="no_name" />}
                            </div>
                            <div className="text-xs text-[#66736A] flex items-center gap-1.5">
                              <span>{booking.projectName}</span>
                              <span className="text-[#A8B0AA]">•</span>
                              <span className="font-mono bg-[#DDE8D8]/60 text-[#4F6F52] px-1.5 py-0.5 rounded text-[10px] font-semibold border border-[#8FAF9A]/20">
                                {booking.unitCode || "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          {booking.marketingName ? (
                            <>
                              <div className="h-6 w-6 rounded-full bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center text-[9px] font-bold shrink-0">
                                {booking.marketingName.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-[#243028]">{booking.marketingName}</span>
                            </>
                          ) : (
                            <span className="text-xs text-[#A8B0AA] italic"><Translate namespace="booking" translationKey="unassigned_marketing" /></span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="space-y-0.5">
                          <div className="font-mono font-semibold text-[#4F6F52] tabular-nums text-sm">
                            {formatRupiah(booking.bookingFee + booking.dpAmount)}
                          </div>
                          <div className="text-[10px] text-[#A8B0AA] font-mono">
                            BF {formatRupiah(booking.bookingFee)} + DP {formatRupiah(booking.dpAmount)}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge
                          variant="outline"
                          className="uppercase font-semibold text-[10px] text-[#66736A] bg-[#F7F8F3] border-[#D6DED2] rounded-md"
                        >
                          <Translate namespace="booking" translationKey={`scheme_${booking.paymentScheme}` as any} fallback={booking.paymentScheme} />
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="space-y-1">
                          <Badge
                            className={`border font-semibold text-xs ${statusStyle?.bg || "bg-slate-50 text-slate-600 border-slate-200"} flex items-center gap-1 w-fit mx-auto rounded-full px-2.5 py-0.5`}
                          >
                            <Translate namespace="booking" translationKey={`status_${booking.status}` as any} fallback={booking.status} />
                          </Badge>
                          {booking.status === "cancelled" && booking.cancellationReason && (
                            <div
                              className="text-[10px] text-rose-600 italic font-medium truncate max-w-[130px] mx-auto"
                              title={booking.cancellationReason}
                            >
                              "{booking.cancellationReason}"
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex justify-end items-center gap-1.5">
                          {/* Cetak Kuitansi */}
                          {(booking.status === "active" || booking.status === "completed" || booking.status === "akad") && (
                            <BookingIconLink
                              href={`/marketing/bookings/${booking.id}/print`}
                              type="print"
                            />
                          )}

                          {/* Detail Booking Link */}
                          <BookingIconLink
                            href={`/marketing/bookings/${booking.id}`}
                            type="view"
                          />

                          {/* Edit Booking - jika masih aktif */}
                          {booking.status === "active" && (
                            <EditBookingDialog
                              booking={booking as any}
                              marketings={marketingUsers.length > 0 ? marketingUsers : marketingsList.filter(m => m.roleName?.includes("Marketing")) as any}
                              currentUser={{ id: activeUser.id, name: activeUser.name || "" }}
                            />
                          )}

                          {/* Upload Bukti Bayar */}
                          {booking.status === "active" && (sessionRoleInfo.isMarketing || sessionRoleInfo.isMarketingManager || sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor) && (
                            <BookingIconLink
                              href={`/marketing/bookings/${booking.id}`}
                              type="upload"
                            />
                          )}

                          {/* Cancel booking - hanya jika masih aktif */}
                          {booking.status === "active" && canCancel && (
                            <CancelBookingDialog booking={booking} />
                          )}

                          {/* Placeholder jika tidak ada aksi */}
                          {booking.status !== "active" && booking.status !== "completed" && booking.status !== "akad" && (
                            <Badge
                              variant="outline"
                              className="text-xs text-[#A8B0AA] border-[#E7E9E7] bg-[#F7F8F3] font-medium rounded-md px-2 py-1"
                            >
                              <Translate namespace="booking" translationKey={`status_${booking.status}` as any} fallback={booking.status} />
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center">
                        <FileText className="h-8 w-8 text-[#8FAF9A]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#243028] text-sm"><Translate namespace="booking" translationKey="not_found" /></p>
                        <p className="text-xs text-[#66736A] mt-1">
                          {q || statusFilter 
                            ? <Translate namespace="booking" translationKey="not_found_desc_1" />
                            : isBiasaRole 
                              ? <Translate namespace="booking" translationKey="not_found_desc_2" />
                              : <Translate namespace="booking" translationKey="not_found_desc_3" />}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <DataTablePagination totalItems={totalFilteredItems} itemsPerPage={itemsPerPage} />
        </div>
      </div>
    </div>
  );
}
