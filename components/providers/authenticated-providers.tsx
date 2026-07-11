"use client";

import { NotificationProvider } from "@/components/providers/notification-provider";
import { ChatUnreadProvider } from "@/components/providers/chat-unread-provider";
import type { ReactNode } from "react";

/**
 * Wrapper yang menyatukan semua provider untuk fitur authenticated.
 * Kedua provider sudah guard internal dengan `enabled: !!session?.user`,
 * sehingga tidak akan polling di halaman publik (login, maintenance, siteplan-public).
 * Cukup satu instance di root layout — tidak perlu instance duplikat di mana pun.
 */
export function AuthenticatedProviders({ children }: { children: ReactNode }) {
  return (
    <NotificationProvider>
      <ChatUnreadProvider>{children}</ChatUnreadProvider>
    </NotificationProvider>
  );
}
