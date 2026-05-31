const Database = require('better-sqlite3');
const db = new Database('local.db');
try {
  console.log("=== CHECKING CUSTOMERS ===");
  const customers = db.prepare("SELECT * FROM customers WHERE name LIKE '%Fakhri%'").all();
  console.log("Customers:", JSON.stringify(customers, null, 2));

  console.log("\n=== CHECKING UNITS ===");
  const units = db.prepare("SELECT * FROM units WHERE code = 'A1' OR id IN (SELECT unit_id FROM bookings WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE '%Fakhri%'))").all();
  console.log("Units:", JSON.stringify(units, null, 2));

  console.log("\n=== CHECKING BOOKINGS ===");
  const bookings = db.prepare("SELECT * FROM bookings WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE '%Fakhri%')").all();
  console.log("Bookings:", JSON.stringify(bookings, null, 2));

  for (const b of bookings) {
    console.log(`\n=== BOOKING ${b.id} INVOICES ===`);
    const invoices = db.prepare("SELECT * FROM invoices WHERE booking_id = ?").all(b.id);
    console.log(JSON.stringify(invoices, null, 2));
    
    console.log(`\n=== BOOKING ${b.id} KPR PROCESSES ===`);
    const kprs = db.prepare("SELECT * FROM kpr_processes WHERE booking_id = ?").all(b.id);
    console.log(JSON.stringify(kprs, null, 2));
  }

  console.log("\n=== UNIT STATUS HISTORY FOR A1 ===");
  if (units.length > 0) {
    const hist = db.prepare("SELECT * FROM unit_status_histories WHERE unit_id = ? ORDER BY created_at DESC").all(units[0].id);
    console.log(JSON.stringify(hist, null, 2));
  }
} catch (e) {
  console.error(e);
}
