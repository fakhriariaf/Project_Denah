"use client";

import React, { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Hammer,
  HandshakeIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  markAsRead,
  markAllAsRead,
  getNotificationsPaginated,
} from "@/server/actions/notification";
import type { NotificationItem } from "@/server/actions/notification";

interface NotificationsClientProps {
  initialData: NotificationItem[];
  initialTotalCount: number;
  initialPage: number;
  initialTotalPages: number;
  initialType: string;
  initialStartDate: string;
  initialEndDate: string;
}

const NOTIFICATION_TYPES = [
  { value: "all", label: "Semua" },
  { value: "approval_pending", label: "Persetujuan" },
  { value: "kpr_sla", label: "SLA KPR" },
  { value: "spk_overdue", label: "SPK Overdue" },
  { value: "progress_done", label: "Progress Selesai" },
  { value: "info", label: "Informasi" },
  { value: "handover_waiting", label: "Menunggu Serah Terima" },
  { value: "handover_complete", label: "Serah Terima Selesai" },
];

function getNotificationUrl(item: NotificationItem): string {
  const { type, entityType, entityId } = item;

  if (type === "approval_pending") {
    if (entityType === "transaction") return "/finance/approvals";
    if (entityType === "payment") return "/finance?tab=payments";
    if (entityType === "material_request") return "/production?tab=materials";
  }

  switch (entityType) {
    case "lead":
      return "/marketing/leads";
    case "booking":
      return entityId ? `/marketing/bookings/${entityId}` : "/marketing/bookings";
    case "kpr_process":
    case "kpr":
      return "/marketing/kpr";
    case "payment":
    case "payment_reminder":
    case "invoice":
      return "/finance?tab=payments";
    case "transaction":
      return "/finance?tab=transactions";
    case "spk":
      return "/production?tab=spk";
    case "material_request":
      return "/production?tab=materials";
    case "complaint":
      return "/production?tab=complaints";
    case "unit_construction_ready":
      return entityId ? `/siteplan/${entityId}` : "/siteplan";
    case "unit":
      if (type === "progress_done") return "/production?tab=progress";
      return "/siteplan";
    case "unit_handover_wait":
      return entityId ? `/marketing/bookings/${entityId}` : "/marketing/bookings";
    case "waiting_list":
      return "/marketing/waiting-list";
    case "marketing_target":
      return "/marketing/targets";
    default:
      if (type === "kpr_sla") return "/marketing/kpr";
      if (type === "spk_overdue") return "/production?tab=spk";
      if (type === "progress_done") return "/production?tab=progress";
      if (type === "approval_pending") return "/finance/approvals";
      return "/dashboard";
  }
}

function renderIcon(type: string, entityType?: string | null) {
  const baseStyle = "p-2 rounded-lg flex items-center justify-center shrink-0 w-9 h-9 ";

  if (entityType === "unit_handover_wait" || type === "handover_waiting") {
    return (
      <div className={baseStyle + "bg-violet-100 text-violet-600"}>
        <CheckCircle2 className="w-5 h-5" />
      </div>
    );
  }
  if (entityType === "unit_construction_ready") {
    return (
      <div className={baseStyle + "bg-orange-100 text-orange-600"}>
        <Hammer className="w-5 h-5" />
      </div>
    );
  }
  switch (type) {
    case "approval_pending":
      return (
        <div className={baseStyle + "bg-amber-100 text-amber-600"}>
          <AlertCircle className="w-5 h-5" />
        </div>
      );
    case "kpr_sla":
      return (
        <div className={baseStyle + "bg-rose-100 text-rose-600"}>
          <Clock className="w-5 h-5" />
        </div>
      );
    case "spk_overdue":
      return (
        <div className={baseStyle + "bg-red-100 text-red-600"}>
          <AlertTriangle className="w-5 h-5" />
        </div>
      );
    case "progress_done":
      return (
        <div className={baseStyle + "bg-emerald-100 text-emerald-600"}>
          <CheckCircle2 className="w-5 h-5" />
        </div>
      );
    case "handover_complete":
      return (
        <div className={baseStyle + "bg-green-100 text-green-600"}>
          <HandshakeIcon className="w-5 h-5" />
        </div>
      );
    default:
      return (
        <div className={baseStyle + "bg-[#DDE8D8] text-[#4F6F52]"}>
          <Bell className="w-5 h-5" />
        </div>
      );
  }
}

function formatRelativeTime(date: Date): string {
  const elapsed = Date.now() - new Date(date).getTime();
  const secs = Math.floor(elapsed / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (secs < 60) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days < 30) return `${days} hari lalu`;
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function NotificationsClient({
  initialData,
  initialTotalCount,
  initialPage,
  initialTotalPages,
  initialType,
  initialStartDate,
  initialEndDate,
}: NotificationsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<NotificationItem[]>(initialData);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [type, setType] = useState(initialType);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  // Build URL and navigate (keeps filters in URL for refresh persistence)
  function updateUrl(params: { type?: string; startDate?: string; endDate?: string; page?: number }) {
    const newType = params.type ?? type;
    const newStart = params.startDate ?? startDate;
    const newEnd = params.endDate ?? endDate;
    const newPage = params.page ?? 1;

    const searchParams = new URLSearchParams();
    if (newType && newType !== "all") searchParams.set("type", newType);
    if (newStart) searchParams.set("startDate", newStart);
    if (newEnd) searchParams.set("endDate", newEnd);
    if (newPage > 1) searchParams.set("page", String(newPage));

    const qs = searchParams.toString();
    router.push(`/dashboard/notifications${qs ? `?${qs}` : ""}`);
  }

  function handleTypeChange(newType: string) {
    setType(newType);
    setPage(1);
    updateUrl({ type: newType, page: 1 });
  }

  function handleDateChange(field: "startDate" | "endDate", value: string) {
    if (field === "startDate") {
      setStartDate(value);
      updateUrl({ startDate: value, page: 1 });
    } else {
      setEndDate(value);
      updateUrl({ endDate: value, page: 1 });
    }
    setPage(1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    updateUrl({ page: newPage });
  }

  async function handleMarkAsRead(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await markAsRead(id);
      if (res.success) {
        setData((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      }
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  }

  async function handleMarkAllAsRead() {
    try {
      const res = await markAllAsRead();
      if (res.success) {
        setData((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  }

  function handleNotificationClick(item: NotificationItem) {
    if (!item.isRead) {
      markAsRead(item.id).catch(() => {});
    }
    const destination = getNotificationUrl(item);
    router.push(destination);
  }

  const unreadInView = data.filter((n) => !n.isRead).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Filters + Mark All */}
      <Card className="border-[#D6DED2]">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            {/* Type Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#66736A]">Tipe Notifikasi</label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="h-9 rounded-lg border border-[#D6DED2] bg-white px-3 text-xs font-medium text-[#243028] focus:ring-2 focus:ring-[#4F6F52]/20 focus:border-[#4F6F52] outline-none"
              >
                {NOTIFICATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#66736A]">Dari Tanggal</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleDateChange("startDate", e.target.value)}
                className="h-9 rounded-lg border border-[#D6DED2] bg-white px-3 text-xs font-medium text-[#243028] focus:ring-2 focus:ring-[#4F6F52]/20 focus:border-[#4F6F52] outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#66736A]">Sampai Tanggal</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleDateChange("endDate", e.target.value)}
                className="h-9 rounded-lg border border-[#D6DED2] bg-white px-3 text-xs font-medium text-[#243028] focus:ring-2 focus:ring-[#4F6F52]/20 focus:border-[#4F6F52] outline-none"
              />
            </div>

            {/* Mark All as Read */}
            <div className="md:ml-auto">
              {unreadInView > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="text-xs font-semibold text-[#4F6F52] border-[#8FAF9A]/50 hover:bg-[#DDE8D8]/50"
                >
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Tandai Semua Dibaca
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification List */}
      <Card className="border-[#D6DED2]">
        <CardContent className="p-0">
          {data.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-[#66736A] gap-3">
              <Bell className="w-12 h-12 opacity-30 text-[#8FAF9A]" />
              <span className="text-sm font-semibold">Tidak ada notifikasi</span>
              <span className="text-xs text-[#66736A]/70">
                {type !== "all" || startDate || endDate
                  ? "Coba ubah filter untuk melihat notifikasi lainnya"
                  : "Belum ada notifikasi yang masuk"}
              </span>
            </div>
          ) : (
            <div className="divide-y divide-[#D6DED2]">
              {data.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`flex gap-3 p-4 transition-colors hover:bg-[#F7F8F3]/60 relative cursor-pointer group ${
                    !item.isRead ? "bg-[#DDE8D8]/20" : ""
                  }`}
                >
                  {renderIcon(item.type, item.entityType)}

                  <div className="flex-1 min-w-0 pr-10">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm truncate ${
                          !item.isRead
                            ? "font-bold text-[#4F6F52]"
                            : "font-semibold text-[#243028]"
                        }`}
                      >
                        {item.title}
                      </p>
                      {!item.isRead && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0 bg-[#4F6F52]/10 text-[#4F6F52] font-bold shrink-0"
                        >
                          Baru
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-[#66736A] line-clamp-2 mt-1 leading-relaxed">
                      {item.message}
                    </p>
                    <p className="text-[10px] text-[#66736A]/75 mt-1.5 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-[#8FAF9A]" />
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>

                  {/* Mark as read button */}
                  {!item.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(item.id, e)}
                      title="Tandai dibaca"
                      className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[#DDE8D8]/60 text-[#4F6F52] rounded-full transition-all duration-200"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}

                  {/* Unread dot */}
                  {!item.isRead && (
                    <span className="absolute right-4 top-4 w-2 h-2 rounded-full bg-[#4F6F52] group-hover:hidden" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#66736A] font-medium">
            Halaman {page} dari {totalPages} ({totalCount} notifikasi)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              className="h-8 px-3 text-xs border-[#D6DED2]"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Sebelumnya
            </Button>
            <span className="text-xs font-mono font-bold text-[#4F6F52] px-2 tabular-nums">
              {page}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
              className="h-8 px-3 text-xs border-[#D6DED2]"
            >
              Berikutnya
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
