const Database = require('better-sqlite3');
const db = new Database('local.db');
try {
  console.log("=== ALL UNITS IN DATABASE ===");
  const units = db.prepare("SELECT id, code, project_id, status FROM units").all();
  console.log("Units:", JSON.stringify(units, null, 2));
} catch (e) {
  console.error(e);
}
