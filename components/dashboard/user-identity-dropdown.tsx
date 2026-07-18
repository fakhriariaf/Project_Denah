"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { User, LogOut, Settings, Sun, Moon, ChevronDown } from "lucide-react";

// Role label map
const roleLabels: Record<string, { label: string; color: string }> = {
  role_super_admin:      { label: "Super Admin",        color: "bg-violet-100 text-violet-700" },
  role_admin_kantor:     { label: "Admin Kantor",       color: "bg-blue-100 text-blue-700" },
  role_marketing_manager:{ label: "Marketing Manager",  color: "bg-emerald-100 text-emerald-700" },
  role_marketing:        { label: "Marketing",          color: "bg-teal-100 text-teal-700" },
  role_admin_keuangan:   { label: "Admin Keuangan",     color: "bg-amber-100 text-amber-700" },
  role_direksi:          { label: "Direksi",            color: "bg-indigo-100 text-indigo-700" },
  role_pengawas:         { label: "Pengawas Lapangan",  color: "bg-orange-100 text-orange-700" },
  role_vendor:           { label: "Vendor / Kontraktor","color": "bg-slate-100 text-slate-700" },
  role_viewer:           { label: "Viewer",             color: "bg-gray-100 text-gray-600" },
};

export function UserIdentityDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMounted, setIsMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data: session } = authClient.useSession();
  const user = session?.user as any;
  const roleId = user?.roleId as string | undefined;
  const roleInfo = roleId ? roleLabels[roleId] : undefined;

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  // Mark as mounted on client — prevents theme-driven hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync theme state with document on mount
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  // Close on click outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleTheme = () => {
    // Dark mode disabled — app is locked to light mode
  };

  const handleLogout = async () => {
    setIsOpen(false);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
          router.refresh();
        },
      },
    });
  };

  // authClient.useSession() can resolve before the first client render while the
  // server has no session snapshot. Render this exact neutral shape on both
  // sides of hydration; only read session-derived content after mounting.
  if (!isMounted) {
    return (
      <div className="relative" aria-hidden="true">
        <div className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl border border-border bg-card">
          <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center font-black text-[10px] shrink-0 border border-primary/30">
            ?
          </div>
          <ChevronDown className="h-3 w-3 text-primary shrink-0" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── TRIGGER BUTTON ── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="User menu"
        className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl border transition-all duration-200 group ${
          isOpen
            ? "border-primary bg-secondary/40 shadow-[0_2px_8px_rgba(79,111,82,0.12)]"
            : "border-border bg-card hover:border-primary hover:bg-secondary/20 hover:shadow-sage"
        }`}
      >
        {/* Avatar */}
        <div className="relative h-7 w-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-black text-[10px] shrink-0 border border-primary/30">
          {initials}
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border-[1.5px] border-white" />
        </div>

        {/* Name + role — hidden on mobile */}
        <div className="hidden sm:flex flex-col items-start min-w-0 max-w-[120px]">
          <span className="text-[11px] font-bold text-foreground truncate leading-tight font-sans">
            {user.name}
          </span>
          {roleInfo && (
            <span className={`text-[8px] font-bold font-mono tracking-wider uppercase px-1 py-0 rounded ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
          )}
        </div>

        <ChevronDown
          className="h-3 w-3 text-primary shrink-0 transition-transform duration-200 group-hover:text-primary-dark"
        />
      </button>

      {/* ── DROPDOWN PANEL ── */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 z-50 rounded-2xl border border-border bg-card backdrop-blur-md shadow-sage-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* User Identity Header */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-secondary/60 to-transparent border-b border-border">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-sm shrink-0 shadow-[0_2px_8px_rgba(79,111,82,0.3)]">
                {initials}
                <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-foreground truncate font-sans">{user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate font-mono">{user.email}</p>
                {roleInfo && (
                  <span className={`inline-block mt-0.5 text-[8px] font-bold font-mono tracking-widest uppercase px-1.5 py-0.5 rounded-full ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-1.5 space-y-0.5">
            {/* Account Link */}
            <Link
              href="/dashboard/account"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground font-semibold hover:bg-secondary/40 hover:text-secondary-foreground transition-all duration-150 group"
            >
              <div className="h-7 w-7 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0 group-hover:bg-secondary transition-colors">
                <User className="h-3.5 w-3.5 text-secondary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">Akun &amp; Profil Saya</p>
                <p className="text-[10px] text-primary font-normal">Pengaturan akun personal</p>
              </div>
              <Settings className="h-3.5 w-3.5 text-primary shrink-0 group-hover:rotate-45 transition-transform duration-300" />
            </Link>

            {/* Theme Toggle */}
            {/* Theme toggle removed — app locked to light mode */}

            {/* Divider */}
            <div className="my-1 border-t border-border/60" />

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all duration-150 group"
            >
              <div className="h-7 w-7 rounded-lg bg-rose-50 flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors">
                <LogOut className="h-3.5 w-3.5 text-rose-500" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold">Keluar</p>
                <p className="text-[10px] text-rose-400 font-normal">Akhiri sesi login</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );

}
