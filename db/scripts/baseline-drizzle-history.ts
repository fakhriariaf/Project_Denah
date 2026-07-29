/**
 * Records migrations 0000-0006 as an audited baseline for an existing
 * production schema. It does NOT execute migration DDL and does NOT include
 * migration 0008.
 *
 * Safety gates (both required):
 *   $env:DRIZZLE_BASELINE_CONFIRM="BASELINE_0000_0006"
 *   npx.cmd tsx db/scripts/baseline-drizzle-history.ts --apply
 */
import {
  auditBaseline,
  BASELINE_CONFIRMATION,
  createBaselineClient,
  describeDatabaseTarget,
  insertBaselineHistory,
  printBaselineAudit,
  requireDatabaseUrl,
} from "./drizzle-baseline-lib";

async function main() {
  const applyRequested = process.argv.includes("--apply");
  if (!applyRequested) {
    throw new Error("Flag --apply wajib diberikan. Tidak ada perubahan yang dijalankan.");
  }
  if (process.env.DRIZZLE_BASELINE_CONFIRM !== BASELINE_CONFIRMATION) {
    throw new Error(
      `Set DRIZZLE_BASELINE_CONFIRM=${BASELINE_CONFIRMATION} untuk mengonfirmasi baseline 0000-0006.`
    );
  }

  const databaseUrl = requireDatabaseUrl();
  const sql = createBaselineClient(databaseUrl);
  console.log(`Target database: ${describeDatabaseTarget(databaseUrl)}`);

  try {
    const audit = await auditBaseline(sql);
    printBaselineAudit(audit);
    if (!audit.ok) {
      throw new Error("Baseline tidak ditulis karena audit gagal.");
    }

    await insertBaselineHistory(sql, audit.baselineMigrations);
    console.log("BASELINE RECOVERY COMPLETE");
    console.log("  - Migration 0000-0006 tercatat dalam satu transaksi");
    console.log("  - Tidak ada DDL atau data bisnis yang diubah");
    console.log("  - Migration 0007 dan 0008 belum dijalankan");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("BASELINE RECOVERY FAILED");
  console.error(error);
  process.exitCode = 1;
});
