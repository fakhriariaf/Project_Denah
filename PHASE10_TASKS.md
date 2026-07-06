# Phase 10 — Deployment & Production Tasks

## Prasyarat
- Akun Vercel (free tier OK)
- Akun Supabase (free tier OK untuk mulai)
- (Opsional) Domain custom
- (Opsional) Server/VPS untuk Python AI Engine

---

## Task 10-1: Supabase Database Setup

### 10-1a: Buat Project Supabase
1. Login ke https://supabase.com/dashboard
2. Klik "New Project"
3. Pilih region terdekat (Singapore untuk Indonesia)
4. Catat **Database Password** (simpan di tempat aman)
5. Setelah project selesai, copy **Connection String** dari:
   - Project Settings → Database → Connection string → URI
   - Format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

### 10-1b: Migrate Schema ke Supabase
```bash
# Set DATABASE_URL ke Supabase connection string
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" npx drizzle-kit push
```
> Gunakan `drizzle-kit push` untuk push schema langsung tanpa generate migration files.

### 10-1c: Seed Data Awal
```bash
DATABASE_URL="postgresql://..." npx tsx db/seed.ts
```
Ini akan membuat:
- Roles (Super Admin, Admin Kantor, Marketing Manager, dll)
- Default Super Admin user (email: admin@property.com, password: password123)

### 10-1d: Buat Supabase Storage Bucket
1. Di Supabase Dashboard → Storage
2. Klik "New bucket"
3. Nama: `property-attachments`
4. Pilih **Public** (agar file bisa diakses via URL)
5. Set policies:
   - INSERT: authenticated users
   - SELECT: public (semua bisa lihat)
   - DELETE: authenticated users

---

## Task 10-2: Vercel Deployment Setup

### 10-2a: Deploy ke Vercel
1. Login ke https://vercel.com
2. Import repo GitHub
3. Framework: Next.js (auto-detected)
4. Build command: `npm run build`
5. Output directory: `.next` (default)

### 10-2b: Set Environment Variables di Vercel
Pergi ke Project Settings → Environment Variables, tambahkan:

| Key | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | `postgresql://postgres.[ref]:[pwd]@aws-0-...` | Dari Supabase step 10-1a |
| `BETTER_AUTH_URL` | `https://your-domain.vercel.app` | Domain production |
| `BETTER_AUTH_SECRET` | `(generate 32+ char random string)` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://[ref].supabase.co` | Dari Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Dari Supabase → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Dari Supabase → API Keys (service role) |
| `CRON_SECRET` | `(generate random token)` | Untuk protect cron endpoint |
| `FRONTEND_URL` | `https://your-domain.vercel.app` | Untuk Python CORS |

### 10-2c: Verifikasi Build Sukses
Setelah deploy pertama, pastikan:
- Build log tidak ada error
- Homepage `/login` bisa diakses
- Tidak ada 500 errors di Vercel Functions log

---

## Task 10-3: Cron Job Setup (Vercel Cron)

### 10-3a: Buat `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/overdue-scanner",
      "schedule": "0 0 * * *"
    }
  ]
}
```
> Ini akan trigger setiap hari jam 00:00 UTC (07:00 WIB).

### 10-3b: Test Manual Cron
```bash
curl -X GET https://your-domain.vercel.app/api/cron/overdue-scanner \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
Harus return: `{ "message": "Daily SPK overdue check executed successfully.", ... }`

---

## Task 10-4: Post-Deployment Security

### 10-4a: Ganti Password Default
Login sebagai admin@property.com dengan password123, lalu:
1. Ganti password Super Admin ke yang kuat
2. Buat akun user baru untuk setiap staf
3. Nonaktifkan akun seed yang tidak diperlukan

### 10-4b: Verifikasi RBAC
Test login sebagai setiap role dan pastikan:
- Marketing hanya bisa akses marketing pages
- Vendor hanya bisa akses production (SPK mereka)
- Keuangan hanya bisa akses finance pages
- Super Admin bisa akses semua

---

## Task 10-5: Smoke Test E2E

### Checklist Manual Testing:
- [ ] Login semua role (Super Admin, Admin Kantor, Marketing, Keuangan, Direksi, Pengawas, Vendor)
- [ ] Buat project → unit → siteplan shape → booking → payment flow
- [ ] Buat SPK → progress input → BAST flow
- [ ] Upload file attachment (proof pembayaran, foto progress)
- [ ] Verifikasi siteplan public bisa diakses tanpa login (`/siteplan-public`)
- [ ] Verifikasi notifikasi muncul setelah approval
- [ ] Verifikasi audit log tercatat
- [ ] Cek console browser tidak ada error
- [ ] Cek network tab tidak ada 500 errors

---

## Task 10-6: Python AI Engine (Opsional)

### 10-6a: Deploy Python Server
Opsi deployment:
- **Railway.app** (paling mudah, free tier tersedia)
- **Render.com** (free tier, auto-sleep)
- **DigitalOcean App Platform**
- **VPS manual** (lebih kontrol)

### 10-6b: Setup Environment Python
```bash
cd python-ai-engine
pip install -r requirements.txt
# Set environment variables:
# FRONTEND_URL=https://your-domain.vercel.app (untuk CORS)
```

### 10-6c: Test Endpoint
```bash
curl -X POST https://your-python-server.com/api/v1/analyze-siteplan \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://..."}'
```

### 10-6d: Update CORS
Pastikan Python server hanya accept requests dari domain production:
```python
ALLOWED_ORIGINS = [
    os.environ.get("FRONTEND_URL", "http://localhost:3000")
]
```

---

## Task 10-7: Domain Custom (Opsional)

### Jika punya domain sendiri:
1. Di Vercel → Project Settings → Domains
2. Tambahkan domain (misal: `erp.namaperumahan.com`)
3. Update DNS records sesuai instruksi Vercel
4. Update `BETTER_AUTH_URL` dan `FRONTEND_URL` di env vars ke domain baru
5. Redeploy

---

## Urutan Eksekusi yang Disarankan

```
10-1 (Supabase Setup) → 10-2 (Vercel Deploy) → 10-3 (Cron) → 10-4 (Security) → 10-5 (Smoke Test) → 10-6 (Python) → 10-7 (Domain)
```

---

## Yang Bisa Saya Bantu Langsung (Code Changes):

1. ✅ Buat `vercel.json` dengan cron config
2. ✅ Update `.env.example` jika perlu tambahan env vars
3. ✅ Fix masalah build jika `npm run build` gagal
4. ✅ Adjust drizzle config jika connection string bermasalah
5. ✅ Setup Supabase storage upload utility jika belum ada

## Yang Perlu Kamu Lakukan Manual:

1. Buat project di Supabase dashboard
2. Buat project di Vercel dashboard
3. Set environment variables di Vercel
4. Test login & flow di production
5. Deploy Python ke server pilihan
