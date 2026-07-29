/**
 * LEGACY SQLITE SCRIPT — DISABLED (P1 hardening).
 *
 * This dropped every table in a SQLite file via `sqlite_master` / `PRAGMA`.
 * The runtime database is PostgreSQL (see `drizzle.config.ts`), so this script is
 * both non-functional and dangerous: pointed at a real `DATABASE_URL` it would
 * either fail obscurely or spawn a throwaway `local.db` that looks like a reset.
 *
 * There is intentionally no PostgreSQL replacement here — dropping schemas is a
 * destructive operation that must be done deliberately, not by running a script.
 */
throw new Error(
  "Script SQLite legacy dinonaktifkan. Reset skema PostgreSQL harus dilakukan manual/terkontrol, bukan via db/drop_all.ts."
);

import Database from 'better-sqlite3';

const sqlite = new Database(process.env.DATABASE_URL || 'local.db');

try {
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
  
  sqlite.exec('PRAGMA foreign_keys = OFF;');
  for (const table of tables) {
    if (table.name !== 'sqlite_sequence' && !table.name.startsWith('sqlite_')) {
      console.log(`Dropping table ${table.name}`);
      sqlite.exec(`DROP TABLE IF EXISTS "${table.name}"`);
    }
  }
  sqlite.exec('PRAGMA foreign_keys = ON;');
  console.log('All tables dropped successfully.');
} catch (error) {
  console.error('Failed to drop tables:', error);
}
