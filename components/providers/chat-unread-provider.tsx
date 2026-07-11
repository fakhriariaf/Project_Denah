"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export interface ChatUnreadContextValue {
  totalUnread: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const ChatUnreadContext = createContext<ChatUnreadContextValue | null>(null);

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function ChatUnreadProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [totalUnread, setTotalUnread] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const prevUnreadRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const pathnameRef = useRef(pathname);

  // Keep pathname ref in sync for use in callbacks
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const enabled = !!session?.user;

  const fetchUnreadCount = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setIsLoading(true);
      const res = await fetch("/api/chat/unread-count");

      if (!isMountedRef.current) return;

      if (!res.ok) {
        // On failure, retain last known totalUnread — don't reset to 0
        return;
      }

      const data: { totalUnread: number } = await res.json();
      if (!isMountedRef.current) return;

      const newCount = data.totalUnread;
      const prevCount = prevUnreadRef.current;

      // Detect increase for toast notification
      if (newCount > prevCount && !pathnameRef.current.startsWith("/chat")) {
        const delta = newCount - prevCount;
        toast(`${delta} pesan baru`, {
          duration: 5000,
          action: {
            label: "Buka Chat",
            onClick: () => router.push("/chat"),
          },
        });
      }

      prevUnreadRef.current = newCount;
      setTotalUnread(newCount);
    } catch {
      // On fetch failure: retain last known totalUnread, don't reset to 0
      // Will retry on next cycle
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [router]);

  const refresh = useCallback(async () => {
    await fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Start/stop polling based on enabled state and visibility
  useEffect(() => {
    if (!enabled) return;

    isMountedRef.current = true;

    const startPolling = () => {
      // Immediate fetch
      fetchUnreadCount();
      // Clear any existing interval
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Tab visible: immediate fetch + restart interval
        startPolling();
      } else {
        // Tab hidden: pause polling
        stopPolling();
      }
    };

    // Initial start (only if tab is visible)
    if (document.visibilityState === "visible") {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, fetchUnreadCount]);

  const value: ChatUnreadContextValue = {
    totalUnread,
    isLoading,
    refresh,
  };

  return (
    <ChatUnreadContext.Provider value={value}>
      {children}
    </ChatUnreadContext.Provider>
  );
}

export function useChatUnread(): ChatUnreadContextValue {
  const ctx = useContext(ChatUnreadContext);
  if (!ctx) {
    throw new Error("useChatUnread must be used within ChatUnreadProvider");
  }
  return ctx;
}
