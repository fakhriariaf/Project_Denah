const Database = require('better-sqlite3');
const db = new Database('./local.db');

try {
  db.pragma('foreign_keys = OFF'); // Disable foreign keys during table recreation

  db.transaction(() => {
    // 1. Rename existing complaints to complaints_old
    db.prepare('ALTER TABLE complaints RENAME TO complaints_old').run();
    console.log('Renamed complaints to complaints_old.');

    // 2. Create the new complaints table with nullable customer_id/unit_id and all new fields
    db.prepare(`
      CREATE TABLE complaints (
        id TEXT PRIMARY KEY,
        complaint_number TEXT UNIQUE NOT NULL,
        complaint_type TEXT DEFAULT 'customer_to_developer' NOT NULL,
        customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
        unit_id TEXT REFERENCES units(id) ON DELETE CASCADE,
        spk_id TEXT REFERENCES spks(id) ON DELETE SET NULL,
        vendor_id TEXT REFERENCES vendors(id) ON DELETE SET NULL,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
        title TEXT,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'open' NOT NULL,
        assigned_to TEXT REFERENCES user(id) ON DELETE SET NULL,
        assigned_to_role TEXT,
        assigned_to_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
        reviewed_by TEXT REFERENCES user(id) ON DELETE SET NULL,
        reviewed_at INTEGER,
        resolved_at INTEGER,
        
        -- Vendor-specific fields
        supervisor_note TEXT,
        extension_days INTEGER,
        extension_reason TEXT,
        
        -- Customer-specific fields
        developer_note TEXT,
        customer_message TEXT,
        repair_action TEXT,
        follow_up_target_date INTEGER,
        
        created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
      )
    `).run();
    console.log('Created new complaints table.');

    // 3. Copy existing data
    db.prepare(`
      INSERT INTO complaints (
        id, complaint_number, customer_id, unit_id, category, description, status, assigned_to, resolved_at, created_at, complaint_type
      )
      SELECT 
        id, complaint_number, customer_id, unit_id, category, description, status, assigned_to, resolved_at, created_at, 'customer_to_developer'
      FROM complaints_old
    `).run();
    console.log('Copied existing complaints data.');

    // 4. Drop complaints_old
    db.prepare('DROP TABLE complaints_old').run();
    console.log('Dropped complaints_old.');

    // 5. Create indices
    db.prepare('CREATE INDEX idx_complaints_complaint_type ON complaints(complaint_type)').run();
    db.prepare('CREATE INDEX idx_complaints_status ON complaints(status)').run();
    db.prepare('CREATE INDEX idx_complaints_spk_id ON complaints(spk_id)').run();
    db.prepare('CREATE INDEX idx_complaints_vendor_id ON complaints(vendor_id)').run();
    db.prepare('CREATE INDEX idx_complaints_project_id ON complaints(project_id)').run();
    db.prepare('CREATE INDEX idx_complaints_unit_id ON complaints(unit_id)').run();
    db.prepare('CREATE INDEX idx_complaints_customer_id ON complaints(customer_id)').run();
    console.log('Created indices.');
  })();

  console.log('Migration completed successfully!');
} catch (e) {
  console.error('Migration failed:', e.message);
} finally {
  db.pragma('foreign_keys = ON');
  db.close();
}
