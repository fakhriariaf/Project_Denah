import { db } from "@/db";
import { leads as leadsTable } from "@/db/schema/marketing";
import { user as userTable } from "@/db/schema/auth";
import { roles as rolesTable } from "@/db/schema/access";
import { eq } from "drizzle-orm";
import { getCachedProjects, getCachedAvailableUnits, getCachedCustomers } from "@/lib/cached-queries";
import { getBookingsPaginated } from "@/server/actions/marketing";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { 
  DollarSign, 
  Layers, 
  AlertTriangle, 
  CheckCircle,
  FileText,
  ShieldAlert,
} from "lucide-react";
// Local components
import { DynamicAddBookingDialog as AddBookingDialog } from "@/app/marketing/bookings/dynamic-dialogs";
import { SearchInput } from "@/components/ui/search-input";
import { formatRupiah } from "@/lib/format-utils";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { requireAuth, getSessionRole } from "@/server/permissions";
import { Translate } from "@/components/translate";
import { BookingsTableClient } from "@/app/marketing/bookings/bookings-table-client";

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

  // Determine marketing scope for server-side filtering
  const marketingScope = (isBiasaRole || mineFilter) ? activeUser.id : undefined;

  // 1. Fetch paginated bookings (server-side) + reference data for form dialogs
  const [paginatedResult, projectsList, unitsList, customersList, marketingsList, leadsList] = await Promise.all([
    getBookingsPaginated({
      page: currentPage,
      pageSize: itemsPerPage,
      status: statusFilter || undefined,
      search: q || undefined,
      marketingId: marketingScope,
    }),

    getCachedProjects(),
    getCachedAvailableUnits(),
    getCachedCustomers(),
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

  // Extract paginated data
  const paginatedBookings = paginatedResult.data;
  const totalFilteredItems = paginatedResult.totalCount;

  // Calculate Metrics from current page data (approximation — for exact counts,
  // metrics could be fetched separately, but for now we display totalCount-based info)
  const activeBookingsCount = paginatedBookings.filter(b => b.status === "active").length;
  const cancelledBookingsCount = paginatedBookings.filter(b => b.status === "cancelled").length;
  const totalAkadCount = paginatedBookings.filter(b => b.status === "completed").length;
  const totalRevenue = paginatedBookings
    .filter(b => b.status !== "cancelled")
    .reduce((acc, curr) => acc + curr.bookingFee + curr.dpAmount, 0);

  // RBAC Permissions
  const canCancel = sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor || 
                    sessionRoleInfo.isMarketing || sessionRoleInfo.isMarketingManager;
  const canAdd = sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor ||
                 sessionRoleInfo.isMarketing || sessionRoleInfo.isMarketingManager;

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
      <PageHeader
        icon={<FileText className="h-6 w-6" />}
        title={<Translate namespace="booking" translationKey="title" />}
        description={
          <span className="flex items-center gap-2">
            <Translate namespace="booking" translationKey="subtitle" />
            {isBiasaRole && (
              <span className="inline-flex items-center gap-1 text-xs text-primary bg-secondary px-2 py-0.5 rounded-full font-semibold">
                <ShieldAlert className="h-3 w-3" />
                <Translate namespace="booking" translationKey="showing_mine" />
              </span>
            )}
          </span>
        }
        actions={
          canAdd ? (
            <AddBookingDialog
              projects={projectsList}
              units={unitsList}
              customers={customersList}
              leads={leadsList}
              marketings={marketingUsers.length > 0 ? marketingUsers : marketingsList.filter(m => m.roleName?.includes("Marketing"))}
              currentUser={{ id: activeUser.id, name: activeUser.name || "" }}
            />
          ) : undefined
        }
      />

      {/* ── KPI METRIC CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          title={<Translate namespace="booking" translationKey="total_revenue" />}
          value={formatRupiah(totalRevenue)}
          icon={<DollarSign className="h-5 w-5" />}
          colorScheme="#4F6F52"
        />
        <StatCard
          title={<Translate namespace="booking" translationKey="active_bookings" />}
          value={activeBookingsCount}
          icon={<Layers className="h-5 w-5" />}
          colorScheme="#0ea5e9"
        />
        <StatCard
          title={<Translate namespace="booking" translationKey="cancelled" />}
          value={cancelledBookingsCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          colorScheme="#f43f5e"
        />
        <StatCard
          title={<Translate namespace="booking" translationKey="completed" />}
          value={totalAkadCount}
          icon={<CheckCircle className="h-5 w-5" />}
          colorScheme="#10b981"
        />
      </div>

      {/* ── FILTER & SEARCH ── */}
      <div className="bg-white/70 backdrop-blur-md border border-border rounded-2xl p-4 shadow-sage">
        <form method="GET" className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
              <SearchInput
                i18nKey="booking.search_placeholder"
                name="q"
                defaultValue={q}
              />
            <Button
              type="submit"
              className="w-full md:w-auto h-10 px-5 bg-primary hover:bg-[#3F5941] text-white rounded-xl font-semibold text-sm shadow-[0_2px_8px_rgba(79,111,82,0.25)]"
            >
              <Translate namespace="action" translationKey="search" />
            </Button>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
            {/* "Booking Saya" filter - only for non-Biasa */}
            {!isBiasaRole && (
              <a
                href={`?${new URLSearchParams({ ...(q ? { q } : {}), ...(statusFilter ? { status: statusFilter } : {}), ...(mineFilter ? {} : { mine: "1" }) }).toString()}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 whitespace-nowrap flex items-center gap-1
                  ${mineFilter
                    ? "bg-primary text-white border-[#4F6F52] shadow-[0_2px_8px_rgba(79,111,82,0.3)]"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-primary hover:bg-secondary/30"
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
                    ? "bg-primary text-white border-[#4F6F52] shadow-[0_2px_8px_rgba(79,111,82,0.3)]"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-primary hover:bg-secondary/30"
                  }`}
              >
                <Translate namespace="booking" translationKey={opt.label as any} />
              </a>
            ))}
          </div>
        </form>
      </div>

      {/* ── DATA TABLE with Bulk Operations ── */}
      <BookingsTableClient
        bookings={paginatedBookings.map((b) => ({
          id: b.id,
          bookingNumber: b.bookingNumber,
          status: b.status,
          bookingDate: b.bookingDate,
          bookingFee: b.bookingFee,
          dpAmount: b.dpAmount,
          paymentScheme: b.paymentScheme,
          customerName: b.customerName,
          unitCode: b.unitCode,
          projectName: b.projectName,
          marketingName: b.marketingName,
          cancellationReason: b.cancellationReason,
        }))}
        canBulkDelete={sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor}
        canCancel={canCancel}
        sessionRoleInfo={{
          isMarketing: sessionRoleInfo.isMarketing,
          isMarketingManager: sessionRoleInfo.isMarketingManager,
          isSuperAdmin: sessionRoleInfo.isSuperAdmin,
          isAdminKantor: sessionRoleInfo.isAdminKantor,
        }}
        activeUser={{ id: activeUser.id, name: activeUser.name || "" }}
        totalFilteredItems={totalFilteredItems}
        marketings={marketingUsers.length > 0 ? marketingUsers : marketingsList.filter(m => m.roleName?.includes("Marketing")) as any}
      />
      <DataTablePagination totalItems={totalFilteredItems} itemsPerPage={itemsPerPage} />
    </div>
  );
}
