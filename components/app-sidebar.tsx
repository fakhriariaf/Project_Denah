"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { useI18n } from "@/lib/i18n"
import { LayoutDashboard, Users, Home, Map, CircleDollarSign, HardHat, FileText, Settings, Building2, Store, UserCog, User, Landmark, ShieldCheck, Banknote, Clock, Target, Wrench, Bell, GitCompareArrows, ChevronRight } from "lucide-react"
import { useNotificationPolling } from "@/hooks/use-notification-polling"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter,
} from "@/components/ui/sidebar"


const data = {
  navMain: [
    {
      tKey: "nav.dashboard",
      fallback: "Dashboard",
      items: [
        { tKey: "nav.dashboard", fallback: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
        { tKey: "nav.notifications", fallback: "Notifikasi", url: "/dashboard/notifications", icon: Bell },
        { tKey: "nav.compare", fallback: "Perbandingan Proyek", url: "/dashboard/compare", icon: GitCompareArrows },
        { tKey: "nav.masterData.siteplan", fallback: "Siteplan Interaktif", url: "/siteplan", icon: Map },
      ],
    },
    {
      tKey: "nav.masterData",
      fallback: "Master Data",
      items: [
        { tKey: "nav.masterData.projects", fallback: "Data Proyek", url: "/master/projects", icon: Home },
        { tKey: "nav.masterData.units", fallback: "Data Kavling & Unit", url: "/master/units", icon: Building2 },
        { tKey: "nav.masterData.customers", fallback: "Data Konsumen", url: "/master/customers", icon: Users },
        { tKey: "nav.masterData.vendors", fallback: "Data Vendor / Kontraktor", url: "/master/vendors", icon: Store },
        { tKey: "nav.masterData.categories", fallback: "Data Kategori Keuangan", url: "/master/categories", icon: FileText },
        { tKey: "nav.masterData.accounts", fallback: "Data Rekening Bank", url: "/master/accounts", icon: Landmark },
        { tKey: "nav.masterData.banks", fallback: "Data Bank Rekanan", url: "/master/banks", icon: Banknote },
        { tKey: "nav.masterData.workItems", fallback: "Data Item Pekerjaan & RAB", url: "/master/work-items", icon: Wrench },
      ],
    },
    {
      tKey: "nav.marketing",
      fallback: "Pemasaran & CRM",
      items: [
        { tKey: "nav.marketing.leads", fallback: "Prospek", url: "/marketing/leads", icon: Users },
        { tKey: "nav.marketing.waitingList", fallback: "Daftar Tunggu", url: "/marketing/waiting-list", icon: Clock },
        { tKey: "nav.marketing.bookings", fallback: "Booking Unit", url: "/marketing/bookings", icon: FileText },
        { tKey: "nav.marketing.kpr", fallback: "Pengajuan KPR", url: "/marketing/kpr", icon: CircleDollarSign },
        { tKey: "nav.marketing.targets", fallback: "Target Penjualan", url: "/marketing/targets", icon: Target },
        { tKey: "nav.finance", fallback: "Keuangan", url: "/finance", icon: Building2 },
        { tKey: "nav.production", fallback: "Konstruksi", url: "/production", icon: HardHat },
      ],
    },
    {
      tKey: "nav.reports",
      fallback: "Laporan & Analitik",
      items: [
        { tKey: "nav.reports", fallback: "Laporan & Analitik", url: "/reports", icon: FileText },
      ],
    },
    {
      tKey: "nav.settings",
      fallback: "Pengaturan",
      items: [
        { tKey: "nav.settings.users", fallback: "Manajemen Pengguna", url: "/dashboard/users", icon: UserCog },
        { tKey: "nav.settings.roles", fallback: "Peran & Hak Akses", url: "/settings/roles", icon: ShieldCheck },
        { tKey: "profile.myAccount", fallback: "Akun Saya", url: "/dashboard/account", icon: User },
        { tKey: "nav.settings.audit", fallback: "Audit Log", url: "/dashboard/audit", icon: FileText },
        { tKey: "nav.settings.page", fallback: "Pengaturan Sistem", url: "/settings", icon: Settings },
      ],
    },
  ],
}

// Define role permissions for each route/url mapping matching RBAC_MATRIX.md exactly
const rolePermissions: Record<string, string[]> = {
  "/dashboard": ["role_super_admin", "role_admin_kantor", "role_marketing_manager", "role_marketing", "role_admin_keuangan", "role_direksi", "role_pengawas", "role_vendor", "role_viewer"],
  "/dashboard/notifications": ["role_super_admin", "role_admin_kantor", "role_marketing_manager", "role_marketing", "role_admin_keuangan", "role_direksi", "role_pengawas", "role_vendor", "role_viewer"],
  "/dashboard/compare": ["role_super_admin", "role_admin_kantor", "role_direksi"],
  "/siteplan": ["role_super_admin", "role_admin_kantor", "role_marketing_manager", "role_marketing", "role_admin_keuangan", "role_direksi", "role_pengawas", "role_viewer"],
  "/master/projects": ["role_super_admin", "role_admin_kantor", "role_marketing_manager", "role_marketing", "role_admin_keuangan", "role_direksi", "role_pengawas", "role_viewer"],
  "/master/units": ["role_super_admin", "role_admin_kantor", "role_marketing_manager", "role_marketing", "role_admin_keuangan", "role_direksi", "role_pengawas", "role_viewer"],
  "/master/customers": ["role_super_admin", "role_admin_kantor", "role_marketing_manager", "role_marketing", "role_admin_keuangan", "role_direksi"],
  "/master/vendors": ["role_super_admin", "role_admin_kantor", "role_admin_keuangan", "role_direksi", "role_pengawas"],
  "/master/categories": ["role_super_admin", "role_admin_kantor", "role_admin_keuangan", "role_direksi"],
  "/master/accounts": ["role_super_admin", "role_admin_kantor", "role_admin_keuangan", "role_direksi"],
  "/master/banks": ["role_super_admin", "role_admin_kantor", "role_marketing_manager", "role_marketing", "role_admin_keuangan", "role_direksi"],
  "/master/work-items": ["role_super_admin", "role_admin_kantor", "role_direksi"],
  "/marketing/leads": ["role_super_admin", "role_admin_kantor", "role_marketing_manager", "role_marketing", "role_direksi"],
  "/marketing/waiting-list": ["role_super_admin", "role_admin_kantor", "role_marketing_manager", "role_marketing", "role_direksi"],
  "/marketing/bookings": ["role_super_admin", "role_admin_kantor", "role_marketing_manager", "role_marketing", "role_admin_keuangan", "role_direksi"],
  "/marketing/kpr": ["role_super_admin", "role_admin_kantor", "role_marketing_manager", "role_marketing", "role_direksi"],
  "/marketing/targets": ["role_super_admin", "role_admin_kantor", "role_marketing_manager", "role_direksi"],
  "/finance": ["role_super_admin", "role_admin_keuangan", "role_direksi"],
  "/production": ["role_super_admin", "role_admin_kantor", "role_admin_keuangan", "role_direksi", "role_pengawas", "role_vendor"],
  "/reports": ["role_super_admin", "role_admin_keuangan", "role_direksi"],
  "/dashboard/users": ["role_super_admin", "role_admin_kantor"],
  "/settings/roles": ["role_super_admin"],
  "/dashboard/account": ["role_super_admin", "role_admin_kantor", "role_marketing_manager", "role_marketing", "role_admin_keuangan", "role_direksi", "role_pengawas", "role_vendor", "role_viewer"],
  "/dashboard/audit": ["role_super_admin", "role_direksi"],
  "/settings": ["role_super_admin"],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const userRoleId = (session?.user as any)?.roleId
  const { t } = useI18n()

  const { unreadCount } = useNotificationPolling({ interval: 10000, enabled: !!session?.user })

  // Persistent Sidebar Scroll Position
  React.useEffect(() => {
    let scrollEl: HTMLElement | null = null;
    const handleScroll = () => {
      if (scrollEl) {
        sessionStorage.setItem("sidebar-scroll", String(scrollEl.scrollTop));
      }
    };

    const timer = setTimeout(() => {
      scrollEl = document.getElementById("app-sidebar-content");
      if (scrollEl) {
        const savedScroll = sessionStorage.getItem("sidebar-scroll");
        if (savedScroll) {
          scrollEl.scrollTop = parseInt(savedScroll, 10);
        }
        scrollEl.addEventListener("scroll", handleScroll);
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      if (scrollEl) {
        scrollEl.removeEventListener("scroll", handleScroll);
      }
    };
  }, [pathname]);

  // Check if the current item url is active
  const isActive = (url: string) => {
    if (url === "/dashboard") return pathname === "/dashboard";
    if (url === "/settings") return pathname === "/settings";
    return pathname.startsWith(url);
  }

  // Filter groups and items based on roleId
  const filteredNavMain = data.navMain.map((group) => {
    const items = group.items.filter((item) => {
      // Super Admin bypasses all checks
      if (userRoleId === "role_super_admin") return true;

      const allowedRoles = rolePermissions[item.url];
      if (!allowedRoles) return true; // default visible if not configured

      // Fallback to viewer if session is loading or not logged in yet
      const roleToCheck = userRoleId || "role_viewer";
      return allowedRoles.includes(roleToCheck);
    });

    return { ...group, items };
  }).filter((group) => group.items.length > 0);

  // All groups default to expanded (no collapsing needed)
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(() => {
    return new Set(filteredNavMain.map(g => g.tKey));
  });

  // Keep all groups expanded when nav changes
  React.useEffect(() => {
    setOpenGroups(new Set(filteredNavMain.map(g => g.tKey)));
  }, [filteredNavMain.length]);

  const toggleGroup = (tKey: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(tKey)) {
        next.delete(tKey);
      } else {
        next.add(tKey);
      }
      return next;
    });
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader className="border-b border-border/40 p-4">
        <div className="flex items-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold font-sans shadow-sm shrink-0">
            <span className="text-[10px] font-black tracking-tight">ERP</span>
          </div>
          <div className="ml-3 flex flex-col">
            <span className="font-bold text-sm text-foreground font-sans tracking-tight">Denah Property</span>
            <span className="text-[9px] text-muted-foreground font-semibold tracking-wider uppercase font-mono">Enterprise Portal</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent id="app-sidebar-content" className="py-2">
        {filteredNavMain.map((group) => {
          const isOpen = openGroups.has(group.tKey);
          return (
          <SidebarGroup key={group.tKey} className="px-3">
            <SidebarGroupLabel
              suppressHydrationWarning
              className="font-sans font-bold text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 py-1.5 cursor-pointer select-none flex items-center justify-between hover:text-muted-foreground transition-colors duration-150"
              onClick={() => toggleGroup(group.tKey)}
              role="button"
              aria-expanded={isOpen}
            >
              <span>{t(group.tKey as any) || group.fallback}</span>
              <ChevronRight className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
            </SidebarGroupLabel>
            <div
              className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out ${isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}
            >
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton 
                        render={<Link href={item.url} />} 
                        className={`font-sans font-semibold text-xs rounded-lg px-3.5 py-2.5 h-auto flex items-center gap-3 transition-all duration-200 relative
                          ${active 
                            ? "bg-secondary/70 text-secondary-foreground font-bold shadow-[inset_2px_0_0_currentColor] pl-[calc(0.875rem-2px)]" 
                            : "text-muted-foreground hover:text-secondary-foreground hover:bg-secondary/45 hover:translate-x-0.5"
                          }`}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 transition-transform duration-200 ${active ? "text-secondary-foreground" : "group-hover:scale-110"}`} />
                        <span suppressHydrationWarning>{t(item.tKey as any) || item.fallback}</span>
                        {item.url === "/dashboard" && unreadCount > 0 && (
                          <span className="ml-auto flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-success text-[9px] font-bold text-white font-mono tabular-nums animate-pulse shadow-sm shadow-primary/20">
                            {unreadCount}
                          </span>
                        )}
                        {item.url === "/dashboard/notifications" && unreadCount > 0 && (
                          <span className="ml-auto flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-success text-[9px] font-bold text-white font-mono tabular-nums animate-pulse shadow-sm shadow-primary/20">
                            {unreadCount}
                          </span>
                        )}
                        {active && item.url !== "/dashboard" && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-secondary-foreground" />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
            </div>
          </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )

}
