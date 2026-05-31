const Database = require('better-sqlite3');
const db = new Database('local.db');
try {
  const unitId = '6ce81a9e-1e69-4512-99a3-7e5e0a3efabd';
  const hist = db.prepare("SELECT * FROM unit_status_histories WHERE unit_id = ? ORDER BY changed_at DESC").all(unitId);
  console.log("Unit status histories for A1:");
  console.log(JSON.stringify(hist, null, 2));
} catch (e) {
  console.error(e);
}
