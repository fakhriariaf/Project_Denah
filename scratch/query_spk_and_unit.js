const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
const sql = postgres(connectionString);

async function run() {
  try {
    console.log("=== UNIT A1 STATE ===");
    const units = await sql`SELECT id, code, status, is_ready_stock, current_customer_id FROM units WHERE code = 'A1'`;
    console.log(JSON.stringify(units, null, 2));

    if (units.length > 0) {
      console.log("\n=== SPK FOR UNIT A1 ===");
      const spks = await sql`SELECT id, spk_number, status, progress_pct, unit_id FROM spks WHERE unit_id = ${units[0].id}`;
      console.log(JSON.stringify(spks, null, 2));

      if (spks.length > 0) {
        console.log("\n=== ATTACHMENTS FOR SPK ===");
        const attachments = await sql`SELECT id, entity_type, entity_id, file_name, file_url FROM attachments WHERE entity_id = ${spks[0].id} AND entity_type = 'bast_vendor_to_developer'`;
        console.log(JSON.stringify(attachments, null, 2));
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}
run();
