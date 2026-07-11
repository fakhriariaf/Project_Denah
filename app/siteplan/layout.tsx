import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { NotificationDropdown } from "@/components/dashboard/notification-dropdown"
import { ChatNavButton } from "@/components/dashboard/chat-nav-button"
import { UserIdentityDropdown } from "@/components/dashboard/user-identity-dropdown"
import { CommandPalette } from "@/components/global-search/command-palette"
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help"
import { AutoBreadcrumb } from "@/components/auto-breadcrumb"
import { requireAuth, getSessionRole } from "@/server/permissions"
import { redirect } from "next/navigation"
import { Translate } from "@/components/translate"

export default async function SiteplanLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // RBAC: Siteplan accessible by all internal roles except Viewer-only external accounts
  // Vendor (Kontraktor) and pure Viewers do NOT get access to siteplan management
  const activeUser = await requireAuth();
  const { isSuperAdmin, isAdminKantor, isMarketing, isMarketingManager, isDireksi, isPengawas, isKeuangan } = await getSessionRole(activeUser.id);

  const hasAccess = isSuperAdmin || isAdminKantor || isMarketing || isMarketingManager || isDireksi || isPengawas || isKeuangan;
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
            <h1 className="font-semibold text-lg font-sans"><Translate namespace="dash" translationKey="menu_siteplan" /></h1>
          </div>
          <div className="flex items-center gap-2">
            <ChatNavButton />
            <NotificationDropdown />
            <UserIdentityDropdown />
          </div>
        </header>
        <CommandPalette />
        <KeyboardShortcutsHelp />
        <div id="main-content" className="flex flex-1 flex-col gap-4 p-4 md:gap-5 md:p-5 lg:gap-6 lg:p-6 bg-background">
          <AutoBreadcrumb className="px-1" />
          {children}
        </div>
      </main>
    </SidebarProvider>
  )
}
