/**
 * Finance-specific CSV export utility.
 *
 * Generates a CSV file with UTF-8 BOM prefix for Excel compatibility,
 * using a structured column definition and programmatic download.
 *
 * @see Requirements 9.4 — Export menggunakan CSV client-side
 */

export interface CsvExportOptions {
  reportType:
    | "arus-kas"
    | "piutang"
    | "pengeluaran"
    | "realisasi-anggaran"
    | "buku-kas";
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  data: Record<string, unknown>[];
  columns: Array<{ key: string; header: string }>;
}

/**
 * Escapes a single CSV cell value.
 * Wraps in double-quotes if the value contains commas, quotes, or newlines.
 * Internal double-quotes are escaped by doubling them.
 */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Export finance report data to a CSV file and trigger browser download.
 *
 * - Prefixes content with UTF-8 BOM (`\uFEFF`) so Excel opens it correctly.
 * - File naming: `laporan-{reportType}-{startDate}-{endDate}.csv`
 * - Download via Blob + URL.createObjectURL + programmatic `<a>` click.
 * - No new endpoints or libraries required.
 */
export function exportFinanceCsv(options: CsvExportOptions): void {
  const { reportType, startDate, endDate, data, columns } = options;

  // Build header row from column definitions
  const headerRow = columns.map((col) => escapeCsvCell(col.header)).join(",");

  // Build data rows by looking up each column key in each data record
  const dataRows = data.map((row) =>
    columns.map((col) => escapeCsvCell(row[col.key])).join(",")
  );

  // Combine all rows with CRLF line endings (CSV standard)
  const csvContent = [headerRow, ...dataRows].join("\r\n");

  // Prepend UTF-8 BOM for Excel compatibility
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], {
    type: "text/csv;charset=utf-8",
  });

  // Generate filename: laporan-{reportType}-{startDate}-{endDate}.csv
  const filename = `laporan-${reportType}-${startDate}-${endDate}.csv`;

  // Programmatic download via <a> element
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up object URL after download
  URL.revokeObjectURL(url);
}
