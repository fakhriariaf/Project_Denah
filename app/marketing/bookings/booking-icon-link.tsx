"use client";

import { useI18n } from "@/lib/i18n";
import { Printer, Eye, Upload } from "lucide-react";
import Link from "next/link";

interface BookingIconLinkProps {
  href: string;
  type: "print" | "view" | "upload";
  className?: string;
}

/**
 * Icon links in booking table row that need i18n `title` attribute.
 * Replaces <Translate render={(t) => <a title={t}...>}> pattern which
 * cannot be used in Server Components (functions aren't serialisable).
 */
export function BookingIconLink({ href, type, className }: BookingIconLinkProps) {
  const { t } = useI18n();

  const titleMap: Record<BookingIconLinkProps["type"], string> = {
    print: t("booking.print_btn") || "Cetak Kuitansi",
    view: t("booking.view_btn") || "Lihat Detail",
    upload: t("booking.upload_btn_title") || "Upload Bukti Bayar",
  };

  const title = titleMap[type];

  if (type === "print") {
    return (
      <Link
        href={href}
        className={
          className ??
          "h-8 w-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:bg-secondary/30 flex items-center justify-center transition-all shadow-sm"
        }
        title={title}
      >
        <Printer className="h-3.5 w-3.5" />
      </Link>
    );
  }

  if (type === "upload") {
    return (
      <Link
        href={href}
        className={
          className ??
          "h-8 px-2.5 rounded-lg border border-border bg-card text-primary hover:bg-secondary/30 hover:border-primary/50 flex items-center gap-1.5 transition-all shadow-sm text-xs font-semibold"
        }
        title={title}
      >
        <Upload className="h-3.5 w-3.5" />
        <span className="hidden md:inline">{t("booking.upload_btn") || "Upload"}</span>
      </Link>
    );
  }

  // "view"
  return (
    <Link
      href={href}
      className={
        className ??
        "h-8 w-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:bg-secondary/30 flex items-center justify-center transition-all shadow-sm shrink-0"
      }
      title={title}
    >
      <Eye className="h-3.5 w-3.5" />
    </Link>
  );
}
