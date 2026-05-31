"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Check,
  Shield,
  Hammer,
  HandshakeIcon,
} from "lucide-react";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "@/server/actions/notification";
import { authClient } from "@/lib/auth-client";

interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  entityId: string | null;
  entityType: string | null;
  isRead: boolean;
  createdAt: Date;
}

function getNotificationUrl(item: NotificationItem): string {
  const { type, entityType, entityId } = item;
  
  // Specific notification type checks first
  if (type === "approval_pending") {
    if (entityType === "transaction") {
      return "/finance/approvals";
    }
    if (entityType === "payment") {
      return "/finance?tab=payments";
    }
    if (entityType === "material_request") {
      return "/production?tab=materials";
    }
  }

  // Fallback by entityType
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
      // entityId is the projectId — navigate directly to that siteplan
      return entityId ? `/siteplan/${entityId}` : "/siteplan";
    case "unit":
      if (type === "progress_done") {
        return "/production?tab=progress";
      }
      return "/siteplan";
    // Sprint 3: unit_handover_wait — prioritaskan bookingId deep link ke Booking Detail
    case "unit_handover_wait":
      // entityId = bookingId (set di triggerMenungguSerahTerima Sprint 2+3)
      // Booking Detail adalah tempat paling natural bagi Marketing
      return entityId ? `/marketing/bookings/${entityId}` : "/marketing/bookings";
    case "waiting_list":
      return "/marketing/waiting-list";
    case "marketing_target":
      return "/marketing/targets";
    default:
      // Fallback based on notification type if entityType is missing
      if (type === "kpr_sla") return "/marketing/kpr";
      if (type === "spk_overdue") return "/production?tab=spk";
      if (type === "progress_done") return "/production?tab=progress";
      if (type === "approval_pending") return "/finance/approvals";
      return "/dashboard";
  }
}

export function NotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Client auth session
  const { data: session } = authClient.useSession();
  const roleId = (session?.user as any)?.roleId;

  // Load notifications data
  const loadData = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);

      const items = await getNotifications();
      // Items returned from server are serializable, map dates back to Date instances
      const parsedItems = items.map((x) => ({
        ...x,
        createdAt: new Date(x.createdAt),
      })) as NotificationItem[];

      setNotifications(parsedItems);
    } catch (err) {
      console.warn("Failed to load notifications:", err);
    }
  };

  // Poll data periodically
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // refresh every 15 seconds
    return () => clearInterval(interval);
  }, []);

  // Click away listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await markAsRead(id);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await markAllAsRead();
      if (res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (item: NotificationItem, e: React.MouseEvent) => {
    setIsOpen(false);
    if (!item.isRead) {
      try {
        const res = await markAsRead(item.id);
        if (res.success) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
          );
          setUnreadCount((c) => Math.max(0, c - 1));
        }
      } catch (err) {
        console.warn("Failed to mark notification as read:", err);
      }
    }
    const destination = getNotificationUrl(item);
    router.push(destination);
  };

  // Human friendly relative time format
  const formatRelativeTime = (date: Date) => {
    // eslint-disable-next-line react-hooks/purity
    const elapsed = Date.now() - date.getTime();
    const secs = Math.floor(elapsed / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (secs < 60) return "Baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    return `${days} hari lalu`;
  };

  // Return icons based on notification type and entityType
  const renderIcon = (type: string, entityType?: string | null) => {
    const baseStyle = "p-2 rounded-lg flex items-center justify-center shrink-0 w-9 h-9 ";
    // Priority: check entityType for specialized icons
    // Sprint 3: Notifikasi serah terima — icon violet
    if (entityType === "unit_handover_wait" || type === "handover_waiting") {
      return (
        <div className={baseStyle + "bg-violet-100 text-violet-600"}>
          <CheckCircle2 className="w-5 h-5" />
        </div>
      );
    }
    if (entityType === "unit_construction_ready") {
      return (
        <div className={baseStyle + "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"}>
          <Hammer className="w-5 h-5" />
        </div>
      );
    }
    switch (type) {
      case "approval_pending":
        return (
          <div className={baseStyle + "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"}>
            <AlertCircle className="w-5 h-5" />
          </div>
        );
      case "kpr_sla":
        return (
          <div className={baseStyle + "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"}>
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
        );
      case "spk_overdue":
        return (
          <div className={baseStyle + "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"}>
            <AlertTriangle className="w-5 h-5 animate-bounce" />
          </div>
        );
      case "progress_done":
        return (
          <div className={baseStyle + "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"}>
            <CheckCircle2 className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className={baseStyle + "bg-[#DDE8D8] text-[#4F6F52]"}>
            <Bell className="w-5 h-5" />
          </div>
        );
    }
  };

  // Configure role-specific guidance message
  let roleName = "Staf / Viewer";
  let roleHighlight = "Mode Baca";
  let roleAlert = "Dapat melihat denah siteplan interaktif dan perkembangan unit secara real-time.";
  
  if (roleId === "role_super_admin") {
    roleName = "Super Admin";
    roleHighlight = "Akses Penuh";
    roleAlert = "Memiliki kontrol penuh untuk verifikasi transaksi keuangan, monitoring SPK kontraktor, persetujuan data, serta audit log.";
  } else if (roleId === "role_direksi") {
    roleName = "Direktur / Manager";
    roleHighlight = "Persetujuan Dana";
    roleAlert = "Meninjau pengajuan Kas Keluar (RAB) dari Lapangan & memvalidasi SPK Kontraktor pembangunan.";
  } else if (roleId === "role_admin_keuangan") {
    roleName = "Admin Keuangan";
    roleHighlight = "Verifikasi Kas";
    roleAlert = "Memproses invoice, memverifikasi kas masuk/booking fee, serta menyiapkan pencairan dana lapangan.";
  } else if (roleId === "role_marketing") {
    roleName = "Tim Marketing";
    roleHighlight = "Pipeline & SLA";
    roleAlert = "Memantau berkas KPR konsumen agar tidak melebihi SLA 5 hari, proses booking, serta kelola prospek Leads.";
  } else if (roleId === "role_pengawas") {
    roleName = "Pengawas Lapangan";
    roleHighlight = "Progress & SPK";
    roleAlert = "Input kemajuan konstruksi fisik unit, verifikasi kesiapan lahan, serta ajukan SPMB pekerjaan.";
  } else if (roleId === "role_vendor") {
    roleName = "Vendor / Kontraktor";
    roleHighlight = "Konstruksi Fisik";
    roleAlert = "Laksanakan pembangunan fisik unit sesuai SPK aktif, upload foto progres, serta ajukan material request.";
  }

  // Dynamic alert highlights based on database notifications
  const hasApprovalPending = notifications.some((n) => !n.isRead && n.type === "approval_pending");
  const hasKprSlaWarning = notifications.some((n) => !n.isRead && n.type === "kpr_sla");
  const hasSpkOverdueWarning = notifications.some((n) => !n.isRead && n.type === "spk_overdue");
  // Sprint 3: Deteksi notifikasi serah terima yang belum dibaca
  const hasHandoverWaiting = notifications.some(
    (n) => !n.isRead && (n.type === "handover_waiting" || n.entityType === "unit_handover_wait")
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-all duration-200 focus:outline-none group"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12 group-hover:text-[#4F6F52]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white ring-2 ring-background animate-pulse font-mono tabular-nums">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-85 sm:w-98 z-50 rounded-2xl border border-[#D6DED2] bg-white/95 backdrop-blur-md text-card-foreground shadow-sage-lg p-0 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#F7F8F3]/80 border-b border-[#D6DED2]">
            <div className="flex items-center gap-2">
              <span className="font-sans font-bold text-sm text-[#243028]">Notifikasi</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-600/10 text-emerald-700 rounded-full tabular-nums">
                  {unreadCount} Unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 hover:underline"
              >
                <Check className="w-3.5 h-3.5" />
                Semua dibaca
              </button>
            )}
          </div>

          {/* Quick RBAC Insight Card */}
          {session?.user && (
            <div className="mx-4 mt-3 mb-2 p-3 bg-[#DDE8D8]/45 border border-[#8FAF9A]/30 rounded-xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#4F6F52]" />
              <div className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-[#4F6F52] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 justify-between">
                    <span className="text-[9px] font-mono tracking-wider font-bold text-[#4F6F52] uppercase">
                      {roleName}
                    </span>
                    <span className="text-[8px] font-bold bg-[#4F6F52]/10 text-[#4F6F52] px-1.5 py-0.5 rounded-full">
                      {roleHighlight}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#66736A] mt-1 font-sans leading-relaxed">
                    {roleAlert}
                  </p>
                  
                  {/* Dynamic context warnings */}
                  {roleId === "role_direksi" && hasApprovalPending && (
                    <div className="mt-2 text-[9px] font-bold text-amber-600 flex items-center gap-1 bg-amber-50/50 p-1 rounded border border-amber-200/50">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Ada pengajuan dana menunggu persetujuan Anda!
                    </div>
                  )}
                  {roleId === "role_marketing" && hasKprSlaWarning && (
                    <div className="mt-2 text-[9px] font-bold text-rose-600 flex items-center gap-1 bg-rose-50/50 p-1 rounded border border-rose-200/50 animate-pulse">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      Berkas KPR melewati SLA! Segera hubungi konsumen.
                    </div>
                  )}
                  {/* Sprint 3: Serah terima pending warning untuk Marketing */}
                  {roleId === "role_marketing" && hasHandoverWaiting && (
                    <div className="mt-2 text-[9px] font-bold text-violet-700 flex items-center gap-1 bg-violet-50/50 p-1 rounded border border-violet-200/50">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Ada unit yang menunggu jadwal serah terima!
                    </div>
                  )}
                  {(roleId === "role_pengawas" || roleId === "role_vendor") && hasSpkOverdueWarning && (
                    <div className="mt-2 text-[9px] font-bold text-red-600 flex items-center gap-1 bg-red-50/50 p-1 rounded border border-red-200/50">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Proyek unit terdeteksi overdue/terlambat!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* List Area */}
          <div className="max-h-[300px] overflow-y-auto divide-y divide-[#D6DED2]">
            {notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-[#66736A] gap-2">
                <Bell className="w-8 h-8 opacity-45 text-[#8FAF9A]" />
                <span className="text-xs font-semibold">Belum ada notifikasi baru</span>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`flex gap-3 p-4 transition-colors hover:bg-[#F7F8F3]/60 relative cursor-pointer group ${
                    !item.isRead ? "bg-[#DDE8D8]/15" : ""
                  }`}
                  onClick={(e) => handleNotificationClick(item, e)}
                >
                  {renderIcon(item.type, item.entityType)}
                  
                  <div className="flex-1 min-w-0 pr-4">
                    <p className={`text-xs font-semibold truncate text-[#243028] ${!item.isRead ? "font-bold text-[#4F6F52]" : ""}`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-[#66736A] line-clamp-2 mt-1 leading-relaxed">
                      {item.message}
                    </p>
                    <p className="text-[9px] text-[#66736A]/75 mt-1.5 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-[#8FAF9A]" />
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>

                  {/* Single Read Checkmark Button */}
                  {!item.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(item.id, e)}
                      title="Tandai dibaca"
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[#DDE8D8]/45 text-[#4F6F52] rounded-full transition-all duration-200"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}

                  {/* Small Unread dot on the right side if hovered is false */}
                  {!item.isRead && (
                    <span className="absolute right-4 top-4 w-2 h-2 rounded-full bg-[#4F6F52] group-hover:hidden" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
