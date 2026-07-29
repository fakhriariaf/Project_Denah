/**
 * Read-only pre-migration gate for migration 0008_kpr_sla_master_tracking.
 * Run this and require exit code 0 before migration 0008 is applied.
 *
 * Checks:
 * 1. Required referenced tables exist (kpr_processes, projects, user).
 * 2. New table names (kpr_sla_configs, kpr_stage_visits) are NOT already present
 *    (to prevent re-running migration on a DB that already has the tables without
 *    IF NOT EXISTS catching stale state).
 *
 * This script performs READ-ONLY queries. It NEVER mutates data.
 * Exit non-zero with a clear report if any check fails.
 *
 * Usage: npx.cmd tsx db/scripts/audit-kpr-sla-pre-migration.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";

interface TableCheckRow {
  table_name: string;
}

async function runAudit() {
  const issues: string[] = [];

  // Migration 0008 must only run after the existing production schema has a
  // trustworthy Drizzle baseline through 0006. Migration 0007 remains pending
  // and will run immediately before 0008 after its own duplicate-income audit.
  // An empty history can otherwise make the migrator attempt old DDL or leave
  // environments divergent.
  const historyResult = await db.execute(sql`
    SELECT created_at
    FROM drizzle.__drizzle_migrations
    WHERE created_at = 1784120000000
    LIMIT 1
  `);
  const historyRows = Array.isArray(historyResult)
    ? historyResult
    : ((historyResult as { rows?: unknown[] }).rows ?? []);
  if (historyRows.length === 0) {
    issues.push(
      "Baseline Drizzle sampai migration 0006 belum tercatat. Jalankan audit-drizzle-baseline dan baseline recovery terlebih dahulu."
    );
  }

  // ─── Check 1: Referenced tables must exist ───────────────────────────────────
  const requiredTables = ["kpr_processes", "projects", "user"];

  const result = await db.execute(sql`
    SELECT table_name::text AS table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('kpr_processes', 'projects', 'user')
  `);

  const rows = (Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? [])) as TableCheckRow[];

  const foundTables = new Set(rows.map((r) => r.table_name));

  for (const t of requiredTables) {
    if (!foundTables.has(t)) {
      issues.push(`Tabel referensi "${t}" tidak ditemukan di schema public.`);
    }
  }

  // ─── Check 2: New tables should NOT already exist ────────────────────────────
  const newTables = ["kpr_sla_configs", "kpr_stage_visits"];

  const newResult = await db.execute(sql`
    SELECT table_name::text AS table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('kpr_sla_configs', 'kpr_stage_visits')
  `);

  const newRows = (Array.isArray(newResult)
    ? newResult
    : ((newResult as { rows?: unknown[] }).rows ?? [])) as TableCheckRow[];

  for (const row of newRows) {
    issues.push(
      `Tabel "${row.table_name}" sudah ada di database. Migration mungkin sudah pernah diterapkan atau ada konflik nama.`
    );
  }

  // ─── Report ──────────────────────────────────────────────────────────────────
  if (issues.length === 0) {
    console.log("AUDIT PASSED — aman menjalankan migration 0008_kpr_sla_master_tracking");
    console.log("  ✓ Tabel referensi (kpr_processes, projects, user) tersedia");
    console.log("  ✓ Tabel baru (kpr_sla_configs, kpr_stage_visits) belum ada");
    process.exit(0);
  }

  console.error("AUDIT BLOCKED");
  console.error("Pre-migration audit untuk 0008_kpr_sla_master_tracking gagal:");
  for (const issue of issues) {
    console.error(`  ✗ ${issue}`);
  }
  console.error("");
  console.error("Migrasi 0008 tidak boleh dijalankan sebelum masalah di atas diselesaikan.");
  process.exit(1);
}

runAudit().catch((error) => {
  console.error("AUDIT BLOCKED");
  console.error("Audit gagal dijalankan. Migrasi 0008 tidak boleh dilanjutkan.");
  console.error(error);
  process.exit(1);
});
