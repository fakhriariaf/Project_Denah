const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
const sql = postgres(connectionString);

// 1. Data Kategori Keuangan (finance_categories)
const dummyCategories = [
  // Pendapatan (Income)
  { id: 'inc-001', name: 'Pendapatan Operasional', type: 'income', parent_id: null, status: 'active' },
  { id: 'inc-001-01', name: 'Penerimaan Booking Fee', type: 'income', parent_id: 'inc-001', status: 'active' },
  { id: 'inc-001-02', name: 'Penerimaan Uang Muka (DP)', type: 'income', parent_id: 'inc-001', status: 'active' },
  { id: 'inc-001-03', name: 'Pelunasan Cash Keras / Bertahap', type: 'income', parent_id: 'inc-001', status: 'active' },
  { id: 'inc-001-04', name: 'Realisasi KPR Bank', type: 'income', parent_id: 'inc-001', status: 'active' },
  { id: 'inc-002', name: 'Pendapatan Non-Operasional', type: 'income', parent_id: null, status: 'active' },
  { id: 'inc-002-01', name: 'Pendapatan Bunga & Jasa Giro', type: 'income', parent_id: 'inc-002', status: 'active' },
  { id: 'inc-002-02', name: 'Denda Keterlambatan Konsumen', type: 'income', parent_id: 'inc-002', status: 'active' },

  // Pengeluaran (Expense)
  { id: 'exp-001', name: 'Biaya Konstruksi & Pembangunan', type: 'expense', parent_id: null, status: 'active' },
  { id: 'exp-001-01', name: 'Pembayaran SPK Kontraktor Utama', type: 'expense', parent_id: 'exp-001', status: 'active' },
  { id: 'exp-001-02', name: 'Pembelian Bahan Material Proyek', type: 'expense', parent_id: 'exp-001', status: 'active' },
  { id: 'exp-001-03', name: 'Upah Tenaga Kerja Lapangan', type: 'expense', parent_id: 'exp-001', status: 'active' },
  { id: 'exp-002', name: 'Biaya Pemasaran & Penjualan', type: 'expense', parent_id: null, status: 'active' },
  { id: 'exp-002-01', name: 'Komisi Sales & Agent Internal', type: 'expense', parent_id: 'exp-002', status: 'active' },
  { id: 'exp-002-02', name: 'Promosi, Iklan Media Sosial & Brosur', type: 'expense', parent_id: 'exp-002', status: 'active' },
  { id: 'exp-002-03', name: 'Biaya Pameran & Event Marketing', type: 'expense', parent_id: 'exp-002', status: 'active' },
  { id: 'exp-003', name: 'Biaya Operasional Kantor & Administrasi', type: 'expense', parent_id: null, status: 'active' },
  { id: 'exp-003-01', name: 'Gaji Karyawan Kantor & Staff', type: 'expense', parent_id: 'exp-003', status: 'active' },
  { id: 'exp-003-02', name: 'Legalitas, Perizinan (IMB/PBG) & Pajak', type: 'expense', parent_id: 'exp-003', status: 'active' },
  { id: 'exp-003-03', name: 'Listrik, Air, Internet & ATK Kantor', type: 'expense', parent_id: 'exp-003', status: 'active' }
];

// 2. Data Rekening Bank (finance_accounts)
const dummyAccounts = [
  { id: 'acc-001', code: '111.001', name: 'Kas Besar Utama (Brankas Kantor)', type: 'cash', opening_balance: 25000000.0, status: 'active' },
  { id: 'acc-002', code: '112.001', name: 'Bank BCA Operasional (No. Rek: 128-990-221)', type: 'bank', opening_balance: 750000000.0, status: 'active' },
  { id: 'acc-003', code: '112.002', name: 'Bank Mandiri Escrow KPR (No. Rek: 102-009-887)', type: 'bank', opening_balance: 1200000000.0, status: 'active' },
  { id: 'acc-004', code: '112.003', name: 'Bank BNI Penampungan DP (No. Rek: 009-881-223)', type: 'bank', opening_balance: 450000000.0, status: 'active' },
  { id: 'acc-005', code: '112.004', name: 'Kas Kecil Operational Lapangan (Petty Cash)', type: 'cash', opening_balance: 15000000.0, status: 'active' }
];

// 3. Data Bank Rekanan (bank_partners)
const dummyBankPartners = [
  { id: 'bnk-001', name: 'Bank BTN Kantor Cabang Utama', contact_person: 'Budi Santoso (KPR Specialist)', phone: '0812-3456-7890', status: 'active' },
  { id: 'bnk-002', name: 'Bank Mandiri Consumer Loan', contact_person: 'Siti Rahmawati (Relationship Manager)', phone: '0821-9988-7766', status: 'active' },
  { id: 'bnk-003', name: 'Bank BCA Kantor Cabang BSD', contact_person: 'Kevin Wijaya (KPR Officer)', phone: '0811-2233-4455', status: 'active' },
  { id: 'bnk-004', name: 'Bank BNI Griya Division', contact_person: 'Dewi Lestari (Griya Specialist)', phone: '0877-6655-4433', status: 'active' },
  { id: 'bnk-005', name: 'Bank Syariah Indonesia (BSI) Griya', contact_person: 'Ahmad Fauzi (BSI Griya Officer)', phone: '0852-1122-3344', status: 'active' }
];

async function run() {
  try {
    console.log("=== MEMULAI PENGISIAN DUMMY DATA MODUL KEUANGAN & PERBANKAN ===");

    // A. Mengisi Kategori Keuangan (finance_categories)
    console.log("\n1. Mengisi Data Kategori Keuangan...");
    // Pisahkan parent_id = null dulu agar tidak melanggar foreign key constraint
    const parentCategories = dummyCategories.filter(c => c.parent_id === null);
    const childCategories = dummyCategories.filter(c => c.parent_id !== null);

    for (const item of parentCategories) {
      await sql`
        INSERT INTO finance_categories (id, name, type, parent_id, status, created_at)
        VALUES (${item.id}, ${item.name}, ${item.type}, ${item.parent_id}, ${item.status}, NOW())
        ON CONFLICT (id) DO UPDATE
        SET 
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          parent_id = EXCLUDED.parent_id,
          status = EXCLUDED.status
      `;
      console.log(`- Berhasil memasukkan Kategori Utama: [${item.id}] ${item.name}`);
    }

    for (const item of childCategories) {
      await sql`
        INSERT INTO finance_categories (id, name, type, parent_id, status, created_at)
        VALUES (${item.id}, ${item.name}, ${item.type}, ${item.parent_id}, ${item.status}, NOW())
        ON CONFLICT (id) DO UPDATE
        SET 
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          parent_id = EXCLUDED.parent_id,
          status = EXCLUDED.status
      `;
      console.log(`- Berhasil memasukkan Sub-Kategori: [${item.id}] ${item.name} (Parent: ${item.parent_id})`);
    }

    // B. Mengisi Rekening Bank (finance_accounts)
    console.log("\n2. Mengisi Data Rekening Keuangan / Bank...");
    for (const item of dummyAccounts) {
      await sql`
        INSERT INTO finance_accounts (id, code, name, type, opening_balance, status, created_at)
        VALUES (${item.id}, ${item.code}, ${item.name}, ${item.type}, ${item.opening_balance}, ${item.status}, NOW())
        ON CONFLICT (id) DO UPDATE
        SET 
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          opening_balance = EXCLUDED.opening_balance,
          status = EXCLUDED.status
      `;
      console.log(`- Berhasil memasukkan Rekening: [${item.code}] ${item.name} (Saldo Awal: Rp ${item.opening_balance.toLocaleString('id-ID')})`);
    }

    // C. Mengisi Bank Rekanan (bank_partners)
    console.log("\n3. Mengisi Data Bank Rekanan (KPR)...");
    for (const item of dummyBankPartners) {
      await sql`
        INSERT INTO bank_partners (id, name, contact_person, phone, status, created_at)
        VALUES (${item.id}, ${item.name}, ${item.contact_person}, ${item.phone}, ${item.status}, NOW())
        ON CONFLICT (id) DO UPDATE
        SET 
          name = EXCLUDED.name,
          contact_person = EXCLUDED.contact_person,
          phone = EXCLUDED.phone,
          status = EXCLUDED.status
      `;
      console.log(`- Berhasil memasukkan Bank Rekanan: [${item.id}] ${item.name} (CP: ${item.contact_person})`);
    }

    console.log("\n=== PENGISIAN DUMMY DATA SELESAI DENGAN SUKSES! ===");
  } catch (err) {
    console.error("\n❌ Terjadi kesalahan saat pengisian dummy data:", err);
  } finally {
    await sql.end();
  }
}

run();
