const Database = require('better-sqlite3');
const db = new Database('./local.db', { readonly: true });

try {
  // 1. Complaints table columns
  const info = db.prepare('PRAGMA table_info(complaints)').all();
  console.log('=== COMPLAINTS COLUMNS ===');
  info.forEach(col => console.log(` col[${col.cid}] ${col.name} | type: ${col.type} | notnull: ${col.notnull} | default: ${col.dflt_value}`));

  // 2. All tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('\n=== ALL TABLES ===');
  console.log(tables.map(t => t.name).join(', '));

  // 3. The one existing complaint
  const rows = db.prepare('SELECT * FROM complaints').all();
  console.log('\n=== EXISTING DATA ===');
  console.log(JSON.stringify(rows, null, 2));

  // 4. Check if spks, vendors, bookings tables exist
  const targetTables = ['spks', 'vendors', 'bookings', 'projects', 'users', 'user'];
  for (const t of targetTables) {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
    console.log(`Table [${t}]: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
  }

} catch(e) {
  console.error('Error:', e.message);
} finally {
  db.close();
}
