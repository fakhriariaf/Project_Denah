"use client";

import { usePathname } from "next/navigation";

/**
 * Menampilkan judul header yang sesuai berdasarkan pathname saat ini.
 * Digunakan oleh dashboard layout agar title berubah per halaman.
 */

const ROUTE_TITLES: { prefix: string; title: string }[] = [
  // Pengaturan — harus dicek sebelum /dashboard agar lebih spesifik
  { prefix: "/dashboard/users", title: "Pengaturan" },
  { prefix: "/dashboard/account", title: "Pengaturan" },
  { prefix: "/dashboard/audit", title: "Pengaturan" },
  // Dashboard utama
  { prefix: "/dashboard", title: "Dashboard" },
];

export function DashboardHeaderTitle() {
  const pathname = usePathname();

  // Ambil match paling spesifik (prefix terpanjang)
  const matched = ROUTE_TITLES
    .filter(({ prefix }) => pathname === prefix || pathname.startsWith(prefix + "/") || pathname === prefix)
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];

  return <span>{matched?.title ?? "Dashboard"}</span>;
}
