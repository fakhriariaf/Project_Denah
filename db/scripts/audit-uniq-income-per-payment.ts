/**
 * Pre-migration blocking audit — `uniq_income_per_payment`
 * ---------------------------------------------------------------------------
 * LOCKED DECISION GATE (design.md → Data Model §4 "Partial unique index —
 * idempotency income non-reversal"; Requirements 3.6).
 *
 * This is the mandatory pre-flight gate that MUST run and PASS before the
 * migration creates the partial unique index:
 *
 *   CREATE UNIQUE INDEX IF NOT EXISTS uniq_income_per_payment
 *     ON transactions (payment_id)
 *     WHERE payment_id IS NOT NULL
 *       AND type = 'income'
 *       AND reversal_of_payment_id IS NULL;
 *
 * The script detects pre-existing violations of that constraint in production
 * data (more than one non-reversal income transaction per payment_id). If any
 * violation exists it BLOCKS the migration and reports the offending rows.
 *
 * It is PURELY READ-ONLY: it runs a single SELECT and performs NO
 * INSERT/UPDATE/DELETE and NO auto-cleanup. Resolving flagged data is a
 * separate manual decision by Admin Keuangan / Super Admin, outside this
 * migration (auto-cleanup is explicitly forbidden by the locked decision).
 *
 * Dialect: PostgreSQL. Uses the exported postgres-js Drizzle client (`@/db`).
 *
 * Run with:
 *   npx tsx db/scripts/audit-uniq-income-per-payment.ts
 *
 * Exit codes:
 *   0 → AUDIT PASSED  (zero violations — safe to create the index)
 *   1 → AUDIT BLOCKED (>= 1 violation — migration MUST NOT proceed)
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";

interface DuplicateIncomeRow {
  payment_id: string;
  income_count: number;
}

async function runAudit(): Promise<void> {
  // Step 1: Check if reversal_of_payment_id column exists in transactions table.
  // If not yet (pre-migration state), use fallback query without the column filter.
  let hasReversalColumn = false;
  try {
    const colCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'transactions' AND column_name = 'reversal_of_payment_id'
      LIMIT 1
    `);
    const colRows = Array.isArray(colCheck) ? colCheck : ((colCheck as { rows?: unknown[] }).rows ?? []);
    hasReversalColumn = colRows.length > 0;
  } catch {
    hasReversalColumn = false;
  }

  let result: unknown;

  if (hasReversalColumn) {
    // Post-schema aware mode: filter out reversal transactions
    console.log("[audit] Mode: post-schema aware (reversal_of_payment_id column exists)");
    result = await db.execute(sql`
      SELECT payment_id, COUNT(*) AS income_count
      FROM transactions
      WHERE payment_id IS NOT NULL
        AND type = 'income'
        AND reversal_of_payment_id IS NULL
      GROUP BY payment_id
      HAVING COUNT(*) > 1
    `);
  } else {
    // Pre-migration fallback mode: column doesn't exist yet, count ALL income per payment_id
    console.log("[audit] Mode: pre-migration fallback (reversal_of_payment_id column belum ada)");
    result = await db.execute(sql`
      SELECT payment_id, COUNT(*) AS income_count
      FROM transactions
      WHERE payment_id IS NOT NULL
        AND type = 'income'
      GROUP BY payment_id
      HAVING COUNT(*) > 1
    `);
  }

  // postgres-js drizzle `execute` returns an array-like RowList; normalize.
  const rows = (Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? [])) as DuplicateIncomeRow[];

  if (rows.length === 0) {
    console.log("AUDIT PASSED — aman membuat index uniq_income_per_payment");
    process.exit(0);
  }

  console.error("AUDIT BLOCKED");
  console.error(
    `Ditemukan ${rows.length} payment_id dengan lebih dari satu transaksi income non-reversal.`
  );
  console.error(
    "Pelanggaran unique constraint uniq_income_per_payment (partial: type='income' AND reversal_of_payment_id IS NULL):"
  );
  for (const row of rows) {
    console.error(`  - payment_id=${row.payment_id} income_count=${row.income_count}`);
  }
  console.error("");
  console.error(
    "Migrasi TIDAK BOLEH dilanjutkan: CREATE UNIQUE INDEX uniq_income_per_payment akan gagal " +
      "karena data pelanggaran ini sudah ada."
  );
  console.error(
    "TIDAK ada auto-cleanup yang dilakukan (keputusan terkunci). Resolusi data duplikat harus " +
      "dilakukan secara manual oleh Admin Keuangan/Super Admin di luar migration ini."
  );
  process.exit(1);
}

runAudit().catch((error) => {
  console.error("AUDIT BLOCKED");
  console.error("Audit gagal dijalankan karena error tak terduga. Migrasi TIDAK BOLEH dilanjutkan.");
  console.error(error);
  process.exit(1);
});
