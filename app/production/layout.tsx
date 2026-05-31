import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { NotificationDropdown } from "@/components/dashboard/notification-dropdown"
import { UserIdentityDropdown } from "@/components/dashboard/user-identity-dropdown"
import { requireAuth, getSessionRole } from "@/server/permissions"
import { redirect } from "next/navigation"
import { Translate } from "@/components/translate"

export default async function ProductionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // RBAC: Production accessible by Super Admin, Admin Kantor, Pengawas Lapangan, Vendor, Direksi
  // Marketing Biasa and Admin Keuangan get read-only views but not full access
  const activeUser = await requireAuth();
  const { isSuperAdmin, isAdminKantor, isDireksi, isKeuangan } = await getSessionRole(activeUser.id);
  
  // Get full role info
  const sessionRoleInfo = await getSessionRole(activeUser.id);
  const role = sessionRoleInfo.role;
  const allowedRoles = ["Super Admin", "Admin Kantor", "Pengawas Lapangan", "Kontraktor / Vendor", "Direksi / Manager"];
  
  if (!isSuperAdmin && !allowedRoles.includes(role)) {
    redirect("/unauthorized");
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full flex-1 overflow-hidden flex flex-col min-h-screen">
        <header className="flex h-14 lg:h-[60px] items-center justify-between border-b bg-muted/40 px-6 gap-4">
          <div className="flex items-center gap-4 flex-1">
            <SidebarTrigger />
            <h1 className="font-semibold text-lg font-sans text-primary font-inter"><Translate namespace="dash" translationKey="menu_production" /></h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationDropdown />
            <UserIdentityDropdown />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
          {children}
        </div>
      </main>
    </SidebarProvider>
  )
}
