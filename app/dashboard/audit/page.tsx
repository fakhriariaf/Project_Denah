import { getAuditLogs, getAuditUsers } from "@/server/actions/audit";
import { requireAuth, getSessionRole, requirePermission } from "@/server/permissions";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock, Terminal, User } from "lucide-react";
import { AuditLogFilter } from "@/components/dashboard/audit-filter";
import { Translate } from "@/components/translate";
import { getI18n } from "@/lib/i18n-server";

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

  // 3. Fetch data with filters
  const resolvedSearchParams = await searchParams;
  const logs = await getAuditLogs(resolvedSearchParams);
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
          <div className="rounded-md border border-[#8FAF9A]/10 overflow-hidden">
            <Table>
              <TableHeader className="bg-[#8FAF9A]/5">
                <TableRow className="hover:bg-transparent border-[#8FAF9A]/10">
                  <TableHead className="w-[180px] font-semibold text-primary font-sans text-xs uppercase tracking-wider">
                    <Translate namespace="audit" translationKey="col_time" />
                  </TableHead>
                  <TableHead className="w-[180px] font-semibold text-primary font-sans text-xs uppercase tracking-wider">
                    <Translate namespace="audit" translationKey="col_user" />
                  </TableHead>
                  <TableHead className="w-[150px] font-semibold text-primary font-sans text-xs uppercase tracking-wider">
                    <Translate namespace="audit" translationKey="col_module" />
                  </TableHead>
                  <TableHead className="w-[200px] font-semibold text-primary font-sans text-xs uppercase tracking-wider">
                    <Translate namespace="audit" translationKey="col_action" />
                  </TableHead>
                  <TableHead className="font-semibold text-primary font-sans text-xs uppercase tracking-wider">
                    <Translate namespace="audit" translationKey="col_detail" />
                  </TableHead>
                  <TableHead className="w-[120px] font-semibold text-primary font-sans text-xs uppercase tracking-wider text-right">
                    <Translate namespace="audit" translationKey="col_ip" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      <Translate namespace="audit" translationKey="empty" />
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-[#8FAF9A]/5 border-[#8FAF9A]/10 transition-colors">
                      <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground/60" />
                          {log.createdAt
                            ? new Date(log.createdAt).toLocaleString("id-ID", {
                                dateStyle: "short",
                                timeStyle: "medium",
                              })
                            : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-xs flex items-center gap-1">
                            <User className="h-3 w-3 text-primary/70" />
                            {log.userName || t("audit.system")}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[170px]">
                            {log.userEmail || "system@internal"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-[#8FAF9A]/5 border-[#8FAF9A]/20 text-primary text-[10px] uppercase font-semibold font-mono tracking-wider">
                          {log.module}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-foreground text-xs">
                        {log.action}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground break-all">
                          <Terminal className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                          <span>
                            {log.details
                              ? typeof log.details === "string"
                                ? log.details
                                : JSON.stringify(log.details)
                              : `ID Entitas: ${log.entityId || "N/A"}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground text-right">
                        {log.ipAddress}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
