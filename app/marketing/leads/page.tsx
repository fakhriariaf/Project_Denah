import { db } from "@/db";
import { leads as leadsTable } from "@/db/schema/marketing";
import { projects as projectsTable, units as unitsTable, customers as customersTable } from "@/db/schema/master";
import { user as userTable, userEmployments as userEmploymentsTable } from "@/db/schema/auth";
import { roles as rolesTable } from "@/db/schema/access";
import { requireAuth, getSessionRole } from "@/server/permissions";
import { desc, eq, and } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  TrendingUp, 
  MessageSquare, 
  Calendar,
  Phone,
  UserPlus,
  Target,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import CreateLeadDialog from "@/app/marketing/leads/create-lead-dialog";
import EditLeadDialog from "@/app/marketing/leads/edit-lead-dialog";
import AddFollowupDialog from "@/app/marketing/leads/add-followup-dialog";
import { DeleteConfirm } from "@/components/delete-confirm";
import { deleteLead } from "@/server/actions/marketing";
import { formatDate } from "@/lib/format-utils";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Translate } from "@/components/translate";

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
  // Marketing Biasa: only sees leads assigned to them
  // Marketing Manager: sees all leads (for monitoring), but can filter "mine"
  // Super Admin / Admin Kantor / Direksi / Keuangan: sees all
  const isBiasaRole = sessionRoleInfo.isMarketing && !sessionRoleInfo.isMarketingManager && !sessionRoleInfo.isAdminKantor && !sessionRoleInfo.isSuperAdmin;

  // Build query
  const allLeadsQuery = db.select({
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
  .orderBy(desc(leadsTable.createdAt));

  const allLeads = await allLeadsQuery;

  // 3. Apply RBAC filter: Marketing Biasa only sees own assigned leads
  let scopedLeads = allLeads;
  if (isBiasaRole) {
    scopedLeads = allLeads.filter(l => l.assignedMarketingId === activeUser.id);
  } else if (mineFilter) {
    // "Leads Saya" filter: show only leads assigned to current user
    scopedLeads = allLeads.filter(l => l.assignedMarketingId === activeUser.id);
  }

  // 4. Search + status filter
  const filteredLeads = scopedLeads.filter(lead => {
    const matchesSearch = q === "" || 
      lead.name.toLowerCase().includes(q.toLowerCase()) || 
      lead.phone.includes(q) ||
      (lead.projectName && lead.projectName.toLowerCase().includes(q.toLowerCase())) ||
      (lead.unitCode && lead.unitCode.toLowerCase().includes(q.toLowerCase()));
      
    const matchesStatus = statusFilter === "" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalFilteredItems = filteredLeads.length;
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Calculate Metrics (based on scoped leads)
  const totalLeads = scopedLeads.length;
  const newLeads = scopedLeads.filter(l => l.status === "new").length;
  const followUpLeads = scopedLeads.filter(l => l.status === "follow_up").length;
  const convertedLeads = scopedLeads.filter(l => l.status === "converted").length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  // RBAC permissions for UI
  const canDelete = sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor;
  const canEdit = sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor || 
                  sessionRoleInfo.isMarketingManager || sessionRoleInfo.isMarketing;
  const canAdd = sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor || 
                 sessionRoleInfo.isMarketingManager || sessionRoleInfo.isMarketing;

  const sourceMap: Record<string, string> = {
    walk_in: "Walk In",
    ads: "Iklan Digital",
    referral: "Referral",
    social_media: "Sosial Media",
    website: "Website",
    other: "Lainnya"
  };

  const statusMap: Record<string, { bg: string; label: string; dot: string }> = {
    new:        { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", label: "Baru" },
    contacted:  { bg: "bg-blue-50 text-blue-700 border-blue-200",         dot: "bg-blue-500",    label: "Dihubungi" },
    follow_up:  { bg: "bg-amber-50 text-amber-700 border-amber-200",      dot: "bg-amber-500",   label: "Follow Up" },
    converted:  { bg: "bg-[#DDE8D8] text-[#4F6F52] border-[#8FAF9A]/40", dot: "bg-[#4F6F52]",  label: "Deal ✓" },
    lost:       { bg: "bg-rose-50 text-rose-700 border-rose-200",         dot: "bg-rose-500",    label: "Tidak Jadi" },
  };

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

      {/* ── DATA TABLE ── */}
      <div className="bg-white border border-[#D6DED2] rounded-2xl shadow-sage overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-3.5 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#66736A] uppercase tracking-wider">
              <Translate namespace="lead" translationKey="list_title" />
              {mineFilter && !isBiasaRole && (
                <span className="ml-2 text-[#4F6F52] bg-[#DDE8D8] px-2 py-0.5 rounded-full normal-case font-semibold">
                  <Translate namespace="lead" translationKey="filter_mine" />
                </span>
              )}
            </span>
            <span className="text-xs font-mono text-[#8FAF9A] tabular-nums">
              <Translate namespace="lead" translationKey="list_subtitle" values={{ filtered: filteredLeads.length.toString(), total: totalLeads.toString() }} />
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#D6DED2] text-[#66736A] text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-6"><Translate namespace="lead" translationKey="col_prospect" /></th>
                <th className="py-3 px-6"><Translate namespace="lead" translationKey="col_source_interest" /></th>
                <th className="py-3 px-6"><Translate namespace="lead" translationKey="col_marketing" /></th>
                <th className="py-3 px-6 text-center"><Translate namespace="lead" translationKey="col_status" /></th>
                <th className="py-3 px-6"><Translate namespace="lead" translationKey="col_date" /></th>
                <th className="py-3 px-6 text-right"><Translate namespace="lead" translationKey="col_action" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DED2]/60">
              {paginatedLeads.length > 0 ? (
                paginatedLeads.map((lead) => {
                  const statusInfo = statusMap[lead.status] || { bg: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400", label: lead.status };
                  return (
                    <tr key={lead.id} className="hover:bg-[#F7F8F3]/80 transition-colors duration-150 group">
                      <td className="py-4 px-6">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center font-bold text-xs shrink-0 border border-[#8FAF9A]/20">
                            {lead.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="space-y-0.5">
                            <div className="font-semibold text-[#243028] text-sm">{lead.name}</div>
                            <div className="flex items-center text-xs text-[#66736A] font-mono">
                              <Phone className="h-3 w-3 mr-1 text-[#8FAF9A]" /> {lead.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          <div className="text-sm font-semibold text-[#243028]">{lead.projectName || <span className="text-[#A8B0AA] italic font-normal"><Translate namespace="lead" translationKey="unassigned_project" /></span>}</div>
                          <div className="text-xs text-[#66736A] flex items-center gap-1.5">
                            {lead.unitCode && (
                              <span className="font-mono bg-[#DDE8D8]/60 text-[#4F6F52] px-1.5 py-0.5 rounded text-[10px] font-semibold border border-[#8FAF9A]/20">
                                {lead.unitCode}
                              </span>
                            )}
                            <span className="text-[#A8B0AA]">•</span>
                            <span className="font-medium"><Translate namespace="lead" translationKey={`source_${lead.source}` as any} /></span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          {lead.marketingName ? (
                            <>
                              <div className="h-6 w-6 rounded-full bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center text-[9px] font-bold shrink-0">
                                {lead.marketingName.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-[#243028]">{lead.marketingName}</span>
                            </>
                          ) : (
                            <span className="text-xs text-[#A8B0AA] italic"><Translate namespace="lead" translationKey="unassigned_marketing" /></span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge className={`border font-semibold text-xs ${statusInfo.bg} flex items-center gap-1.5 w-fit mx-auto`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot} shrink-0`} />
                          <Translate namespace="lead" translationKey={`status_${lead.status}` as any} />
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1 text-xs text-[#66736A]">
                          <Calendar className="h-3.5 w-3.5 text-[#8FAF9A]" />
                          <span className="font-mono">
                            {formatDate(lead.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {/* Action buttons — RBAC controlled */}
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Follow-up: all marketing roles */}
                          <AddFollowupDialog lead={lead} />

                          {/* Edit: Marketing and above */}
                          {canEdit && (
                            <EditLeadDialog
                              lead={lead}
                              projects={projects}
                              marketings={marketings}
                              currentUser={activeUser}
                              currentUserRole={sessionRoleInfo}
                            />
                          )}

                          {/* Delete: ONLY Super Admin & Admin Kantor */}
                          {canDelete && (
                            <DeleteConfirm
                              onConfirm={async () => {
                                "use server";
                                return deleteLead(lead.id);
                              }}
                              label={`lead "${lead.name}"`}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center">
                        <Sparkles className="h-8 w-8 text-[#8FAF9A]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#243028] text-sm"><Translate namespace="lead" translationKey="not_found" /></p>
                        <p className="text-xs text-[#66736A] mt-1">
                          {q || statusFilter 
                            ? <Translate namespace="lead" translationKey="not_found_desc_1" />
                            : isBiasaRole
                              ? <Translate namespace="lead" translationKey="not_found_desc_2" />
                              : <Translate namespace="lead" translationKey="not_found_desc_3" />}
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
