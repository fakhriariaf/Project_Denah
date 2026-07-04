# Property Siteplan ERP

Sistem ERP berbasis web untuk manajemen properti perumahan — mencakup siteplan interaktif, marketing & booking, keuangan, produksi/konstruksi, dan pelaporan eksekutif.

Dibangun dengan **Next.js 16 App Router**, **Drizzle ORM**, **Better Auth**, dan tema **Sage Green** yang konsisten.

---

## Tech Stack

| Layer | Library / Tool |
|---|---|
| Framework | Next.js 16.2 (App Router, React 19) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + tw-animate-css |
| UI Components | shadcn/ui + Base UI |
| ORM | Drizzle ORM |
| Database (dev) | SQLite via `better-sqlite3` (`local.db`) |
| Database (prod) | Supabase PostgreSQL |
| Auth | Better Auth dengan RBAC |
| Forms | React Hook Form + Zod |
| Charts | Recharts v3 |
| Tables | TanStack Table (via shadcn) |
| State | Zustand |
| Toast | Sonner |
| Excel Export | xlsx |
| Testing | Vitest + fast-check (property-based) |
| AI Engine | Python FastAPI (uvicorn, port 8000) |

---

## Fitur Utama

- **Visual Siteplan** — SVG interaktif dengan presisi koordinat menggunakan W3C CTM Inversion Matrix (`getScreenCTM` + `matrixTransform`)
- **Marketing & Booking** — Lead tracking, multi-step booking, KPR SLA 5 hari
- **Finance & Approval** — Invoice otomatis, deduction budget, kas/bank ledger, workflow approval direksi
- **Produksi & Vendor** — SPK generation, SPMB otomatis, progress itemized, transisi status `construction_done`
- **Dashboard & Reports** — Metrik eksekutif, cash flow chart, ekspor Excel
- **Notifikasi & Audit Trail** — Notifikasi berbasis role, IP extraction via `x-forwarded-for`
- **Master Data** — Project, Unit, Customer, Vendor, Bank, Akun Kas, Kategori Keuangan, Work Items
- **Bulk Operations** — Multi-select di tabel, bulk delete dengan konfirmasi, bulk export Excel
- **Rate Limiting** — 30 mutasi per menit per session, fixed-window counter
- **Public Siteplan** — Halaman siteplan publik tanpa login

---

## Struktur Proyek

```
property-siteplan-erp/
├── app/                         # Next.js App Router pages
│   ├── (auth)/login/            # Halaman login
│   ├── dashboard/               # Dashboard + user management + audit log
│   ├── marketing/               # Bookings, Leads, KPR, Targets, Waiting List
│   ├── finance/                 # Finance overview + Approvals
│   ├── production/              # SPK + SPMB
│   ├── master/                  # Master data (projects, units, customers, dll.)
│   ├── reports/                 # Laporan eksekutif
│   ├── settings/                # Settings + Role management
│   ├── siteplan/                # Siteplan editor (authenticated)
│   ├── siteplan-public/         # Siteplan viewer (public, tanpa login)
│   ├── api/                     # Route handlers (auth, upload, cron, public)
│   ├── global-error.tsx         # Global error boundary (root layout fallback)
│   ├── not-found.tsx            # Halaman 404
│   └── layout.tsx               # Root layout + Toaster
│
├── components/
│   ├── ui/                      # Komponen UI reusable
│   │   ├── stat-card.tsx        # Metric card dengan trend indicator
│   │   ├── page-header.tsx      # Header gradient konsisten per halaman
│   │   ├── empty-state.tsx      # Placeholder saat data kosong
│   │   ├── form-field.tsx       # Label + Input + error message (RHF)
│   │   ├── bulk-action-bar.tsx  # Floating bar untuk bulk operations
│   │   ├── data-table-pagination.tsx
│   │   └── ...
│   ├── charts/                  # Chart components (dynamic import, ssr: false)
│   │   ├── dynamic-charts.tsx   # Lazy-loaded Recharts wrappers
│   │   └── ...
│   ├── siteplan/                # SVG siteplan viewer & editor
│   │   ├── dynamic-siteplan.tsx # Lazy-loaded siteplan wrapper
│   │   └── ...
│   └── dashboard/               # Shell components per role
│
├── server/
│   ├── actions/                 # Server Actions per domain
│   │   ├── safe-action.ts       # safeAction() wrapper (try-catch + ActionResult)
│   │   ├── marketing.ts
│   │   ├── finance.ts
│   │   ├── production.ts
│   │   ├── master.ts
│   │   ├── bulk.ts              # Bulk delete & export
│   │   ├── reports.ts
│   │   └── ...
│   ├── middleware/
│   │   ├── rate-limiter.ts      # Fixed-window rate limiter (Map / Redis)
│   │   └── sanitizer.ts         # HTML sanitization + trim + length validation
│   ├── validators/              # Zod schemas per domain
│   └── permissions/             # RBAC permission checks
│
├── db/
│   ├── schema/                  # Drizzle ORM schemas (7 file, 28+ tabel)
│   │   ├── auth.ts
│   │   ├── master.ts
│   │   ├── marketing.ts
│   │   ├── finance.ts
│   │   ├── production.ts
│   │   ├── access.ts
│   │   └── system.ts
│   ├── migrations/              # SQL migration files
│   ├── seed.ts                  # Seed roles & default users
│   ├── drop_all.ts              # Reset database (development only)
│   └── index.ts                 # Drizzle client instance
│
├── lib/
│   ├── action-utils.ts          # handleActionResult() utility
│   ├── cache.ts                 # cachedQuery() wrapper (React cache + unstable_cache)
│   ├── cached-queries.ts        # Query functions menggunakan cachedQuery
│   ├── error-parser.ts          # parseDbError() untuk constraint violations
│   ├── export-utils.ts          # Excel export helpers
│   ├── format-utils.ts          # Currency, date, number formatters
│   ├── pagination.ts            # Pagination helper (LIMIT/OFFSET)
│   ├── siteplan-utils.ts        # SVG coordinate utilities
│   └── utils.ts                 # cn() dan umum lainnya
│
├── tests/
│   └── properties/              # Property-based tests (Vitest + fast-check)
│       ├── rate-limiter.test.ts
│       ├── sanitizer.test.ts
│       ├── safe-action.test.ts
│       ├── pagination.test.ts
│       ├── cursor-pagination.test.ts
│       ├── bulk-delete-atomicity.test.ts
│       └── ...
│
├── python-ai-engine/            # FastAPI AI service (port 8000)
│   ├── main.py
│   └── routers/
│
├── hooks/                       # React custom hooks
├── types/                       # TypeScript type definitions
├── docs/                        # Dokumentasi teknis & playbook
├── public/                      # Static assets
├── middleware.ts                 # Next.js middleware (auth guard)
├── drizzle.config.ts            # Drizzle Kit configuration
├── vitest.config.ts             # Vitest configuration
└── .env                         # Environment variables (lihat .env.example)
```

---

## Instalasi & Setup Lokal

### Prasyarat

Pastikan semua tools berikut sudah terinstall sebelum memulai:

| Tool | Versi Minimum | Keterangan |
|---|---|---|
| [Node.js](https://nodejs.org) | 20+ | Runtime JavaScript |
| [npm](https://npmjs.com) | 10+ | Sudah termasuk dalam Node.js |
| [PostgreSQL](https://www.postgresql.org/download/) | 14+ | Database utama |
| [Python](https://www.python.org/downloads/) | 3.11+ | Untuk AI engine (opsional) |
| [Git](https://git-scm.com) | — | Version control |

> **Catatan:** Aplikasi ini menggunakan **PostgreSQL** sebagai database. Pastikan PostgreSQL sudah berjalan sebelum menjalankan migrasi.

---

### Langkah 1 — Clone repository

```bash
git clone <repo-url>
cd property-siteplan-erp
```

---

### Langkah 2 — Install Node.js dependencies

```bash
npm install
```

Proses ini akan menginstall semua dependencies dari `package.json` termasuk Next.js, Drizzle ORM, Better Auth, Recharts, dan lainnya.

---

### Langkah 3 — Siapkan database PostgreSQL

Buat database baru di PostgreSQL lokal Anda:

```bash
# Masuk ke PostgreSQL CLI
psql -U postgres

# Buat database
CREATE DATABASE property_erp;

# Keluar
\q
```

Atau gunakan tools GUI seperti **pgAdmin**, **DBeaver**, atau **TablePlus** untuk membuat database baru.

> **Alternatif tanpa install PostgreSQL lokal:** Buat project gratis di [supabase.com](https://supabase.com), lalu gunakan connection string yang tersedia di **Project Settings → Database → Connection string (URI)**.

---

### Langkah 4 — Konfigurasi environment variables

Salin file contoh environment:

```bash
cp .env.example .env
```

Buka `.env` dan isi semua nilai berikut:

```env
# ─── DATABASE ────────────────────────────────────────────────────────────────
# PostgreSQL local:
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/property_erp

# Supabase (jika pakai Supabase sebagai database):
# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxx.supabase.co:5432/postgres

# ─── BETTER AUTH ─────────────────────────────────────────────────────────────
BETTER_AUTH_URL=http://localhost:3000
# WAJIB: Ganti dengan string acak minimal 32 karakter
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
BETTER_AUTH_SECRET=ganti-dengan-string-acak-minimal-32-karakter

# ─── SUPABASE STORAGE (opsional di development) ───────────────────────────────
# Digunakan untuk upload dokumen, foto, dan lampiran
# Jika dikosongkan, fitur upload tidak akan berfungsi
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# ─── CRON JOB ────────────────────────────────────────────────────────────────
# Secret untuk endpoint /api/cron/overdue-scanner
CRON_SECRET=your-cron-secret-token
```

**Cara generate `BETTER_AUTH_SECRET`:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Langkah 5 — Jalankan migrasi database

```bash
npx drizzle-kit migrate
```

Perintah ini akan membuat semua tabel di database PostgreSQL berdasarkan schema di `db/migrations/`.

---

### Langkah 6 — Seed data awal (roles & users)

```bash
npx tsx db/seed.ts
```

Setelah selesai, akun berikut tersedia untuk login:

| Email | Password | Role |
|---|---|---|
| `admin@denahproperty.com` | `password123` | Super Admin |
| `kantor@denahproperty.com` | `password123` | Admin Kantor |
| `marketing@denahproperty.com` | `password123` | Marketing |
| `keuangan@denahproperty.com` | `password123` | Admin Keuangan |
| `direksi@denahproperty.com` | `password123` | Direksi |
| `pengawas@denahproperty.com` | `password123` | Pengawas Lapangan |
| `vendor@denahproperty.com` | `password123` | Vendor |

> **Penting:** Ganti password semua akun setelah pertama kali login di lingkungan production.

---

### Langkah 7 — Jalankan development server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

Perintah ini menjalankan **dua proses sekaligus** menggunakan `concurrently`:
- **Next.js** di port `3000`
- **Python AI Engine** di port `8000`

> Jika tidak membutuhkan fitur AI (analisis siteplan), jalankan hanya Next.js:
> ```bash
> npm run dev:next
> ```

---

### Setup Python AI Engine (Opsional)

AI engine digunakan untuk analisis siteplan — parsing SVG dan deteksi kavling via computer vision.

**Prasyarat tambahan:** Python 3.11+ dan pip

```bash
# Masuk ke folder AI engine
cd python-ai-engine

# Buat virtual environment
python -m venv venv

# Aktifkan virtual environment
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Install dependencies Python
pip install -r requirements.txt

# Kembali ke root project
cd ..
```

Setelah setup, `npm run dev` akan menjalankan AI engine secara otomatis. Atau jalankan manual:

```bash
cd python-ai-engine
venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Verifikasi AI engine berjalan: [http://127.0.0.1:8000](http://127.0.0.1:8000)

---

### Verifikasi Setup

Setelah semua langkah selesai, verifikasi dengan:

```bash
# TypeScript check — pastikan tidak ada type error
npx tsc --noEmit

# Lint check
npm run lint

# Jalankan test suite
npm run test
```

Jika semua berhasil tanpa error, setup sudah lengkap.

---

## Commands

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Dev server Next.js + Python AI engine |
| `npm run dev:next` | Dev server Next.js saja |
| `npm run build` | Production build |
| `npm run start` | Jalankan production build |
| `npm run lint` | Lint check (ESLint) |
| `npm run test` | Jalankan property-based tests (single run) |
| `npm run test:watch` | Jalankan tests dalam watch mode |
| `npx tsc --noEmit` | TypeScript type check |
| `npx drizzle-kit migrate` | Jalankan migrasi database |
| `npx drizzle-kit generate` | Generate migration dari schema |
| `npx tsx db/seed.ts` | Seed roles & user default |
| `npx tsx db/drop_all.ts` | Reset database (dev only) |

---

## Arsitektur Database

Drizzle ORM dengan 7 schema file dan 28+ tabel:

| Schema | Domain |
|---|---|
| `auth.ts` | Users, sessions, accounts, verification |
| `master.ts` | Projects, units, customers, vendors, banks, work items, finance categories |
| `marketing.ts` | Leads, bookings, KPR, waiting list, marketing targets |
| `finance.ts` | Invoices, transactions, budget, cash accounts, approvals |
| `production.ts` | SPK, SPMB, progress items |
| `access.ts` | RBAC roles, permissions, project-user assignments |
| `system.ts` | Notifications, audit logs, settings |

Database development menggunakan SQLite (`local.db`). Schema identik digunakan untuk Supabase PostgreSQL di production.

---

## Server Actions Pattern

Semua mutasi menggunakan `safeAction()` wrapper dari `server/actions/safe-action.ts`:

```ts
// Format return value yang konsisten di seluruh aplikasi
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }
```

Di client component, gunakan `handleActionResult()` dari `lib/action-utils.ts` untuk menampilkan Toast otomatis:

```ts
const result = await createBooking(data)
handleActionResult(result, { successMessage: "Booking berhasil dibuat" })
```

---

## Caching Strategy

| Halaman | Strategy |
|---|---|
| Dashboard overview | ISR `revalidate = 60` (60 detik) |
| List pages (Bookings, Transactions) | `revalidate = 0` (selalu fresh) |
| Data referensi (projects, units) | React `cache()` — request-level dedup |
| Query lintas-request | `cachedQuery()` di `lib/cache.ts` (unstable_cache + tags) |

---

## Role & Akses

| Role | Akses |
|---|---|
| Super Admin | Akses penuh semua fitur |
| Admin Kantor | Marketing, finance, master data, laporan |
| Direktur | Dashboard exec, approval finance |
| Marketing | Leads, bookings, waiting list |
| Kepala Produksi | SPK, SPMB, progress update |
| Supervisor Lapangan | Progress update lapangan |
| Vendor | SPK & progress milik sendiri |
| Kasir | Transaksi keuangan |
| Procurement | SPK & pengadaan |

---

## Testing

Project menggunakan **property-based testing** dengan Vitest dan fast-check. Test berada di `tests/properties/`.

```bash
npm run test
```

Test yang tersedia mencakup:
- `rate-limiter` — Fixed-window counter behavior
- `sanitizer` — HTML sanitization & input trimming
- `safe-action` — ActionResult format consistency
- `pagination` — LIMIT/OFFSET correctness
- `cursor-pagination` — Cursor-based pagination stability
- `bulk-delete-atomicity` — Transaction rollback on failure
- `bulk-delete-exclusion` — Status-based item exclusion
- `bulk-export-completeness` — Excel export coverage
- `cached-query` — Cache fallback behavior
- `handle-action-result` — Toast trigger conditions
- `server-filtering` — WHERE clause filtering correctness

---

## Progress Implementasi

| Phase | Status | Deskripsi |
|---|---|---|
| Phase 0 | ✅ Selesai | Project foundation, typography, Sage Green theme |
| Phase 1 | ✅ Selesai | Auth & RBAC |
| Phase 2 | ✅ Selesai | Database schema & master data |
| Phase 3 | ✅ Selesai | Visual siteplan SVG |
| Phase 4 | ✅ Selesai | Marketing & KPR |
| Phase 5 | ✅ Selesai | Finance & approval workflow |
| Phase 6 | ✅ Selesai | Production & vendor management |
| Phase 7 | ✅ Selesai | Dashboard & reporting |
| Phase 8 | ✅ Selesai | Notifikasi & audit trail |
| Phase 9 | 🔄 Ongoing | Testing & deployment (Supabase migration, smoke tests) |

---

## Deployment (Production)

### Supabase PostgreSQL

1. Buat project di [supabase.com](https://supabase.com)
2. Isi `DATABASE_URL` dengan connection string PostgreSQL dari Supabase
3. Jalankan: `npx drizzle-kit migrate`
4. Buat storage bucket `property-attachments` (public) di Supabase Storage
5. Isi variabel Supabase di `.env`

### Vercel

```bash
npm run build
```

Deploy ke Vercel dengan environment variables yang sudah dikonfigurasi. Pastikan `BETTER_AUTH_URL` diisi dengan domain production.

### Cron Job

Endpoint `/api/cron/overdue-scanner` dijalankan setiap tengah malam untuk mendeteksi SPK yang overdue. Gunakan Vercel Cron atau layanan eksternal (cron-job.org) dengan header `Authorization: Bearer {CRON_SECRET}`.
