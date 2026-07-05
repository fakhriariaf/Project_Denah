"use client";

import * as React from "react";
import { useState, useCallback, useTransition } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, Terminal, User, Loader2, ChevronDown } from "lucide-react";
import { getAuditLogsPaginated } from "@/server/actions/audit";
import type { AuditLogItem } from "@/server/actions/audit";
import { useI18n } from "@/lib/i18n";
import { Translate } from "@/components/translate";

interface AuditTableClientProps {
  initialData: AuditLogItem[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  filters: {
    userId?: string;
    module?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  };
}

export function AuditTableClient({
  initialData,
  initialNextCursor,
  initialHasMore,
  filters,
}: AuditTableClientProps) {
  const { t } = useI18n();
  const [logs, setLogs] = useState<AuditLogItem[]>(initialData);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  // Reset state when filters change (initialData prop changes)
  React.useEffect(() => {
    setLogs(initialData);
    setNextCursor(initialNextCursor);
    setHasMore(initialHasMore);
  }, [initialData, initialNextCursor, initialHasMore]);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || !hasMore) return;

    startTransition(async () => {
      const result = await getAuditLogsPaginated(
        { cursor: nextCursor, pageSize: 50 },
        filters
      );

      setLogs((prev) => [...prev, ...result.data]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    });
  }, [nextCursor, hasMore, filters]);

  return (
    <div className="space-y-4">
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

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={handleLoadMore}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#4F6F52] hover:bg-[#3d5a40] rounded-xl shadow-[0_4px_12px_rgba(79,111,82,0.25)] hover:shadow-[0_6px_16px_rgba(79,111,82,0.35)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("audit.loading")}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                {t("audit.load_more")}
              </>
            )}
          </button>
        </div>
      )}

      {/* Record count indicator */}
      {logs.length > 0 && (
        <div className="text-center text-xs text-muted-foreground font-mono">
          {t("audit.showing_count", { count: logs.length })}
        </div>
      )}
    </div>
  );
}
