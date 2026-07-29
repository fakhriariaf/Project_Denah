/**
 * KPR Stage SLA — Kalkulasi Hari Kerja dan Klasifikasi Status_SLA
 *
 * Modul murni (tanpa DB, tanpa I/O). Semua fungsi deterministik terhadap
 * argumen yang diberikan.
 *
 * Referensi:
 * - `.kiro/specs/kpr-stage-sla-master-data/design.md` bagian
 *   "Components and Interfaces > 1. Service Layer > working-days.ts (murni)"
 * - `requirements.md` Requirement 4 (Perhitungan Tenggat Hari Kerja) dan
 *   Requirement 12 (Kanban KPR dan Indikator SLA).
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10,
 * 12.2, 12.3, 12.4, 12.5**
 */

/** Zona_Waktu_Aplikasi — dipakai untuk menentukan batas tanggal Hari_Kerja. */
export const APP_TIMEZONE = "Asia/Jakarta"; // WIB, UTC+7

const SATURDAY = 6;
const SUNDAY = 0;

function isWeekend(day: number): boolean {
  return day === SATURDAY || day === SUNDAY;
}

/**
 * Mengembalikan kunci tanggal kalender (YYYY-MM-DD) pada `APP_TIMEZONE` untuk
 * `date`. Dipakai untuk perbandingan "tanggal yang sama" yang aman terhadap
 * zona waktu lokal server (server dapat berjalan di UTC).
 */
function getAppTimezoneDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Menambahkan N Hari_Kerja (Senin-Jumat) ke `start`, melewati Sabtu & Minggu,
 * mempertahankan komponen waktu (jam-menit-detik-milidetik) dari `start`, dan
 * menjamin hasil jatuh pada Hari_Kerja.
 *
 * Algoritma iteratif hari-per-hari, konsisten dengan implementasi legacy
 * hardcoded pada `server/actions/marketing.ts` (createBooking/updateBooking),
 * benar untuk `workingDays` 1..365.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.9, 4.10**
 */
export function computeWorkingDayDeadline(start: Date, workingDays: number): Date {
  const deadline = new Date(start.getTime());
  let addedDays = 0;
  while (addedDays < workingDays) {
    deadline.setDate(deadline.getDate() + 1);
    if (!isWeekend(deadline.getDay())) {
      addedDays++;
    }
  }
  return deadline;
}

/**
 * Mengurangkan 1 Hari_Kerja dari `date`, melewati Sabtu & Minggu, mempertahankan
 * komponen waktu. Dipakai sebagai batas internal untuk klasifikasi
 * `perlu_dicek` ("0 < sisa <= 1 Hari_Kerja sebelum tenggat").
 */
function subtractOneWorkingDay(date: Date): Date {
  const result = new Date(date.getTime());
  let subtractedDays = 0;
  while (subtractedDays < 1) {
    result.setDate(result.getDate() - 1);
    if (!isWeekend(result.getDay())) {
      subtractedDays++;
    }
  }
  return result;
}

export type SlaStatus =
  | "belum_dimulai"
  | "tepat_waktu"
  | "perlu_dicek"
  | "jatuh_tempo_hari_ini"
  | "terlambat"
  | "selesai_tepat_waktu"
  | "selesai_terlambat"
  | "tidak_berlaku";

/**
 * Klasifikasi Status_SLA untuk Kunjungan_Tahap aktif berdasarkan Snapshot_SLA
 * (tenggat) dan waktu evaluasi `now`.
 *
 * Fungsi ini hanya mengembalikan salah satu dari 4 status berbasis waktu:
 * `terlambat`, `jatuh_tempo_hari_ini`, `perlu_dicek`, atau `tepat_waktu`.
 * Status `belum_dimulai` dan `tidak_berlaku` ditentukan oleh caller
 * berdasarkan keberadaan snapshot/tahap terminal, bukan oleh fungsi ini.
 *
 * Aturan (Req 4.7, 4.8, 12.2-12.5), dievaluasi berurutan:
 * 1. `terlambat`     — waktu evaluasi melewati tenggat (STRICT: now > deadline).
 * 2. `jatuh_tempo_hari_ini` — tanggal tenggat == tanggal evaluasi pada
 *    `APP_TIMEZONE` DAN waktu evaluasi belum melewati tenggat. Berprioritas
 *    di atas `perlu_dicek` (Req 4.7, 12.4).
 * 3. `perlu_dicek`   — 0 < sisa <= 1 Hari_Kerja sebelum tenggat.
 * 4. `tepat_waktu`   — sisa > 1 Hari_Kerja sebelum tenggat.
 *
 * **Validates: Requirements 4.7, 4.8, 12.2, 12.3, 12.4, 12.5**
 */
export function classifyActiveSlaStatus(
  snapshot: { slaDeadlineAt: Date },
  now: Date,
): SlaStatus {
  const deadline = snapshot.slaDeadlineAt;

  if (now.getTime() > deadline.getTime()) {
    return "terlambat";
  }

  if (getAppTimezoneDateKey(now) === getAppTimezoneDateKey(deadline)) {
    return "jatuh_tempo_hari_ini";
  }

  const oneWorkingDayBeforeDeadline = subtractOneWorkingDay(deadline);
  if (now.getTime() >= oneWorkingDayBeforeDeadline.getTime()) {
    return "perlu_dicek";
  }

  return "tepat_waktu";
}

/**
 * Klasifikasi hasil saat Kunjungan_Tahap ditutup: "Selesai Tepat Waktu" bila
 * ditutup pada atau sebelum tenggat, "Selesai Terlambat" bila ditutup setelah
 * tenggat.
 *
 * **Validates: Requirements 12.2, 12.3 (analog tertutup); design.md Req 6.2, 6.3**
 */
export function classifyClosedSlaResult(
  snapshot: { slaDeadlineAt: Date },
  exitedAt: Date,
): "selesai_tepat_waktu" | "selesai_terlambat" {
  return exitedAt.getTime() <= snapshot.slaDeadlineAt.getTime()
    ? "selesai_tepat_waktu"
    : "selesai_terlambat";
}
