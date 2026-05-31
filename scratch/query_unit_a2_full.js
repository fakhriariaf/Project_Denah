const Database = require('better-sqlite3');
const db = new Database('local.db');
try {
  const unit = db.prepare("SELECT * FROM units WHERE code = 'A2'").get();
  console.log("Unit A2:", JSON.stringify(unit, null, 2));
} catch (e) {
  console.error(e);
}
