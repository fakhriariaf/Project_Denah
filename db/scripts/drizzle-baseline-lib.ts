import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import postgres, { type Sql } from "postgres";

export const MIGRATIONS_FOLDER = "./db/migrations";
export const BASELINE_LAST_MILLIS = 1784120000000;
export const TARGET_MIGRATION_MILLIS = 1784800000000;
export const BASELINE_CONFIRMATION = "BASELINE_0000_0006";

const TARGET_TABLES = ["kpr_sla_configs", "kpr_stage_visits"] as const;

interface RequiredObjects {
  tables: Set<string>;
  columns: Set<string>;
  indexes: Set<string>;
  constraints: Set<string>;
}

interface CatalogRow {
  object_key: string;
}

interface MigrationHistoryRow {
  id: number;
  hash: string;
  created_at: string | number;
}

export interface BaselineAuditResult {
  ok: boolean;
  issues: string[];
  migrations: MigrationMeta[];
  baselineMigrations: MigrationMeta[];
  requiredCounts: {
    tables: number;
    columns: number;
    indexes: number;
    constraints: number;
  };
}

function addCreateTableColumns(statement: string, objects: RequiredObjects) {
  const tableMatch = statement.match(
    /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:"public"\.)?"([^"]+)"\s*\(([\s\S]*)\)\s*;?$/i
  );
  if (!tableMatch) return;

  const [, tableName, body] = tableMatch;
  objects.tables.add(tableName);

  for (const line of body.split(/\r?\n/)) {
    const columnMatch = line.match(/^\s*"([^"]+)"\s+/);
    if (columnMatch) {
      objects.columns.add(`${tableName}.${columnMatch[1]}`);
    }
  }
}

export function collectRequiredObjects(migrations: MigrationMeta[]): RequiredObjects {
  const objects: RequiredObjects = {
    tables: new Set(),
    columns: new Set(),
    indexes: new Set(),
    constraints: new Set(),
  };

  for (const migration of migrations) {
    for (const statement of migration.sql) {
      addCreateTableColumns(statement.trim(), objects);

      const addColumnMatch = statement.match(
        /ALTER\s+TABLE\s+(?:"public"\.)?"([^"]+)"\s+ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+"([^"]+)"/i
      );
      if (addColumnMatch) {
        objects.columns.add(`${addColumnMatch[1]}.${addColumnMatch[2]}`);
      }

      const indexMatch = statement.match(
        /CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+"([^"]+)"/i
      );
      if (indexMatch) {
        objects.indexes.add(indexMatch[1]);
      }

      const constraintMatch = statement.match(
        /ALTER\s+TABLE\s+(?:"public"\.)?"[^"]+"\s+ADD\s+CONSTRAINT\s+"([^"]+)"/i
      );
      if (constraintMatch) {
        objects.constraints.add(constraintMatch[1]);
      }
    }
  }

  return objects;
}

function rowsToSet(rows: CatalogRow[]): Set<string> {
  return new Set(rows.map((row) => row.object_key));
}

function appendMissing(
  issues: string[],
  label: string,
  required: Set<string>,
  actual: Set<string>
) {
  const missing = [...required].filter((name) => !actual.has(name)).sort();
  if (missing.length === 0) return;

  const preview = missing.slice(0, 20).join(", ");
  const remainder = missing.length > 20 ? `, dan ${missing.length - 20} lainnya` : "";
  issues.push(`${label} tidak lengkap (${missing.length} hilang): ${preview}${remainder}`);
}

export function getMigrationSets() {
  const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
  const baselineMigrations = migrations.filter(
    (migration) => migration.folderMillis <= BASELINE_LAST_MILLIS
  );
  const targetMigration = migrations.find(
    (migration) => migration.folderMillis === TARGET_MIGRATION_MILLIS
  );

  if (baselineMigrations.length !== 7) {
    throw new Error(
      `Baseline harus berisi tepat 7 migration (0000-0006), ditemukan ${baselineMigrations.length}.`
    );
  }
  if (!targetMigration) {
    throw new Error("Migration target 0008_kpr_sla_master_tracking tidak ditemukan di journal.");
  }

  return { migrations, baselineMigrations, targetMigration };
}

export function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value || !/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error("DATABASE_URL PostgreSQL wajib di-set secara eksplisit.");
  }
  return value;
}

export function describeDatabaseTarget(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
}

export function createBaselineClient(databaseUrl: string) {
  return postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    connect_timeout: 15,
  });
}

export async function auditBaseline(sql: Sql): Promise<BaselineAuditResult> {
  const issues: string[] = [];
  const { migrations, baselineMigrations } = getMigrationSets();
  const required = collectRequiredObjects(baselineMigrations);

  const history = await sql<MigrationHistoryRow[]>`
    SELECT id, hash, created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY created_at ASC
  `;
  if (history.length !== 0) {
    issues.push(
      `Migration history harus kosong sebelum baseline recovery, tetapi ditemukan ${history.length} baris.`
    );
  }

  const targetTables = await sql<CatalogRow[]>`
    SELECT table_name::text AS object_key
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('kpr_sla_configs', 'kpr_stage_visits')
  `;
  if (targetTables.length > 0) {
    issues.push(
      `Objek migration 0008 sudah ada: ${targetTables.map((row) => row.object_key).join(", ")}.`
    );
  }

  const tables = rowsToSet(await sql<CatalogRow[]>`
    SELECT table_name::text AS object_key
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `);
  const columns = rowsToSet(await sql<CatalogRow[]>`
    SELECT (table_name || '.' || column_name)::text AS object_key
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `);
  const indexes = rowsToSet(await sql<CatalogRow[]>`
    SELECT indexname::text AS object_key
    FROM pg_indexes
    WHERE schemaname = 'public'
  `);
  const constraints = rowsToSet(await sql<CatalogRow[]>`
    SELECT c.conname::text AS object_key
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public'
  `);

  appendMissing(issues, "Tabel baseline", required.tables, tables);
  appendMissing(issues, "Kolom baseline", required.columns, columns);
  appendMissing(issues, "Index baseline", required.indexes, indexes);
  appendMissing(issues, "Constraint baseline", required.constraints, constraints);

  return {
    ok: issues.length === 0,
    issues,
    migrations,
    baselineMigrations,
    requiredCounts: {
      tables: required.tables.size,
      columns: required.columns.size,
      indexes: required.indexes.size,
      constraints: required.constraints.size,
    },
  };
}

export function printBaselineAudit(result: BaselineAuditResult) {
  if (!result.ok) {
    console.error("BASELINE AUDIT BLOCKED");
    for (const issue of result.issues) {
      console.error(`  - ${issue}`);
    }
    return;
  }

  console.log("BASELINE AUDIT PASSED");
  console.log("  - Migration history kosong dan siap dibaseline");
  console.log("  - Struktur migration 0000-0006 ditemukan lengkap");
  console.log("  - Tabel migration 0008 belum ada");
  console.log(
    `  - Diverifikasi: ${result.requiredCounts.tables} tabel, ${result.requiredCounts.columns} kolom, ${result.requiredCounts.indexes} index, ${result.requiredCounts.constraints} constraint`
  );
}

export async function insertBaselineHistory(sql: Sql, migrations: MigrationMeta[]) {
  await sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext('denah_property_drizzle_baseline_0000_0006'))`;

    const existing = await transaction<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM drizzle.__drizzle_migrations
    `;
    if ((existing[0]?.count ?? -1) !== 0) {
      throw new Error("Baseline dibatalkan: migration history berubah dan tidak lagi kosong.");
    }

    for (const migration of migrations) {
      await transaction`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${migration.hash}, ${migration.folderMillis})
      `;
    }

    const verification = await transaction<{ count: number; latest: string | number | null }[]>`
      SELECT COUNT(*)::int AS count, MAX(created_at) AS latest
      FROM drizzle.__drizzle_migrations
    `;
    const count = verification[0]?.count ?? 0;
    const latest = Number(verification[0]?.latest ?? 0);
    if (count !== migrations.length || latest !== BASELINE_LAST_MILLIS) {
      throw new Error(
        `Verifikasi baseline gagal (count=${count}, latest=${latest}); transaksi dibatalkan.`
      );
    }
  });
}

export { TARGET_TABLES };
