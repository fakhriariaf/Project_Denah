# Development Plan — Property Siteplan ERP
> Dibuat: 4 Juli 2026 | Status: 🔄 In Progress

---

## Ringkasan Fase

| Fase | Nama | Status | Estimasi |
|------|------|--------|----------|
| Phase 9A | Prioritas Tinggi — Performance & Architecture | ✅ Selesai | 1–2 minggu |
| Phase 9B | Code Quality & UX | ✅ Selesai | 1 minggu |
| Phase 9C | Fitur Baru | ✅ Selesai | 1–2 minggu |
| Phase 10 | Deployment & Production | ⏳ Pending | 1 minggu |

---

## ✅ Sudah Selesai (Phase 0–8 + Improvements)

- [x] Project Foundation, Auth & RBAC, Database Schema
- [x] Visual Siteplan SVG, Marketing & KPR, Finance & Approval
- [x] Production/Vendor, Dashboard & Reporting, Notifikasi & Audit
- [x] 14 Bug fixes (BUG 1–14 + BUG 15)
- [x] Rate limiting di semua mutasi
- [x] Server-side filter leads
- [x] Error boundaries semua route segments
- [x] Input sanitizer di validators
- [x] Python CORS fix
- [x] `renderActions` Server→Client serialization bug fix
- [x] `expandedResources` permissions matrix fix
- [x] README.md update
- [x] Push ke GitHub branch `feat/improvements-bugfixes`
- [x] **Phase 9A selesai** — Finance pagination, Production pagination, Reports server-side filter, Repository & Service layer, Fix EditBookingDialog, Quick fixes infrastruktur

---

## 🔴 Phase 9A — Prioritas Tinggi (Performance & Architecture)

### 9A-1 — Finance Pagination ✅
**File:** `app/finance/finance-shell.tsx`, `server/actions/finance.ts`  
**Masalah:** `getFinancePageData()` load semua invoices, payments, transactions tanpa pagination.  
**Fix:** Implementasi server-side pagination per tab (Invoices, Payments, Transactions) seperti `getBookingsPaginated()`.

**Sub-tasks:**
- [x] Buat `getInvoicesPaginated(params)` di `finance.ts`
- [x] Buat `getPaymentsPaginated(params)` di `finance.ts`
- [x] Buat `getTransactionsPaginated(params)` di `finance.ts` (sudah ada, dipakai)
- [x] Update `finance-shell.tsx` pakai paginated data per tab
- [x] Tambah controlled pagination state per tab
- [x] Test: `npx tsc --noEmit` zero errors, 46/46 tests pass

---

### 9A-2 — Production Pagination ✅
**File:** `app/production/page.tsx`, `app/production/production-shell.tsx`  
**Masalah:** Load semua SPKs, SPMBs, material requests, complaints sekaligus.  
**Fix:** Server-side pagination + filter per tab.

**Sub-tasks:**
- [x] Buat `getSpksPaginated(params)` di `production.ts`
- [x] Buat `getSpmbsPaginated(params)` di `production.ts`
- [x] Update `production-shell.tsx` pakai paginated data + RBAC preserved
- [x] Test: `npx tsc --noEmit` zero errors, RBAC vendor/pengawas tetap berjalan

---

### 9A-3 — Reports Server-Side Filter ✅
**File:** `app/reports/reports-shell.tsx`  
**Masalah:** Filter di client-side setelah fetch semua data.  
**Fix:** Tambah server action yang menerima filter params.

**Sub-tasks:**
- [x] Update `getSalesReportsData()` terima `searchQuery` param → `ilike` di DB
- [x] Update `getUnitReportsData()` terima `searchQuery` param
- [x] Update `getProductionReportsData()` terima `searchQuery` param
- [x] Update `reports-shell.tsx` — debounce search 300ms → server fetch

---

### 9A-4 — Repository & Service Layer ✅
**File:** `server/repositories/` (sebelumnya kosong), `server/services/` (sebelumnya kosong)  
**Masalah:** Semua query DB ada di `actions/` — file sangat besar dan sulit test.  
**Fix:** Ekstrak query kompleks ke `repositories/`, business logic ke `services/`.

**Sub-tasks:**
- [x] Buat `server/repositories/booking.repo.ts`
- [x] Buat `server/repositories/finance.repo.ts`
- [x] Buat `server/repositories/production.repo.ts`
- [x] Buat `server/services/booking.service.ts`
- [x] Buat barrel exports (`index.ts` per folder)
- [x] Test: `npx tsc --noEmit` + `npx vitest --run` 46/46

---

### 9A-5 — Fix EditBookingDialog di Server Component ✅
**File:** `app/marketing/bookings/[id]/page.tsx`  
**Masalah:** `EditBookingDialog` di-import langsung di Server Component — serialization error.  
**Fix:** Buat wrapper Client Component.

**Sub-tasks:**
- [x] Buat `app/marketing/bookings/[id]/booking-actions-client.tsx`
- [x] Pindahkan `EditBookingDialog`, `CancelBookingDialog`, Akad button ke client component
- [x] Update `page.tsx` untuk pakai wrapper baru
- [x] Test: `npx tsc --noEmit` zero errors

---

### 9A-6 — Quick Fixes (Infrastruktur) ✅
**Sub-tasks:**
- [x] Tambah `FRONTEND_URL=http://localhost:3000` ke `.env.example`
- [x] Tambah `loading.tsx` di `app/master/accounts/`, `app/master/banks/`, `app/master/categories/`, `app/master/work-items/`
- [x] Tambah logging di cron overdue scanner (durasi + jumlah SPK diupdate)
- [x] `DEVELOPMENT_PLAN.md` dibuat dan diisi

---

### Checkpoint 9A ✅ PASSED
```bash
npx tsc --noEmit          # ✅ Zero type errors
npx vitest --run          # ✅ 11/11 files, 46/46 tests pass
```

---

## ✅ Phase 9B — Code Quality & UX

### 9B-1 — Pecah Finance Shell ✅
**File:** `app/finance/finance-shell.tsx`  
**Masalah:** Satu file sangat besar untuk semua tab.

**Sub-tasks:**
- [x] Buat `app/finance/tabs/invoices-tab.tsx`
- [x] Buat `app/finance/tabs/payments-tab.tsx` (sudah ada dari sebelumnya)
- [x] Buat `app/finance/tabs/transactions-tab.tsx` (sudah ada)
- [x] Buat `app/finance/tabs/budgets-tab.tsx` (sudah ada)
- [x] Buat `app/finance/tabs/approvals-tab.tsx` (sudah ada)
- [x] Refactor `finance-shell.tsx` jadi orchestrator sederhana (862→746 lines)

---

### 9B-2 — Pecah Production Shell ✅
**File:** `app/production/production-shell.tsx`  
**Masalah:** Sama seperti finance shell.

**Sub-tasks:**
- [x] Buat `app/production/tabs/spk-tab.tsx` (515 lines)
- [x] Buat `app/production/tabs/spmb-tab.tsx` (211 lines)
- [x] Buat `app/production/tabs/progress-tab.tsx` (440 lines)
- [x] Buat `app/production/tabs/complaints-tab.tsx` (sudah ada)
- [x] Refactor `production-shell.tsx` (3721→242 lines orchestrator)

---

### 9B-3 — Marketing Targets Visualisasi ✅
**File:** `app/marketing/targets/page.tsx`  
**Masalah:** Hanya tabel, tidak ada chart pencapaian vs target.

**Sub-tasks:**
- [x] Tambah bar chart pencapaian per marketing (achieved vs target) — `TargetsBarChart` diintegrasikan
- [x] Tambah progress indicator per bulan — grid 12 bulan dengan progress bars
- [x] Gunakan komponen `TargetsBarChart` dari `targets-chart-client.tsx`

---

### 9B-4 — Audit Log Pagination ✅
**File:** `app/dashboard/audit/page.tsx`  
**Masalah:** Perlu verifikasi apakah sudah pakai cursor pagination yang baru.

**Sub-tasks:**
- [x] Cek implementasi current — masih pakai `getAuditLogs()` offset-based
- [x] Migrasi ke `getAuditLogsPaginated()` — cursor-based with "Load More" UI
- [x] Tambah filter by module, action, date range di UI — `AuditLogFilter` + `AuditTableClient`

---

### 9B-5 — TypeScript `any` Cleanup ✅
**Files:** `server/actions/production.ts`, `server/actions/reports.ts`, beberapa komponen  

**Sub-tasks:**
- [x] Scan semua `as any` dan `data: any` yang tersisa
- [x] Buat proper interfaces — Drizzle inferred types, union types, `Record<string, unknown>`
- [x] Khusus: `getProgressPhotosForProject` return type → proper Drizzle inferred
- [x] Khusus: Complaint query result type → typed via `typeof` inference
- [x] Fix: `catch (err: any)` → `catch (err: unknown)` + `instanceof Error` guards
- [x] Fix: `validators/*.ts` date preprocess casts

---

### Checkpoint 9B ✅ PASSED
```bash
npx tsc --noEmit          # ✅ Zero type errors
npx vitest --run          # ✅ 11/11 files, 46/46 tests pass
```

---

## ✅ Phase 9C — Fitur Baru

### 9C-1 — Halaman Notifikasi Lengkap ✅
**Path:** `app/dashboard/notifications/page.tsx`  
**Deskripsi:** Riwayat notifikasi lengkap dengan filter type, pagination, mark all read.

### 9C-2 — KPR Detail Page ✅
**Path:** `app/marketing/kpr/[id]/page.tsx`  
**Deskripsi:** Halaman detail per proses KPR dengan timeline milestone, dokumen, bank submissions.

### 9C-3 — Invoice Detail Page ✅
**Path:** `app/finance/invoices/[id]/page.tsx`  
**Deskripsi:** Detail invoice dengan riwayat pembayaran, status, cetak invoice.

### 9C-4 — Complaint Detail Page ✅
**Path:** `app/production/complaints/[id]/page.tsx`  
**Deskripsi:** Detail complaint dengan timeline resolusi, attachment, response vendor.

### 9C-5 — Laporan KPR ✅
**Path:** `app/reports/` (tab baru "Laporan KPR")  
**Deskripsi:** Laporan status KPR — berapa proses BI Checking, pemberkasan, approval bank, SLA terlewat.

### 9C-6 — Laporan Complaint ✅
**Path:** `app/reports/` (tab baru "Laporan Complaint")  
**Deskripsi:** Rekap complaint — total open, resolved, kategori terbanyak, rata-rata waktu resolusi.

### 9C-7 — Filter Public Siteplan ✅
**Path:** `components/siteplan/public-siteplan-viewer.tsx`  
**Deskripsi:** Filter status kavling di public siteplan (tersedia, proses, terjual) + legend.

### 9C-8 — Real-time Notifikasi ✅
**Path:** `hooks/use-notification-polling.ts`, `components/dashboard/notification-dropdown.tsx`  
**Deskripsi:** Polling 10 detik + toast saat notifikasi baru + animasi bell + visibility-aware.

---

### Checkpoint 9C ✅ PASSED
```bash
npx tsc --noEmit          # ✅ Zero type errors
npx vitest --run          # ✅ 11/11 files, 46/46 tests pass
```

---

## 🚀 Phase 10 — Deployment & Production

### 10-1 — Supabase Setup
- [ ] Buat project Supabase production
- [ ] Set `DATABASE_URL` ke Supabase PostgreSQL
- [ ] Jalankan `npx drizzle-kit migrate` ke Supabase
- [ ] Buat bucket `property-attachments` di Supabase Storage
- [ ] Test upload file ke Supabase

### 10-2 — Environment Production
- [ ] Set semua env vars di Vercel/hosting
- [ ] Set `BETTER_AUTH_URL` = domain production
- [ ] Set `BETTER_AUTH_SECRET` (min 32 chars, berbeda dari dev)
- [ ] Set `FRONTEND_URL` untuk Python CORS
- [ ] Set `CRON_SECRET`

### 10-3 — Cron Job
- [ ] Setup Vercel Cron `0 0 * * *` → `/api/cron/overdue-scanner`
- [ ] Test trigger manual dengan `CRON_SECRET`
- [ ] Verifikasi logging output

### 10-4 — Seed Production
- [ ] Jalankan `npx tsx db/seed.ts` di production
- [ ] Ganti semua password default (`password123`)
- [ ] Hapus atau disable akun seed yang tidak perlu

### 10-5 — Smoke Test E2E
- [ ] Login semua role
- [ ] Buat project → unit → booking → payment flow
- [ ] Buat SPK → progress → BAST flow
- [ ] Verifikasi siteplan public bisa diakses tanpa login
- [ ] Verifikasi cron overdue scanner jalan

### 10-6 — Python AI Engine
- [ ] Setup Python env di production server
- [ ] Test endpoint `/api/v1/analyze-siteplan`
- [ ] Verifikasi CORS hanya ke domain production

---

## Testing Strategy

### Unit / Property Tests
```bash
npx vitest --run
```
Covers: rate-limiter, sanitizer, safe-action, pagination, bulk operations, cache

### Type Check
```bash
npx tsc --noEmit
```
Must: Zero errors sebelum setiap push

### Lint
```bash
npm run lint
```

### Build Check
```bash
npm run build
```
Must: Sukses tanpa error sebelum deploy

### Manual Smoke Test (per phase)
Setiap phase selesai, test manual:
1. Login sebagai Super Admin
2. Navigasi semua halaman yang diubah
3. Cek console browser tidak ada error
4. Cek network tab tidak ada 500 errors

---

## Branching Strategy

```
main                    ← production branch
  └── feat/phase-9a     ← Phase 9A work
  └── feat/phase-9b     ← Phase 9B work
  └── feat/phase-9c-*   ← Per fitur baru (setelah konfirmasi)
  └── feat/phase-10     ← Deployment prep
```

Setiap phase selesai → PR ke `main` → review → merge.

---

## Progress Tracker

### Phase 9A
| # | Task | Status | Branch |
|---|------|--------|--------|
| 9A-1 | Finance Pagination | ✅ Done | feat/improvements-bugfixes |
| 9A-2 | Production Pagination | ✅ Done | feat/improvements-bugfixes |
| 9A-3 | Reports Server-Side Filter | ✅ Done | feat/improvements-bugfixes |
| 9A-4 | Repository & Service Layer | ✅ Done | feat/improvements-bugfixes |
| 9A-5 | Fix EditBookingDialog | ✅ Done | feat/improvements-bugfixes |
| 9A-6 | Quick Fixes Infrastruktur | ✅ Done | feat/improvements-bugfixes |

### Phase 9B ✅
| # | Task | Status | Branch |
|---|------|--------|--------|
| 9B-1 | Pecah Finance Shell | ✅ Done | feat/phase-9b |
| 9B-2 | Pecah Production Shell | ✅ Done | feat/phase-9b |
| 9B-3 | Marketing Targets Chart | ✅ Done | feat/phase-9b |
| 9B-4 | Audit Log Pagination | ✅ Done | feat/phase-9b |
| 9B-5 | TypeScript any Cleanup | ✅ Done | feat/phase-9b |

> **Checkpoint:** `npx tsc --noEmit` zero errors, `npx vitest --run` 46/46 tests pass.

### Phase 9C ✅
| # | Fitur | Status | Branch |
|---|-------|--------|--------|
| 9C-1 | Halaman Notifikasi | ✅ Done | feat/phase-9c |
| 9C-2 | KPR Detail Page | ✅ Done | feat/phase-9c |
| 9C-3 | Invoice Detail Page | ✅ Done | feat/phase-9c |
| 9C-4 | Complaint Detail Page | ✅ Done | feat/phase-9c |
| 9C-5 | Laporan KPR | ✅ Done | feat/phase-9c |
| 9C-6 | Laporan Complaint | ✅ Done | feat/phase-9c |
| 9C-7 | Filter Public Siteplan | ✅ Done | feat/phase-9c |
| 9C-8 | Real-time Notifikasi | ✅ Done | feat/phase-9c |

> **Checkpoint:** `npx tsc --noEmit` zero errors, `npx vitest --run` 46/46 tests pass.

### Phase 10
| # | Task | Status |
|---|------|--------|
| 10-1 | Supabase Setup | ⏳ |
| 10-2 | Environment Production | ⏳ |
| 10-3 | Cron Job | ⏳ |
| 10-4 | Seed Production | ⏳ |
| 10-5 | Smoke Test E2E | ⏳ |
| 10-6 | Python AI Engine | ⏳ |

---

## Legend
- ✅ Selesai
- 🔄 In Progress
- ⏳ Pending
- 🔒 Locked (perlu konfirmasi)
- ❓ Belum dikonfirmasi
- ❌ Dibatalkan
