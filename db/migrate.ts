/**
 * LEGACY SQLITE SCRIPT — DISABLED (P1 hardening).
 *
 * This file predates the PostgreSQL migration. `drizzle.config.ts` now uses the
 * `postgresql` dialect with `DATABASE_URL`, and every schema change lives in
 * `db/migrations/*.sql` driven by drizzle-kit.
 *
 * Running this file would open `better-sqlite3` against whatever `DATABASE_URL`
 * points at (or create a bogus `local.db`) and build a parallel SQLite schema with
 * SQLite-only syntax — silently divergent from the real database and very
 * confusing for an operator debugging a failed deploy.
 *
 * The DDL below is kept verbatim for historical reference only. Do NOT re-enable
 * it; use `npx.cmd drizzle-kit migrate` instead.
 */
throw new Error(
  "Script SQLite legacy dinonaktifkan. Gunakan `npx.cmd drizzle-kit migrate` untuk PostgreSQL (lihat db/migrations/)."
);

import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_URL || "local.db");

const migrations = [
  // unit_status_histories (already may exist, skip if exists)
  `CREATE TABLE IF NOT EXISTS unit_status_histories (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL REFERENCES units(id),
    previous_status TEXT,
    new_status TEXT NOT NULL,
    reason TEXT,
    changed_by TEXT NOT NULL REFERENCES "user"(id),
    changed_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // finance_accounts
  `CREATE TABLE IF NOT EXISTS finance_accounts (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('cash','bank','receivable','payable','income','expense')),
    opening_balance REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // finance_categories
  `CREATE TABLE IF NOT EXISTS finance_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    parent_id TEXT REFERENCES finance_categories(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // audit_logs
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    entity_id TEXT,
    entity_type TEXT,
    details TEXT,
    ip_address TEXT,
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // notifications
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_id TEXT,
    entity_type TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // attachments
  `CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by TEXT REFERENCES "user"(id),
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // app_settings
  `CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_by TEXT REFERENCES "user"(id),
    updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // leads
  `CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    source TEXT NOT NULL,
    interested_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    interested_unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','follow_up','converted','lost')),
    assigned_marketing_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // customer_followups
  `CREATE TABLE IF NOT EXISTS customer_followups (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
    lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
    followup_date INTEGER NOT NULL,
    method TEXT NOT NULL CHECK(method IN ('call','whatsapp','meeting','email','site_visit')),
    result TEXT NOT NULL,
    next_followup_at INTEGER,
    created_by TEXT NOT NULL REFERENCES "user"(id),
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // bookings
  `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    booking_number TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    marketing_id TEXT NOT NULL REFERENCES "user"(id),
    booking_date INTEGER NOT NULL,
    booking_fee REAL NOT NULL,
    dp_amount REAL NOT NULL,
    payment_scheme TEXT NOT NULL CHECK(payment_scheme IN ('cash','kpr','installment')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled','akad','completed')),
    cancellation_reason TEXT,
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer)),
    updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // booking_status_histories
  `CREATE TABLE IF NOT EXISTS booking_status_histories (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    notes TEXT,
    changed_by TEXT NOT NULL REFERENCES "user"(id),
    changed_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // kpr_processes
  `CREATE TABLE IF NOT EXISTS kpr_processes (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'bi_checking' CHECK(status IN ('bi_checking','pemberkasan','proses_bank','offering','approved','rejected','akad')),
    bi_check_status TEXT NOT NULL DEFAULT 'pending' CHECK(bi_check_status IN ('pending','partial','approved','rejected_refund','rejected_no_refund')),
    document_status TEXT NOT NULL DEFAULT 'incomplete' CHECK(document_status IN ('incomplete','complete')),
    sla_start_at INTEGER,
    sla_deadline_at INTEGER,
    bank_notes TEXT,
    akad_date INTEGER,
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer)),
    updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // bank_partners
  `CREATE TABLE IF NOT EXISTS bank_partners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // bank_submissions
  `CREATE TABLE IF NOT EXISTS bank_submissions (
    id TEXT PRIMARY KEY,
    kpr_process_id TEXT NOT NULL REFERENCES kpr_processes(id) ON DELETE CASCADE,
    bank_partner_id TEXT NOT NULL REFERENCES bank_partners(id) ON DELETE CASCADE,
    submission_date INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','verified','offering','approved','rejected')),
    plafond_amount REAL,
    interest_rate REAL,
    tenor_year INTEGER,
    rejection_reason TEXT,
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // customer_documents
  `CREATE TABLE IF NOT EXISTS customer_documents (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    booking_id TEXT REFERENCES bookings(id) ON DELETE CASCADE,
    attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK(document_type IN ('ktp','npwp','slip_gaji','kk','spjb','kpr_doc','other')),
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK(status IN ('uploaded','verified','rejected')),
    notes TEXT,
    uploaded_by TEXT NOT NULL REFERENCES "user"(id),
    uploaded_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // waiting_lists
  `CREATE TABLE IF NOT EXISTS waiting_lists (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    preferred_type TEXT,
    budget_min REAL,
    budget_max REAL,
    priority INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','offered','converted','cancelled')),
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // marketing_targets
  `CREATE TABLE IF NOT EXISTS marketing_targets (
    id TEXT PRIMARY KEY,
    marketing_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    target_units INTEGER NOT NULL DEFAULT 0,
    target_amount REAL NOT NULL DEFAULT 0,
    achieved_units INTEGER NOT NULL DEFAULT 0,
    achieved_amount REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // invoices
  `CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK(type IN ('booking_fee', 'dp', 'installment', 'other')),
    amount REAL NOT NULL,
    due_date INTEGER,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'partial', 'paid', 'cancelled')),
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer)),
    updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // payments
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
    payment_number TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    payment_date INTEGER NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'transfer', 'giro', 'other')),
    proof_attachment_id TEXT REFERENCES attachments(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'verified', 'rejected')),
    verified_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
    verified_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // transactions
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    transaction_number TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
    material_request_id TEXT,
    account_id TEXT NOT NULL REFERENCES finance_accounts(id),
    category_id TEXT NOT NULL REFERENCES finance_categories(id),
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    transaction_date INTEGER NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'transfer', 'giro', 'other')),
    approval_status TEXT NOT NULL DEFAULT 'not_required' CHECK(approval_status IN ('not_required', 'pending', 'approved', 'rejected', 'insufficient_balance')),
    approved_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
    approval_notes TEXT,
    attachment_id TEXT REFERENCES attachments(id) ON DELETE SET NULL,
    created_by TEXT NOT NULL REFERENCES "user"(id),
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer)),
    updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // transaction_approvals
  `CREATE TABLE IF NOT EXISTS transaction_approvals (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    approver_id TEXT NOT NULL REFERENCES "user"(id),
    level INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    acted_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // budgets
  `CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'closed')),
    created_by TEXT NOT NULL REFERENCES "user"(id),
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // budget_lines
  `CREATE TABLE IF NOT EXISTS budget_lines (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES finance_categories(id),
    allocated_amount REAL NOT NULL,
    used_amount REAL NOT NULL DEFAULT 0,
    remaining_amount REAL NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // user_profiles
  `CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    birth_date INTEGER,
    gender TEXT CHECK(gender IN ('male', 'female')),
    address TEXT,
    city TEXT,
    province TEXT,
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer)),
    updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // user_employments
  `CREATE TABLE IF NOT EXISTS user_employments (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    employee_number TEXT UNIQUE NOT NULL,
    position TEXT,
    department TEXT,
    joined_date INTEGER,
    employment_status TEXT CHECK(employment_status IN ('permanent', 'contract', 'intern')),
    supervisor_id TEXT REFERENCES "user"(id),
    work_location TEXT,
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer)),
    updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,

  // vendor_profiles
  `CREATE TABLE IF NOT EXISTS vendor_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    vendor_code TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    pic_name TEXT,
    pic_phone TEXT,
    vendor_type TEXT,
    address TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer)),
    updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer))
  )`,
];

console.log("Running migrations...");
for (const sql of migrations) {
  try {
    db.exec(sql);
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    console.log(`✓ ${tableName}`);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

console.log("Running post-migration alterations...");
try {
  db.exec(`ALTER TABLE "user" ADD COLUMN status TEXT DEFAULT 'active'`);
  console.log("✓ Added status column to user table");
} catch (e) {
  // Ignored if column already exists
}
try {
  db.exec(`ALTER TABLE "user" ADD COLUMN last_login INTEGER`);
  console.log("✓ Added last_login column to user table");
} catch (e) {
  // Ignored if column already exists
}
try {
  db.exec(`ALTER TABLE audit_logs ADD COLUMN entity_id TEXT`);
  console.log("✓ Added entity_id column to audit_logs table");
} catch (e) {
  // Ignored if column already exists
}
try {
  db.exec(`ALTER TABLE audit_logs ADD COLUMN entity_type TEXT`);
  console.log("✓ Added entity_type column to audit_logs table");
} catch (e) {
  // Ignored if column already exists
}
try {
  db.exec(`ALTER TABLE vendor_profiles ADD COLUMN vendor_id TEXT`);
  console.log("✓ Added vendor_id column to vendor_profiles table");
} catch (e) {
  // Ignored if column already exists
}

console.log("Migrations complete.");
process.exit(0);
