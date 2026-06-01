const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
const sql = postgres(connectionString);

async function run() {
  try {
    console.log("=== UPDATING SPK TO COMPLETED ===");
    const res = await sql`UPDATE spks SET status = 'completed', actual_end_date = NOW() WHERE spk_number = 'SPK-20260531-37533B' RETURNING id, spk_number, status`;
    console.log("Updated SPK:", JSON.stringify(res, null, 2));

    console.log("\n=== SINKRONISASI UNIT A1 ===");
    const unitRes = await sql`UPDATE units SET is_ready_stock = true, status = 'kpr_process' WHERE code = 'A1' RETURNING id, code, status, is_ready_stock`;
    console.log("Updated Unit:", JSON.stringify(unitRes, null, 2));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}
run();
