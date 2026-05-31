const Database = require('better-sqlite3');
const db = new Database('local.db');
try {
  // Let's get customer ID for Fakhri
  const customer = db.prepare("SELECT id FROM customers WHERE name LIKE '%Fakhri%'").get();
  if (!customer) {
    console.error("Customer Fakhri not found!");
    process.exit(1);
  }
  
  // Let's get booking ID for Fakhri
  const booking = db.prepare("SELECT id FROM bookings WHERE customer_id = ?").get(customer.id);
  if (!booking) {
    console.error("Booking for Fakhri not found!");
    process.exit(1);
  }

  console.log(`Fakhri Customer ID: ${customer.id}`);
  console.log(`Fakhri Booking ID: ${booking.id}`);

  // Let's update units table for A1
  const updateResult = db.prepare(`
    UPDATE units 
    SET current_customer_id = ?, current_booking_id = ?, status = 'sold' 
    WHERE code = 'A1'
  `).run(customer.id, booking.id);

  console.log("Update result:", updateResult);

  // Verify the update
  const unit = db.prepare("SELECT * FROM units WHERE code = 'A1'").get();
  console.log("Updated Unit A1:", JSON.stringify(unit, null, 2));

} catch (e) {
  console.error(e);
}
