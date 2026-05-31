const Database = require('better-sqlite3');
const db = new Database('local.db');

try {
  // Check if column already exists
  const info = db.pragma('table_info(handover_estimations)');
  const columnExists = info.some(col => col.name === 'handover_type');
  
  if (!columnExists) {
    console.log("Adding column handover_type to handover_estimations...");
    db.prepare("ALTER TABLE handover_estimations ADD COLUMN handover_type TEXT NOT NULL DEFAULT 'vendor_to_developer'").run();
    console.log("Column added successfully!");
  } else {
    console.log("Column handover_type already exists.");
  }
  
  console.log("Current columns in handover_estimations table:");
  console.log(db.pragma('table_info(handover_estimations)'));
} catch (err) {
  console.error("Migration error:", err);
} finally {
  db.close();
}
