import { db } from "@/db";
import { leads as leadsTable } from "@/db/schema/marketing";
import { projects as projectsTable, units as unitsTable, customers as customersTable } from "@/db/schema/master";
import { user as userTable, userEmployments as userEmploymentsTable } from "@/db/schema/auth";
import { roles as rolesTable } from "@/db/schema/access";
import { requireAuth, getSessionRole } from "@/server/permissions";
import { desc, eq, and, ilike, or, count } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Users, 
  TrendingUp, 
  MessageSquare, 
  UserPlus,
  Target,
  ShieldAlert,
} from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import CreateLeadDialog from "@/app/marketing/leads/create-lead-dialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Translate } from "@/components/translate";
import { LeadsTableClient } from "@/app/marketing/leads/leads-table-client";

export const revalidate = 0;

export default async function LeadsPage({
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

  // 0. Get Active Session & Role
  const activeUser = await requireAuth();
  const sessionRoleInfo = await getSessionRole(activeUser.id);

  // 1. Fetch Master Data for dropdowns
  const projects = await db.select().from(projectsTable);
  const units = await db.select().from(unitsTable).where(eq(unitsTable.status, "available"));
  const customersList = await db.select().from(customersTable);
  
  // Fetch marketings with roles and supervisor mapping
  const marketings = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      roleId: userTable.roleId,
      roleName: rolesTable.name,
      supervisorId: userEmploymentsTable.supervisorId,
    })
    .from(userTable)
    .leftJoin(rolesTable, eq(userTable.roleId, rolesTable.id))
    .leftJoin(userEmploymentsTable, eq(userTable.id, userEmploymentsTable.userId))
    .where(eq(userTable.status, "active"));

  // 2. Determine RBAC scope for query
  const isBiasaRole = sessionRoleInfo.isMarketing && !sessionRoleInfo.isMarketingManager && !sessionRoleInfo.isAdminKantor && !sessionRoleInfo.isSuperAdmin;

  // Build WHERE conditions — all filtering done in DB, not in-memory (Item 2 fix)
  const whereConditions: ReturnType<typeof eq>[] = [];

  // RBAC scope
  if (isBiasaRole || mineFilter) {
    whereConditions.push(eq(leadsTable.assignedMarketingId, activeUser.id));
  }

  // Status filter
  if (statusFilter) {
    whereConditions.push(eq(leadsTable.status, statusFilter as "new" | "contacted" | "follow_up" | "converted" | "lost"));
  }

  // Search filter — case-insensitive partial match across name, phone, projectName, unitCode
  let searchCondition: ReturnType<typeof or> | undefined;
  if (q && q.trim() !== "") {
    const searchTerm = `%${q.trim()}%`;
    searchCondition = or(
      ilike(leadsTable.name, searchTerm),
      ilike(leadsTable.phone, searchTerm),
      ilike(projectsTable.name, searchTerm),
      ilike(unitsTable.code, searchTerm),
    );
  }

  const whereClause = searchCondition
    ? whereConditions.length > 0
      ? and(...whereConditions, searchCondition)
      : searchCondition
    : whereConditions.length > 0
      ? and(...whereConditions)
      : undefined;

  // Count query for accurate pagination (runs same filters, no LIMIT)
  const [countResult] = await db
    .select({ totalCount: count() })
    .from(leadsTable)
    .leftJoin(projectsTable, eq(leadsTable.interestedProjectId, projectsTable.id))
    .leftJoin(unitsTable, eq(leadsTable.interestedUnitId, unitsTable.id))
    .leftJoin(userTable, eq(leadsTable.assignedMarketingId, userTable.id))
    .where(whereClause);

  const totalFilteredItems = countResult?.totalCount ?? 0;

  // Metrics — scoped totals use same RBAC conditions without search/status filter
  const scopeOnlyClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const [metricsRows] = await db
    .select({
      totalLeads: count(),
    })
    .from(leadsTable)
    .where(scopeOnlyClause);

  const [newLeadsRow] = await db
    .select({ cnt: count() })
    .from(leadsTable)
    .where(scopeOnlyClause ? and(scopeOnlyClause, eq(leadsTable.status, "new")) : eq(leadsTable.status, "new"));

  const [followUpRow] = await db
    .select({ cnt: count() })
    .from(leadsTable)
    .where(scopeOnlyClause ? and(scopeOnlyClause, eq(leadsTable.status, "follow_up")) : eq(leadsTable.status, "follow_up"));

  const [convertedRow] = await db
    .select({ cnt: count() })
    .from(leadsTable)
    .where(scopeOnlyClause ? and(scopeOnlyClause, eq(leadsTable.status, "converted")) : eq(leadsTable.status, "converted"));

  const totalLeads = metricsRows?.totalLeads ?? 0;
  const newLeads = newLeadsRow?.cnt ?? 0;
  const followUpLeads = followUpRow?.cnt ?? 0;
  const convertedLeads = convertedRow?.cnt ?? 0;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  // Paginated data query — server-side LIMIT/OFFSET
  const offset = (currentPage - 1) * itemsPerPage;
  const paginatedLeads = await db.select({
    id: leadsTable.id,
    name: leadsTable.name,
    phone: leadsTable.phone,
    source: leadsTable.source,
    status: leadsTable.status,
    notes: leadsTable.notes,
    createdAt: leadsTable.createdAt,
    assignedMarketingId: leadsTable.assignedMarketingId,
    interestedProjectId: leadsTable.interestedProjectId,
    interestedUnitId: leadsTable.interestedUnitId,
    projectName: projectsTable.name,
    unitCode: unitsTable.code,
    marketingName: userTable.name,
    customerId: leadsTable.customerId,
  })
  .from(leadsTable)
  .leftJoin(projectsTable, eq(leadsTable.interestedProjectId, projectsTable.id))
  .leftJoin(unitsTable, eq(leadsTable.interestedUnitId, unitsTable.id))
  .leftJoin(userTable, eq(leadsTable.assignedMarketingId, userTable.id))
  .where(whereClause)
  .orderBy(desc(leadsTable.createdAt))
  .limit(itemsPerPage)
  .offset(offset);

  // RBAC permissions for UI
  const canDelete = sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor;
  const canEdit = sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor || 
                  sessionRoleInfo.isMarketingManager || sessionRoleInfo.isMarketing;
  const canAdd = sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor || 
                 sessionRoleInfo.isMarketingManager || sessionRoleInfo.isMarketing;

  const statusFilterOptions = [
    { value: "", label: "status_all" },
    { value: "new", label: "status_new" },
    { value: "contacted", label: "status_contacted" },
    { value: "follow_up", label: "status_follow_up" },
    { value: "converted", label: "status_converted" },
    { value: "lost", label: "status_lost" },
  ];

  return (
    <div className="flex flex-col gap-6">
      
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        {/* Decorative orbs */}
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#243028] tracking-tight"><Translate namespace="lead" translationKey="title" /></h1>
              <p className="text-sm text-[#66736A] mt-0.5">
                <Translate namespace="lead" translationKey="subtitle" />
                {isBiasaRole && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-[#4F6F52] bg-[#DDE8D8] px-2 py-0.5 rounded-full font-semibold">
                    <ShieldAlert className="h-3 w-3" />
                    <Translate namespace="lead" translationKey="showing_mine" />
                  </span>
                )}
              </p>
            </div>
          </div>
          {canAdd && (
            <CreateLeadDialog 
              projects={projects}
              units={units}
              customers={customersList}
              marketings={marketings}
              currentUser={activeUser}
              currentUserRole={sessionRoleInfo}
            />
          )}
        </div>
      </div>

      {/* ── KPI METRIC CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Prospek */}
        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="lead" translationKey="total_leads" /></p>
              <h3 className="text-2xl font-black font-mono tracking-tight text-[#243028] tabular-nums">{totalLeads}</h3>
              <p className="text-[10px] text-[#8FAF9A]">
                {isBiasaRole ? <Translate namespace="lead" translationKey="total_leads_mine_desc" /> : <Translate namespace="lead" translationKey="total_leads_all_desc" />}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Lead Baru */}
        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="lead" translationKey="new_leads" /></p>
              <h3 className="text-2xl font-black font-mono tracking-tight text-emerald-700 tabular-nums">{newLeads}</h3>
              <p className="text-[10px] text-emerald-500"><Translate namespace="lead" translationKey="new_leads_desc" /></p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <UserPlus className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Follow Up */}
        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="lead" translationKey="follow_up" /></p>
              <h3 className="text-2xl font-black font-mono tracking-tight text-amber-700 tabular-nums">{followUpLeads}</h3>
              <p className="text-[10px] text-amber-500"><Translate namespace="lead" translationKey="follow_up_desc" /></p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider"><Translate namespace="lead" translationKey="converted" /></p>
              <h3 className="text-2xl font-black font-mono tracking-tight text-[#4F6F52] tabular-nums">{convertedLeads}</h3>
              <p className="text-[10px] text-[#8FAF9A]">
                <Translate namespace="lead" translationKey="converted_desc" values={{ rate: conversionRate.toString() }} />
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="bg-white border border-[#D6DED2] rounded-2xl shadow-sage p-4">
        <form method="GET" className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <SearchInput
            i18nKey="lead.search_placeholder"
            name="q"
            defaultValue={q}
          />

          {/* Status Pills Filter */}
          <div className="flex flex-wrap gap-2">
            {/* "Leads Saya" filter - only visible for Manager / Super Admin / Admin */}
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
                {mineFilter ? <Translate namespace="lead" translationKey="filter_mine_active" /> : <Translate namespace="lead" translationKey="filter_mine" />}
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
                <Translate namespace="lead" translationKey={opt.label as any} />
              </a>
            ))}
          </div>
        </form>
      </div>

      {/* ── DATA TABLE with Bulk Operations ── */}
      <LeadsTableClient
        leads={paginatedLeads.map((l) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          source: l.source,
          status: l.status,
          notes: l.notes,
          createdAt: l.createdAt,
          assignedMarketingId: l.assignedMarketingId,
          interestedProjectId: l.interestedProjectId,
          interestedUnitId: l.interestedUnitId,
          projectName: l.projectName,
          unitCode: l.unitCode,
          marketingName: l.marketingName,
          customerId: l.customerId,
        }))}
        canBulkDelete={canDelete}
        totalFilteredItems={totalFilteredItems}
        totalLeads={totalLeads}
        mineFilter={mineFilter}
        isBiasaRole={isBiasaRole}
        dialogData={{
          projects,
          marketings,
          currentUser: { id: activeUser.id, name: activeUser.name || "" },
          currentUserRole: sessionRoleInfo,
          canEdit,
          canDelete,
        }}
      />
      <DataTablePagination totalItems={totalFilteredItems} itemsPerPage={itemsPerPage} />
    </div>
  );
}
