const Database = require('better-sqlite3');
const db = new Database('./local.db');

function addColumnIfNotExists(table, columnName, ddl) {
  const columns = db.pragma(`table_info(${table})`);
  const exists = columns.some(col => col.name === columnName);
  if (!exists) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${columnName} ${ddl}`).run();
    console.log(`✅ Added column ${table}.${columnName}`);
  } else {
    console.log(`⏭  Column ${table}.${columnName} already exists, skipped.`);
  }
}

try {
  db.pragma('foreign_keys = OFF');

  // Alter kpr_processes table
  addColumnIfNotExists('kpr_processes', 'realized_date', 'INTEGER');
  addColumnIfNotExists('kpr_processes', 'plafond_approved', 'REAL');
  addColumnIfNotExists('kpr_processes', 'realized_net_received', 'REAL');
  addColumnIfNotExists('kpr_processes', 'realized_bank_fees', 'REAL');
  addColumnIfNotExists('kpr_processes', 'realized_insurance_fees', 'REAL');
  addColumnIfNotExists('kpr_processes', 'realized_withheld_amount', 'REAL');
  addColumnIfNotExists('kpr_processes', 'realized_account_id', 'TEXT REFERENCES finance_accounts(id) ON DELETE SET NULL');
  addColumnIfNotExists('kpr_processes', 'realized_attachment_id', 'TEXT REFERENCES attachments(id) ON DELETE SET NULL');
  addColumnIfNotExists('kpr_processes', 'realized_notes', 'TEXT');

  // Alter transactions table
  addColumnIfNotExists('transactions', 'kpr_process_id', 'TEXT');

  console.log('✅ Migration applied successfully!');
} catch (err) {
  console.error('❌ Migration failed:', err);
} finally {
  db.pragma('foreign_keys = ON');
  db.close();
}
