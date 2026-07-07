"use client";

import * as React from "react";
import { useState, useCallback, useTransition } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Terminal, User, Loader2, ChevronDown, ChevronRight, X, ArrowRight } from "lucide-react";
import { getAuditLogsPaginated } from "@/server/actions/audit";
import type { AuditLogItem } from "@/server/actions/audit";
import { useI18n } from "@/lib/i18n";
import { Translate } from "@/components/translate";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** snake_case / camelCase → Title Case */
function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Relative time: "2 jam lalu", "baru saja" */
function relativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days < 7) return `${days} hari lalu`;
  return date.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

/** Level badge style */
function getLevelBadgeStyle(level: string): string {
  switch (level) {
    case "error": return "bg-red-50 text-red-700 border-red-200 border";
    case "info": return "bg-blue-50 text-blue-700 border-blue-200 border";
    default: return "bg-gray-50 text-gray-600 border-gray-200 border";
  }
}

/** Status/response code badge style */
function getStatusBadgeStyle(code: number | null): string {
  const c = code || 200;
  if (c >= 500) return "bg-red-50 text-red-700 border-red-200 border";
  if (c >= 400) return "bg-amber-50 text-amber-700 border-amber-200 border";
  return "bg-emerald-50 text-emerald-700 border-emerald-200 border";
}

/** Action → color mapping */
function getActionBadgeStyle(action: string): { bg: string; text: string; border: string } {
  const lower = action.toLowerCase();
  if (lower.includes("create") || lower.includes("buat") || lower.includes("tambah")) {
    return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
  }
  if (lower.includes("update") || lower.includes("edit") || lower.includes("ubah")) {
    return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
  }
  if (lower.includes("delete") || lower.includes("hapus") || lower.includes("remove")) {
    return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
  }
  if (lower.includes("approve") || lower.includes("accept") || lower.includes("setuju")) {
    return { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" };
  }
  if (lower.includes("reject") || lower.includes("tolak") || lower.includes("deny")) {
    return { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" };
  }
  if (lower.includes("login") || lower.includes("logout") || lower.includes("auth")) {
    return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
  }
  return { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
}

/** Check if details contains before/after diff */
function hasDiff(details: unknown): details is { before: Record<string, unknown>; after: Record<string, unknown> } {
  if (!details || typeof details !== "object") return false;
  const d = details as Record<string, unknown>;
  return "before" in d && "after" in d && typeof d.before === "object" && typeof d.after === "object";
}

/** Flatten details to key-value pairs for display */
function flattenDetails(details: unknown): Array<{ key: string; value: string }> {
  if (!details) return [];
  if (typeof details === "string") return [{ key: "detail", value: details }];
  if (typeof details !== "object") return [{ key: "detail", value: String(details) }];

  const obj = details as Record<string, unknown>;
  const entries: Array<{ key: string; value: string }> = [];

  for (const [key, val] of Object.entries(obj)) {
    if (key === "before" || key === "after") continue; // handled separately in diff view
    if (val === null || val === undefined) continue;
    if (typeof val === "object") {
      entries.push({ key, value: JSON.stringify(val, null, 2) });
    } else {
      entries.push({ key, value: String(val) });
    }
  }
  return entries;
}

// ─── Detail Drawer ──────────────────────────────────────────────────────────

function DetailDrawer({ log, onClose }: { log: AuditLogItem; onClose: () => void }) {
  const actionStyle = getActionBadgeStyle(log.action);
  const details = log.details as Record<string, unknown> | null | undefined;
  const isDiff = hasDiff(details);
  const flatEntries = !isDiff ? flattenDetails(details) : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

      {/* Drawer */}
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#151E1A] shadow-2xl border-l border-[#D6DED2] dark:border-[#1F2E26] overflow-y-auto animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-[#151E1A] border-b border-[#D6DED2] dark:border-[#1F2E26] px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[#243028] dark:text-[#E3EAE6]">Detail Audit Log</h3>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {log.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#DDE8D8] transition-colors"
          >
            <X className="h-4 w-4 text-[#66736A]" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Meta info cards */}
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Waktu" value={
              log.createdAt
                ? new Date(log.createdAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "medium" })
                : "-"
            } />
            <InfoCard label="User" value={log.userName || "System"} sub={log.userEmail || "system@internal"} />
            <InfoCard label="Module" value={log.module} />
            <InfoCard label="IP Address" value={log.ipAddress || "-"} />
            <InfoCard label="Endpoint" value={log.endpoint || "-"} mono />
            <InfoCard label="Entity Type" value={log.entityType || "-"} />
            <InfoCard label="Entity ID" value={log.entityId || "-"} mono />
            <InfoCard label="Level" value={
              log.level === "error" ? "🔴 Error" : log.level === "info" ? "🔵 Info" : "🟢 Log"
            } />
            <InfoCard label="Status" value={
              `${log.responseCode || 200} — ${log.status || "success"}`
            } />
            <InfoCard label="Durasi" value={
              log.durationMs ? `${log.durationMs}ms` : "—"
            } />
          </div>

          {/* Action badge */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Aksi</p>
            <Badge className={`${actionStyle.bg} ${actionStyle.text} ${actionStyle.border} border text-xs font-semibold px-2.5 py-1`}>
              {log.action}
            </Badge>
          </div>

          {/* Error Response Section */}
          {log.level === "error" && !!(details as Record<string, unknown> | null)?.error && (
            <div>
              <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-2">Error Response</p>
              <div className="bg-red-50 rounded-xl border border-red-200 px-3 py-2.5">
                <p className="text-xs text-red-700 font-medium">{String((details as Record<string, unknown>).error)}</p>
              </div>
            </div>
          )}

          {/* Diff View */}
          {isDiff && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Perubahan</p>
              <DiffView
                before={(details as { before: Record<string, unknown> }).before}
                after={(details as { after: Record<string, unknown> }).after}
              />
            </div>
          )}

          {/* Flat details */}
          {!isDiff && flatEntries.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detail Data</p>
              <div className="space-y-2">
                {flatEntries.map((entry, i) => (
                  <div key={i} className="bg-[#F7F8F3] rounded-xl border border-[#D6DED2]/60 px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-[#66736A] uppercase tracking-wider">{humanizeKey(entry.key)}</p>
                    <p className="text-xs text-[#243028] mt-0.5 font-mono break-all whitespace-pre-wrap">
                      {entry.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON fallback */}
          {!isDiff && flatEntries.length === 0 && details && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raw Data</p>
              <pre className="bg-[#F7F8F3] rounded-xl border border-[#D6DED2]/60 p-3 text-[11px] text-[#243028] font-mono overflow-x-auto whitespace-pre-wrap">
                {typeof details === "string" ? details : JSON.stringify(details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, sub, mono }: { label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div className="bg-[#F7F8F3] rounded-xl border border-[#D6DED2]/60 px-3 py-2.5 overflow-hidden">
      <p className="text-[10px] font-semibold text-[#66736A] uppercase tracking-wider">{label}</p>
      <p className={`text-xs text-[#243028] mt-0.5 font-medium break-all ${mono ? "font-mono text-[11px]" : ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground font-mono break-all">{sub}</p>}
    </div>
  );
}

function DiffView({ before, after }: { before: Record<string, unknown>; after: Record<string, unknown> }) {
  const allKeys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
  const changedKeys = allKeys.filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));

  if (changedKeys.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Tidak ada perubahan terdeteksi</p>;
  }

  return (
    <div className="space-y-2">
      {changedKeys.map((key) => (
        <div key={key} className="bg-[#F7F8F3] rounded-xl border border-[#D6DED2]/60 px-3 py-2.5">
          <p className="text-[10px] font-semibold text-[#66736A] uppercase tracking-wider mb-1.5">
            {humanizeKey(key)}
          </p>
          <div className="flex items-start gap-2 text-xs font-mono">
            <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200 break-all max-w-[45%]">
              {before?.[key] !== undefined ? String(before[key]) : "—"}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 break-all max-w-[45%]">
              {after?.[key] !== undefined ? String(after[key]) : "—"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

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
    level?: string;
    status?: string;
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
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Reset state when filters change
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

  /** Preview text for details column */
  const getDetailPreview = (log: AuditLogItem): string => {
    if (!log.details) return log.entityId ? `Entity: ${log.entityId}` : "—";
    if (typeof log.details === "string") return log.details;

    const d = log.details as Record<string, unknown>;
    // If diff, show summary
    if (hasDiff(log.details)) {
      const before = d.before as Record<string, unknown>;
      const after = d.after as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
      const changed = [...allKeys].filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
      return `${changed.length} field diubah`;
    }

    // Otherwise show first meaningful key-value
    const keys = Object.keys(d).filter((k) => d[k] !== null && d[k] !== undefined);
    if (keys.length === 0) return "—";
    const first = keys[0];
    const val = typeof d[first] === "object" ? JSON.stringify(d[first]) : String(d[first]);
    const preview = `${humanizeKey(first)}: ${val}`;
    return preview.length > 60 ? preview.slice(0, 57) + "..." : preview;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[#8FAF9A]/10 overflow-hidden">
        <Table>
          <TableHeader className="bg-[#8FAF9A]/5">
            <TableRow className="hover:bg-transparent border-[#8FAF9A]/10">
              <TableHead className="w-[160px] font-semibold text-primary font-sans text-xs uppercase tracking-wider">
                <Translate namespace="audit" translationKey="col_time" />
              </TableHead>
              <TableHead className="w-[160px] font-semibold text-primary font-sans text-xs uppercase tracking-wider">
                <Translate namespace="audit" translationKey="col_user" />
              </TableHead>
              <TableHead className="w-[120px] font-semibold text-primary font-sans text-xs uppercase tracking-wider">
                <Translate namespace="audit" translationKey="col_module" />
              </TableHead>
              <TableHead className="w-[80px] font-semibold text-primary font-sans text-xs uppercase tracking-wider">
                LEVEL
              </TableHead>
              <TableHead className="w-[80px] font-semibold text-primary font-sans text-xs uppercase tracking-wider">
                STATUS
              </TableHead>
              <TableHead className="w-[180px] font-semibold text-primary font-sans text-xs uppercase tracking-wider">
                <Translate namespace="audit" translationKey="col_action" />
              </TableHead>
              <TableHead className="font-semibold text-primary font-sans text-xs uppercase tracking-wider">
                <Translate namespace="audit" translationKey="col_detail" />
              </TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <Translate namespace="audit" translationKey="empty" />
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const actionStyle = getActionBadgeStyle(log.action);
                return (
                  <TableRow
                    key={log.id}
                    className="hover:bg-[#8FAF9A]/5 border-[#8FAF9A]/10 transition-colors cursor-pointer group"
                    onClick={() => setSelectedLog(log)}
                  >
                    {/* Time — absolute + relative */}
                    <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-[11px] text-foreground font-medium">
                          {new Date(log.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })},{" "}
                          {new Date(log.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {relativeTime(new Date(log.createdAt))}
                        </span>
                      </div>
                    </TableCell>

                    {/* User */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground text-xs flex items-center gap-1">
                          <User className="h-3 w-3 text-primary/70" />
                          {log.userName || t("audit.system")}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">
                          {log.userEmail || "system@internal"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Module */}
                    <TableCell>
                      <Badge variant="outline" className="bg-[#8FAF9A]/5 border-[#8FAF9A]/20 text-primary text-[10px] uppercase font-semibold font-mono tracking-wider">
                        {log.module}
                      </Badge>
                    </TableCell>

                    {/* Level */}
                    <TableCell>
                      <Badge className={getLevelBadgeStyle(log.level)}>
                        {log.level === "error" ? "🔴 ERR" : log.level === "info" ? "🔵 INFO" : "🟢 LOG"}
                      </Badge>
                    </TableCell>

                    {/* Status / Response Code */}
                    <TableCell>
                      <Badge className={getStatusBadgeStyle(log.responseCode)}>
                        {(log.responseCode ?? 200) >= 500 ? `❌ ${log.responseCode}` :
                         (log.responseCode ?? 200) >= 400 ? `⚠️ ${log.responseCode}` :
                         `✅ ${log.responseCode || 200}`}
                      </Badge>
                    </TableCell>

                    {/* Action — color-coded */}
                    <TableCell>
                      <Badge className={`${actionStyle.bg} ${actionStyle.text} ${actionStyle.border} border text-[10px] font-semibold`}>
                        {log.action}
                      </Badge>
                    </TableCell>

                    {/* Detail preview */}
                    <TableCell className="max-w-[300px]">
                      <span className="text-[11px] text-muted-foreground truncate block">
                        {getDetailPreview(log)}
                      </span>
                    </TableCell>

                    {/* Expand arrow */}
                    <TableCell>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={(e) => { e.stopPropagation(); handleLoadMore(); }}
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

      {/* Record count */}
      {logs.length > 0 && (
        <div className="text-center text-xs text-muted-foreground font-mono">
          {t("audit.showing_count", { count: logs.length })}
        </div>
      )}

      {/* Detail Drawer */}
      {selectedLog && (
        <DetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
