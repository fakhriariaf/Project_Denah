"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * AutoBreadcrumb — derives a breadcrumb trail from the current pathname.
 *
 * Segment labels are resolved from SEGMENT_LABELS; unknown segments fall back
 * to a title-cased version. Dynamic id segments (uuid/numeric) are shown as
 * "Detail" and rendered as the current page.
 */

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  finance: "Keuangan",
  marketing: "Pemasaran",
  production: "Konstruksi",
  reports: "Laporan",
  settings: "Pengaturan",
  siteplan: "Siteplan",
  master: "Master Data",
  notifications: "Notifikasi",
  compare: "Perbandingan Proyek",
  audit: "Audit Log",
  account: "Akun Saya",
  users: "Manajemen Pengguna",
  roles: "Peran & Hak Akses",
  approvals: "Persetujuan",
  invoices: "Invoice",
  bookings: "Booking Unit",
  leads: "Prospek",
  kpr: "Pengajuan KPR",
  targets: "Target Penjualan",
  "waiting-list": "Daftar Tunggu",
  complaints: "Komplain",
  projects: "Data Proyek",
  units: "Data Kavling & Unit",
  customers: "Data Konsumen",
  vendors: "Data Vendor",
  categories: "Kategori Keuangan",
  accounts: "Rekening Bank",
  banks: "Bank Rekanan",
  "work-items": "Item Pekerjaan",
};

/** A segment that looks like a DB id (uuid or long/numeric) → shown as "Detail". */
function isIdSegment(seg: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || // uuid
    /^\d+$/.test(seg) || // numeric id
    seg.length >= 20 // long opaque id
  );
}

function labelFor(seg: string): string {
  if (SEGMENT_LABELS[seg]) return SEGMENT_LABELS[seg];
  if (isIdSegment(seg)) return "Detail";
  return seg
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AutoBreadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Don't render a lone crumb on top-level pages.
  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => ({
    label: labelFor(seg),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {crumbs.map((crumb) => (
          <React.Fragment key={crumb.href}>
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {!crumb.isLast && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
