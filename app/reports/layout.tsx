import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { NotificationDropdown } from "@/components/dashboard/notification-dropdown"
import { UserIdentityDropdown } from "@/components/dashboard/user-identity-dropdown"
import { requireAuth, getSessionRole } from "@/server/permissions"
import { redirect } from "next/navigation"
import { Translate } from "@/components/translate"

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // RBAC: Reports accessible by management and finance roles only
  // Marketing, Pengawas Lapangan, Vendor, Viewer cannot access financial reports
  const activeUser = await requireAuth();
  const { isSuperAdmin, isAdminKantor, isKeuangan, isDireksi } = await getSessionRole(activeUser.id);

  const hasAccess = isSuperAdmin || isAdminKantor || isKeuangan || isDireksi;
  if (!hasAccess) {
    redirect("/unauthorized");
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full flex-1 overflow-hidden flex flex-col min-h-screen">
        <header className="flex h-14 lg:h-[60px] items-center justify-between border-b bg-muted/40 px-6 gap-4">
          <div className="flex items-center gap-4 flex-1">
            <SidebarTrigger />
            <h1 className="font-semibold text-lg font-inter"><Translate namespace="dash" translationKey="menu_reports" /></h1>
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
