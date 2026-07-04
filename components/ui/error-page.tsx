"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  showDashboardLink?: boolean;
}

function truncateMessage(message: string, maxLength: number = 200): string {
  if (!message) return "Terjadi kesalahan yang tidak diketahui.";
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength) + "…";
}

export function ErrorPage({
  error,
  reset,
  title = "Terjadi Kesalahan",
  showDashboardLink = true,
}: ErrorPageProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[ErrorPage]", error);
      if (error.stack) {
        console.error("[ErrorPage] Stack:", error.stack);
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div
        className={cn(
          "max-w-md w-full bg-white/80 dark:bg-card/80 backdrop-blur-md",
          "border border-[#DDE8D8] dark:border-border rounded-2xl",
          "p-8 shadow-xl text-center space-y-6",
          "border-l-4 border-l-[#4F6F52]"
        )}
      >
        {/* Error Icon */}
        <div className="mx-auto w-16 h-16 bg-[#F5EBEB] dark:bg-rose-950/50 text-[#A94A4A] dark:text-rose-400 rounded-full flex items-center justify-center shadow-inner">
          <AlertTriangle className="w-8 h-8" />
        </div>

        {/* Heading and Description */}
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-[#2C3E2D] dark:text-foreground tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-[#5C6E5D] dark:text-muted-foreground leading-relaxed">
            {truncateMessage(error.message)}
          </p>
          {error.digest && (
            <p className="text-xs text-[#8FAF9A] dark:text-muted-foreground/70 font-mono mt-1">
              Kode: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-[#DDE8D8]/50 dark:border-border/50 flex flex-col items-center gap-3">
          <button
            onClick={reset}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl",
              "bg-[#4F6F52] dark:bg-primary text-white",
              "hover:bg-[#3d5940] dark:hover:bg-primary/90",
              "font-semibold text-sm transition-all",
              "shadow-md shadow-[#4F6F52]/20"
            )}
          >
            <RefreshCw className="w-4 h-4" />
            Coba Lagi
          </button>

          {showDashboardLink && (
            <Link
              href="/dashboard"
              className={cn(
                "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl",
                "text-[#4F6F52] dark:text-primary",
                "hover:bg-[#DDE8D8]/50 dark:hover:bg-muted",
                "font-medium text-sm transition-all"
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
