/**
 * Utility functions for exporting datasets to CSV spreadsheets directly in the browser.
 */

/**
 * Export a JSON array of objects to a UTF-8 encoded CSV file compatible with Excel.
 * 
 * @param data Array of objects containing row values.
 * @param headers Mapping of object keys to user-facing column titles. Example: { unitCode: "Kode Unit", price: "Harga" }
 * @param filename Desired name of the downloaded file (without extension).
 */
export function exportToCsv(
  data: Array<Record<string, any>>,
  headers: Record<string, string>,
  filename: string
) {
  if (data.length === 0) {
    return false;
  }

  const headerKeys = Object.keys(headers);
  const headerTitles = Object.values(headers);

  // 1. Build Header row
  const csvRows = [headerTitles.map(title => escapeCsvValue(title)).join(",")];

  // 2. Build Data rows
  for (const row of data) {
    const values = headerKeys.map(key => {
      const val = row[key];
      
      // Formatting options
      if (val === null || val === undefined) {
        return "";
      }
      if (typeof val === "number") {
        return val;
      }
      if (val instanceof Date) {
        return val.toLocaleDateString("id-ID");
      }
      return String(val);
    });
    
    csvRows.push(values.map(val => escapeCsvValue(val)).join(","));
  }

  // 3. Construct Blob with UTF-8 Byte Order Mark (BOM) to force Excel to read it correctly
  const csvString = "\uFEFF" + csvRows.join("\r\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  
  // 4. Trigger browser download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  return true;
}

/**
 * Escapes values containing commas, quotes or newlines for CSV safety
 */
function escapeCsvValue(val: string | number | boolean | null | undefined | Date): string {
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
