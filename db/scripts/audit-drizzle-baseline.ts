/**
 * Read-only audit for databases whose application schema predates Drizzle's
 * migration history. The production baseline currently ends at migration
 * 0006; migrations 0007 and 0008 must remain pending and are applied normally
 * after their data audits pass. This script never mutates schema, data, or
 * migration history.
 *
 * Usage:
 *   npx.cmd tsx db/scripts/audit-drizzle-baseline.ts
 */
import {
  auditBaseline,
  createBaselineClient,
  describeDatabaseTarget,
  printBaselineAudit,
  requireDatabaseUrl,
} from "./drizzle-baseline-lib";

async function main() {
  const databaseUrl = requireDatabaseUrl();
  const sql = createBaselineClient(databaseUrl);
  console.log(`Target database: ${describeDatabaseTarget(databaseUrl)}`);

  try {
    const result = await auditBaseline(sql);
    printBaselineAudit(result);
    if (!result.ok) process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("BASELINE AUDIT BLOCKED");
  console.error(error);
  process.exitCode = 1;
});
