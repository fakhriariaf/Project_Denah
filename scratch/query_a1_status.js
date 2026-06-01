const { createClient } = require('@libsql/client');
const db = createClient({ url: 'file:f:/Project_Denah_propertyV2/local.db' });

async function run() {
  const unit = await db.execute({
    sql: "SELECT id, code, status, isReadyStock, constructionProgress, targetStockType FROM units WHERE code = 'A1'",
    args: []
  });
  console.log('=== UNIT A1 ===');
  console.log(JSON.stringify(unit.rows, null, 2));

  if (unit.rows.length > 0) {
    const unitId = unit.rows[0].id;

    const spks = await db.execute({
      sql: "SELECT id, status, progressPct, bastAttachmentId FROM spks WHERE unitId = ? ORDER BY createdAt DESC LIMIT 3",
      args: [unitId]
    });
    console.log('\n=== SPKs for A1 ===');
    console.log(JSON.stringify(spks.rows, null, 2));

    const bookings = await db.execute({
      sql: "SELECT id, status, paymentScheme FROM bookings WHERE unitId = ? ORDER BY createdAt DESC LIMIT 3",
      args: [unitId]
    });
    console.log('\n=== Bookings for A1 ===');
    console.log(JSON.stringify(bookings.rows, null, 2));

    for (const spk of spks.rows) {
      if (spk.bastAttachmentId) {
        const bast = await db.execute({
          sql: "SELECT id, status, fileName FROM attachments WHERE id = ?",
          args: [spk.bastAttachmentId]
        });
        console.log(`\n=== BAST Attachment for SPK ${spk.id} ===`);
        console.log(JSON.stringify(bast.rows, null, 2));
      } else {
        console.log(`\nSPK ${spk.id} has NO bastAttachmentId`);
      }
    }
  }
}
run().catch(console.error);
