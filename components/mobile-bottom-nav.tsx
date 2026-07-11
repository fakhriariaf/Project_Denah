"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Target,
  MessageCircle,
  CircleDollarSign,
  Menu,
} from "lucide-react";
import { ChatBadge } from "@/app/chat/_components/chat-badge";

const NAV_ITEMS = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Marketing", href: "/marketing/bookings", icon: Target },
  { label: "Chat", href: "/chat", icon: MessageCircle },
  { label: "Keuangan", href: "/finance", icon: CircleDollarSign },
  { label: "Lainnya", href: "/master/projects", icon: Menu },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  // Don't render on login/auth pages, public pages, or chat (has own mobile layout)
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/maintenance") ||
    pathname.startsWith("/siteplan-public") ||
    pathname.startsWith("/chat") ||
    pathname === "/"
  ) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background/80 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-150 active:scale-95 min-w-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? "text-primary bg-secondary/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
                {item.href === "/chat" && (
                  <span className="absolute -top-1.5 -right-2.5">
                    <ChatBadge />
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
