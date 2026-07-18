/**
 * Read-only pre-migration gate for `uniq_income_per_kpr`.
 * Run this and require exit code 0 before migration 0007 is applied.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";

interface DuplicateIncomeRow {
  kpr_process_id: string;
  income_count: number;
}

async function runAudit() {
  const result = await db.execute(sql`
    SELECT kpr_process_id, COUNT(*) AS income_count
    FROM transactions
    WHERE kpr_process_id IS NOT NULL
      AND type = 'income'
      AND reversal_of_transaction_id IS NULL
    GROUP BY kpr_process_id
    HAVING COUNT(*) > 1
  `);
  const rows = (Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? [])) as DuplicateIncomeRow[];

  if (rows.length === 0) {
    console.log("AUDIT PASSED — aman membuat index uniq_income_per_kpr");
    return;
  }

  console.error("AUDIT BLOCKED");
  console.error("Ditemukan KPR dengan lebih dari satu transaksi pemasukan non-pembalikan:");
  for (const row of rows) {
    console.error(`  - kpr_process_id=${row.kpr_process_id} income_count=${row.income_count}`);
  }
  console.error("Migrasi 0007 tidak boleh dijalankan sebelum data duplikat diselesaikan secara manual.");
  process.exitCode = 1;
}

runAudit().catch((error) => {
  console.error("AUDIT BLOCKED");
  console.error("Audit gagal dijalankan. Migrasi 0007 tidak boleh dilanjutkan.");
  console.error(error);
  process.exitCode = 1;
});
