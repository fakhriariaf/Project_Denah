import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { NotificationDropdown } from "@/components/dashboard/notification-dropdown"
import { UserIdentityDropdown } from "@/components/dashboard/user-identity-dropdown"

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <a
        href="#chat-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Lompat ke konten utama
      </a>
      <AppSidebar />
      <main className="w-full flex-1 overflow-hidden flex flex-col h-screen max-h-screen">
        <header className="flex h-14 lg:h-[60px] shrink-0 items-center justify-between border-b bg-muted/40 px-6 gap-4">
          <div className="flex items-center gap-4 flex-1">
            <SidebarTrigger />
            <h1 className="font-semibold text-lg font-sans">Chat</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationDropdown />
            <UserIdentityDropdown />
          </div>
        </header>
        <div id="chat-content" className="flex flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </main>
    </SidebarProvider>
  )
}
