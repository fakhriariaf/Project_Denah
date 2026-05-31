/**
 * Utility functions for consistent formatting in the Indonesian locale.
 */

/**
 * Formats a numeric value into Indonesian Rupiah currency format.
 * Example: 1000000 -> "Rp 1.000.000"
 */
export function formatRupiah(val: number | null | undefined): string {
  if (val === null || val === undefined) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
}

/**
 * Formats a Date object or ISO date string into a readable Indonesian date.
 * Example: Date object -> "22 Mei 2026"
 */
export function formatDate(
  date: Date | string | null | undefined,
  locale: string = "id-ID"
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Formats a numeric value into a percentage string.
 * Example: 85 -> "85%"
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0%";
  return `${value}%`;
}
