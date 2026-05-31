const Database = require('better-sqlite3');
const db = new Database('local.db');
try {
  console.log("=== CHECKING BUDGETS & FINANCE ACCOUNTS ===");
  // Let's check Budi Waluyo customer details
  const customers = db.prepare("SELECT * FROM customers WHERE name LIKE '%Budi Waluyo%'").all();
  console.log("Customers:", JSON.stringify(customers, null, 2));

  for (const c of customers) {
    console.log(`\n=== BOOKINGS FOR CUSTOMER ${c.name} (${c.id}) ===`);
    const bookings = db.prepare("SELECT * FROM bookings WHERE customer_id = ?").all(c.id);
    console.log("Bookings:", JSON.stringify(bookings, null, 2));

    for (const b of bookings) {
      console.log(`\n=== UNIT FOR BOOKING ${b.id} ===`);
      const units = db.prepare("SELECT * FROM units WHERE id = ?").all(b.unitId);
      console.log("Unit details:", JSON.stringify(units, null, 2));

      console.log(`\n=== INVOICES FOR BOOKING ${b.id} ===`);
      const invoices = db.prepare("SELECT * FROM invoices WHERE booking_id = ?").all(b.id);
      console.log("Invoices:", JSON.stringify(invoices, null, 2));
    }
  }
} catch (e) {
  console.error(e);
}
