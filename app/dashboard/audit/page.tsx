import { getAuditLogsPaginated, getAuditUsers } from "@/server/actions/audit";
import { requireAuth, getSessionRole, requirePermission } from "@/server/permissions";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { AuditLogFilter } from "@/components/dashboard/audit-filter";
import { Translate } from "@/components/translate";
import { getI18n } from "@/lib/i18n-server";
import { AuditTableClient } from "./audit-table-client";

export const revalidate = 0;

interface SearchParamsProps {
  userId?: string;
  module?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsProps> | SearchParamsProps;
}) {
  // 1. Authenticate user
  const user = await requireAuth();
  await requirePermission("system.audit");
  const { t } = await getI18n();

  // 2. Check if user is Super Admin or Direksi / Manager
  const { isSuperAdmin, isDireksi } = await getSessionRole(user.id);

  if (!isSuperAdmin && !isDireksi) {
    redirect("/unauthorized");
  }

  // 3. Resolve search params and build filters
  const resolvedSearchParams = await searchParams;
  const filters = {
    userId: resolvedSearchParams.userId,
    module: resolvedSearchParams.module,
    action: resolvedSearchParams.action,
    startDate: resolvedSearchParams.startDate,
    endDate: resolvedSearchParams.endDate,
  };

  // 4. Fetch initial paginated data using cursor-based pagination
  const initialResult = await getAuditLogsPaginated(
    { pageSize: 50 },
    filters
  );

  const users = await getAuditUsers();

  return (
    <div className="flex flex-col gap-6">
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#243028] tracking-tight"><Translate namespace="audit" translationKey="title" /></h2>
              <p className="text-sm text-[#66736A] mt-0.5"><Translate namespace="audit" translationKey="desc" /></p>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Interactive Filters */}
      <AuditLogFilter users={users} />

      {/* Main Table Card */}
      <Card className="border-[#8FAF9A]/20 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <Translate namespace="audit" translationKey="card_title" />
          </CardTitle>
          <CardDescription>
            <Translate namespace="audit" translationKey="card_desc" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditTableClient
            initialData={initialResult.data}
            initialNextCursor={initialResult.nextCursor}
            initialHasMore={initialResult.hasMore}
            filters={filters}
          />
        </CardContent>
      </Card>
    </div>
  );
}
