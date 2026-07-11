"use client";

import { createContext, useContext, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import {
  useNotificationPolling,
  type UseNotificationPollingResult,
} from "@/hooks/use-notification-polling";
import type { NotificationItem } from "@/server/actions/notification";

export interface NotificationContextValue {
  unreadCount: number;
  latestNotification: NotificationItem | null;
  hasNewSince: boolean;
  resetNewSince: () => void;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();

  const polling: UseNotificationPollingResult = useNotificationPolling({
    interval: 10000,
    enabled: !!session?.user,
  });

  const value: NotificationContextValue = {
    unreadCount: polling.unreadCount,
    latestNotification: polling.latestNotification,
    hasNewSince: polling.hasNewSince,
    resetNewSince: polling.resetNewSince,
    refresh: polling.refresh,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotificationContext must be used within NotificationProvider"
    );
  }
  return ctx;
}
