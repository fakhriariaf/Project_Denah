const Database = require('better-sqlite3');
const db = new Database('local.db');

try {
  // Check if column already exists
  const info = db.pragma('table_info(units)');
  const columnExists = info.some(col => col.name === 'ready_stock_source');
  
  if (!columnExists) {
    console.log("Adding column ready_stock_source to units table...");
    db.prepare("ALTER TABLE units ADD COLUMN ready_stock_source TEXT NOT NULL DEFAULT 'construction_flow'").run();
    console.log("Column added successfully!");
  } else {
    console.log("Column ready_stock_source already exists.");
  }
  
  console.log("Current column info for units table:");
  console.log(db.pragma('table_info(units)').map(c => c.name));
} catch (err) {
  console.error("Migration error:", err);
} finally {
  db.close();
}
