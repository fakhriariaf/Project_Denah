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
